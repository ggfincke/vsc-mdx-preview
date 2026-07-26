// packages/extension-host/src/features/module-runtime/dependencies/import-extractor.ts
// consolidated import/export specifier extraction from JavaScript/TypeScript code

import { init as initLexer, parse as parseImports } from 'es-module-lexer';
import {
  LogTags,
  type ModuleDependency,
  type ModuleDependencyKind,
} from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import { createTaggedLogger } from '../../../shared/logging/logger';
import { createLazyImport } from '../../../shared/utils/lazy-import';

// module-level tagged logger for import extraction
const log = createTaggedLogger(LogTags.IMPORT_EXTRACTOR);
const getBabelParser = createLazyImport(() =>
  import('@babel/core').then(({ transformAsync }) => ({ transformAsync }))
);

// lexer initialization state
let lexerInitialized = false;

// admit complete module keywords; the parser discards inert matches
const IMPORT_PATTERN = /(?:^|[^\w$])(?:import|export)(?![\w$])/;
const REQUIRE_PATTERN =
  /(?:^|[^\w$])(?:r|\\u(?:0072|\{0{0,4}72\}))(?:e|\\u(?:0065|\{0{0,4}65\}))(?:q|\\u(?:0071|\{0{0,4}71\}))(?:u|\\u(?:0075|\{0{0,4}75\}))(?:i|\\u(?:0069|\{0{0,4}69\}))(?:r|\\u(?:0072|\{0{0,4}72\}))(?:e|\\u(?:0065|\{0{0,4}65\}))(?![\w$])/;

function mightHaveRequires(code: string): boolean {
  return REQUIRE_PATTERN.test(code);
}

// fast pre-check: return true if code might have imports (worth parsing)
// return false if definitely no imports (skip parsing for performance)
function mightHaveImports(code: string): boolean {
  return IMPORT_PATTERN.test(code) || mightHaveRequires(code);
}

// ensure es-module-lexer is initialized
async function ensureLexerInitialized(): Promise<void> {
  if (!lexerInitialized) {
    await initLexer;
    lexerInitialized = true;
  }
}

const IMPORT_RUNTIME_PREFIX = '\0mdx-forge:import\0';

interface LocatedDependency {
  index: number;
  dependency: ModuleDependency;
}

// extract import specifiers from JavaScript/TypeScript code
// use es-module-lexer for ESM imports & a token scanner for CommonJS requires
export async function extractImportSpecifiers(code: string): Promise<string[]> {
  const dependencies = await extractModuleDependencies(code);
  return [...new Set(dependencies.map(({ specifier }) => specifier))];
}

export function createImportRuntimeRequest(specifier: string): string {
  return `${IMPORT_RUNTIME_PREFIX}${specifier}`;
}

function toModuleDependency(
  runtimeRequest: string,
  defaultKind: ModuleDependencyKind
): ModuleDependency {
  if (runtimeRequest.startsWith(IMPORT_RUNTIME_PREFIX)) {
    return {
      specifier: runtimeRequest.slice(IMPORT_RUNTIME_PREFIX.length),
      kind: 'import',
      runtimeRequest,
    };
  }
  return {
    specifier: runtimeRequest,
    kind: defaultKind,
    runtimeRequest:
      defaultKind === 'import'
        ? createImportRuntimeRequest(runtimeRequest)
        : runtimeRequest,
  };
}

export async function rewriteImportRuntimeRequests(
  code: string
): Promise<string> {
  if (!mightHaveImports(code)) {
    return code;
  }

  await ensureLexerInitialized();
  try {
    const [imports] = parseImports(code);
    const replacements = imports
      .filter(
        (imported) =>
          imported.n !== undefined &&
          imported.n !== null &&
          !imported.n.startsWith(IMPORT_RUNTIME_PREFIX)
      )
      .map((imported) => ({
        start: imported.d >= 0 ? imported.s : imported.s - 1,
        end: imported.d >= 0 ? imported.e : imported.e + 1,
        value: JSON.stringify(createImportRuntimeRequest(imported.n!)),
      }))
      .sort((left, right) => right.start - left.start);

    for (const replacement of replacements) {
      code =
        code.slice(0, replacement.start) +
        replacement.value +
        code.slice(replacement.end);
    }
    return code;
  } catch (error: unknown) {
    log.debug(`Import rewrite skipped: ${extractErrorMessage(error)}`);
    return code;
  }
}

export async function protectComputedDynamicImports(
  code: string
): Promise<{ code: string; marker: string | null }> {
  if (!mightHaveImports(code)) {
    return { code, marker: null };
  }

  await ensureLexerInitialized();
  try {
    const [imports] = parseImports(code);
    const computedImports = imports.filter(
      (imported) =>
        imported.d >= 0 && (imported.n === undefined || imported.n === null)
    );
    if (computedImports.length === 0) {
      return { code, marker: null };
    }

    let markerIndex = 0;
    let marker = `__mdxPreviewComputedImport${markerIndex}__`;
    while (code.includes(marker)) {
      markerIndex += 1;
      marker = `__mdxPreviewComputedImport${markerIndex}__`;
    }

    for (const imported of [...computedImports].sort(
      (left, right) => right.ss - left.ss
    )) {
      code =
        code.slice(0, imported.ss) +
        marker +
        code.slice(imported.ss + 'import'.length);
    }
    return { code, marker };
  } catch (error: unknown) {
    log.debug(
      `Computed import protection skipped: ${extractErrorMessage(error)}`
    );
    return { code, marker: null };
  }
}

export function restoreComputedDynamicImports(
  code: string,
  marker: string | null
): string {
  return marker ? code.split(marker).join('import') : code;
}

export async function rewriteLiteralDynamicImportsToRequire(
  code: string
): Promise<string> {
  if (!mightHaveImports(code)) {
    return code;
  }

  await ensureLexerInitialized();
  try {
    const [imports] = parseImports(code);
    const replacements = imports
      .filter(
        (imported) =>
          imported.d >= 0 && imported.n !== undefined && imported.n !== null
      )
      .map((imported) => {
        const request = JSON.stringify(imported.n!);
        return {
          start: imported.ss,
          end: imported.se,
          value:
            `Promise.resolve().then(() => { ` +
            `const loaded = require(${request}); ` +
            `if (loaded && loaded.__esModule) { return loaded; } ` +
            `const namespace = {}; ` +
            `if (loaded !== null && loaded !== undefined) { ` +
            `for (const key in loaded) { ` +
            `if (Object.prototype.hasOwnProperty.call(loaded, key)) { ` +
            `namespace[key] = loaded[key]; } } } ` +
            `namespace.default = loaded; return namespace; ` +
            `})`,
        };
      })
      .sort((left, right) => right.start - left.start);

    for (const replacement of replacements) {
      code =
        code.slice(0, replacement.start) +
        replacement.value +
        code.slice(replacement.end);
    }
    return code;
  } catch (error: unknown) {
    log.debug(`Dynamic import rewrite skipped: ${extractErrorMessage(error)}`);
    return code;
  }
}

// retain syntax kind & runtime request while deduping by raw specifier + kind
export async function extractModuleDependencies(
  code: string
): Promise<ModuleDependency[]> {
  // I.4: fast path - skip parsing if no import-like patterns detected
  if (!mightHaveImports(code)) {
    log.debug('fast path: no import patterns detected');
    return [];
  }

  await ensureLexerInitialized();

  try {
    const [imports] = parseImports(code);

    // extract ESM & CJS specifiers in source order
    const esmImports: LocatedDependency[] = [];
    for (const imported of imports) {
      if (imported.n !== undefined && imported.n !== null) {
        esmImports.push({
          index: imported.ss,
          dependency: toModuleDependency(imported.n, 'import'),
        });
      }
    }
    const requireDependencies = await extractRequireDependencies(
      code,
      new Set(
        imports
          .filter((imported) => imported.d === -1)
          .map((imported) => imported.se)
      )
    );
    return dedupeLocatedDependencies([...esmImports, ...requireDependencies]);
  } catch (error: unknown) {
    log.debug(
      `Lexer error, falling back to require: ${extractErrorMessage(error)}`
    );
    return dedupeLocatedDependencies(await extractRequireDependencies(code));
  }
}

// order all syntax forms together & keep the first occurrence
function dedupeLocatedDependencies(
  locatedDependencies: LocatedDependency[]
): ModuleDependency[] {
  locatedDependencies.sort((left, right) => left.index - right.index);
  const seen = new Set<string>();
  return locatedDependencies.flatMap(({ dependency }) => {
    const key = JSON.stringify([dependency.specifier, dependency.kind]);
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [dependency];
  });
}

interface BabelNode {
  type: string;
  start?: number | null;
  [key: string]: unknown;
}

function isBabelNode(value: unknown): value is BabelNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function readStaticCallArgument(node: BabelNode): string | null {
  const args = node.arguments;
  if (!Array.isArray(args) || args.length === 0 || !isBabelNode(args[0])) {
    return null;
  }

  const argument = args[0];
  if (argument.type === 'StringLiteral') {
    return typeof argument.value === 'string' && argument.value
      ? argument.value
      : null;
  }
  if (argument.type !== 'TemplateLiteral') {
    return null;
  }

  const expressions = argument.expressions;
  const quasis = argument.quasis;
  if (
    !Array.isArray(expressions) ||
    expressions.length !== 0 ||
    !Array.isArray(quasis) ||
    quasis.length !== 1 ||
    !isBabelNode(quasis[0])
  ) {
    return null;
  }
  const value = quasis[0].value;
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const cooked = (value as { cooked?: unknown }).cooked;
  return typeof cooked === 'string' && cooked ? cooked : null;
}

async function extractRequireDependenciesFromAst(
  code: string
): Promise<LocatedDependency[]> {
  const { transformAsync } = await getBabelParser();
  const dependencies: LocatedDependency[] = [];
  const collectCall = (
    node: BabelNode,
    hasLocalRequireBinding: boolean
  ): void => {
    const callee = node.callee;
    const specifier = readStaticCallArgument(node);
    if (
      hasLocalRequireBinding ||
      !isBabelNode(callee) ||
      callee.type !== 'Identifier' ||
      callee.name !== 'require' ||
      !specifier
    ) {
      return;
    }
    if (
      typeof node.start !== 'number' ||
      !Number.isSafeInteger(node.start) ||
      node.start < 0 ||
      node.start >= code.length
    ) {
      throw new Error('Babel require node has an invalid source position');
    }
    dependencies.push({
      index: node.start,
      dependency: toModuleDependency(specifier, 'require'),
    });
  };

  await transformAsync(code, {
    ast: false,
    code: false,
    babelrc: false,
    configFile: false,
    sourceType: 'unambiguous',
    parserOpts: {
      allowAwaitOutsideFunction: true,
      allowNewTargetOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      errorRecovery: true,
      plugins: [
        'jsx',
        'typescript',
        ['decorators', { version: '2023-07' }] as never,
      ],
    },
    plugins: [
      () => ({
        visitor: {
          CallExpression(path) {
            collectCall(
              path.node as unknown as BabelNode,
              path.scope.getBinding('require') !== undefined
            );
          },
          OptionalCallExpression(path) {
            collectCall(
              path.node as unknown as BabelNode,
              path.scope.getBinding('require') !== undefined
            );
          },
        },
      }),
    ],
  });
  return dependencies;
}

interface QuotedEnd {
  end: number;
  terminated: boolean;
}

interface RequireParseResult {
  dependency: LocatedDependency;
  end: number;
}

type ParenthesisKind =
  'control' | 'function-declaration' | 'function-expression' | 'normal';

type BraceKind = 'block' | 'expression-block' | 'object';

interface ScannerContext {
  canStartRegex: boolean;
  statementStart: boolean;
  lineStart: boolean;
  previousToken: string | null;
  labelCandidate: boolean;
  lineTerminatorBoundary: 'declaration' | 'restricted' | null;
  pendingParenthesis: ParenthesisKind | null;
  parentheses: ParenthesisKind[];
  braces: BraceKind[];
  pendingClasses: {
    kind: 'block' | 'expression-block';
    parenthesisDepth: number;
    braceDepth: number;
  }[];
}

const CONTROL_PAREN_KEYWORDS = new Set([
  'catch',
  'for',
  'if',
  'switch',
  'while',
  'with',
]);

const REGEX_PREFIX_KEYWORDS = new Set([
  'await',
  'case',
  'const',
  'delete',
  'else',
  'extends',
  'in',
  'instanceof',
  'let',
  'new',
  'of',
  'return',
  'throw',
  'typeof',
  'var',
  'void',
  'yield',
]);

const BLOCK_PREFIX_KEYWORDS = new Set(['do', 'else', 'finally', 'try']);
const DECLARATION_PREFIX_KEYWORDS = new Set(['async', 'default', 'export']);
const RESTRICTED_STATEMENT_KEYWORDS = new Set([
  'break',
  'continue',
  'debugger',
]);

function isIdentifierStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char) || (char?.charCodeAt(0) ?? 0) > 0x7f;
}

function isIdentifierPart(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char) || (char?.charCodeAt(0) ?? 0) > 0x7f;
}

interface IdentifierToken {
  end: number;
  value: string;
}

function readUnicodeIdentifierEscape(
  code: string,
  start: number
): IdentifierToken | null {
  if (!code.startsWith('\\u', start)) {
    return null;
  }

  if (code[start + 2] === '{') {
    const close = code.indexOf('}', start + 3);
    const hex = close === -1 ? '' : code.slice(start + 3, close);
    if (!/^[0-9a-fA-F]{1,6}$/.test(hex)) {
      return null;
    }
    const codePoint = Number.parseInt(hex, 16);
    if (codePoint > 0x10ffff) {
      return null;
    }
    return { end: close + 1, value: String.fromCodePoint(codePoint) };
  }

  const hex = code.slice(start + 2, start + 6);
  if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
    return null;
  }
  return {
    end: start + 6,
    value: String.fromCharCode(Number.parseInt(hex, 16)),
  };
}

function readIdentifierToken(
  code: string,
  start: number
): IdentifierToken | null {
  let index = start;
  let value = '';
  while (index < code.length) {
    const escaped = readUnicodeIdentifierEscape(code, index);
    const part = escaped?.value ?? code[index];
    const isValidPart =
      value.length === 0 ? isIdentifierStart(part) : isIdentifierPart(part);
    if (!isValidPart) {
      break;
    }
    value += part;
    index = escaped?.end ?? index + 1;
  }
  return value ? { end: index, value } : null;
}

// stop malformed quoted text at a line boundary so later code can recover
function findQuotedEnd(
  code: string,
  start: number,
  quote: "'" | '"'
): QuotedEnd {
  for (let index = start + 1; index < code.length; index += 1) {
    if (code[index] === '\\') {
      index += code[index + 1] === '\r' && code[index + 2] === '\n' ? 2 : 1;
    } else if (code[index] === quote) {
      return { end: index, terminated: true };
    } else if (/[\n\r\u2028\u2029]/.test(code[index])) {
      return { end: index, terminated: false };
    }
  }
  return { end: code.length, terminated: false };
}

function findStaticTemplateEnd(code: string, start: number): QuotedEnd {
  for (let index = start + 1; index < code.length; index += 1) {
    if (code[index] === '\\') {
      index += 1;
    } else if (code[index] === '`') {
      return { end: index, terminated: true };
    } else if (code[index] === '$' && code[index + 1] === '{') {
      return { end: index, terminated: false };
    }
  }
  return { end: code.length, terminated: false };
}

function findRegexEnd(code: string, start: number): QuotedEnd {
  let inCharacterClass = false;
  for (let index = start + 1; index < code.length; index += 1) {
    const char = code[index];
    if (char === '\\') {
      if (/[\n\r\u2028\u2029]/.test(code[index + 1] ?? '')) {
        return { end: index + 1, terminated: false };
      }
      index += 1;
      continue;
    }
    if (/[\n\r\u2028\u2029]/.test(char)) {
      return { end: index, terminated: false };
    }
    if (char === '[') {
      inCharacterClass = true;
      continue;
    }
    if (char === ']' && inCharacterClass) {
      inCharacterClass = false;
      continue;
    }
    if (char === '/' && !inCharacterClass) {
      let end = index + 1;
      while (isIdentifierPart(code[end] ?? '')) {
        end += 1;
      }
      return { end, terminated: true };
    }
  }
  return { end: code.length, terminated: false };
}

function skipTrivia(code: string, start: number): number {
  let index = start;
  while (index < code.length) {
    if (/\s/.test(code[index])) {
      index += 1;
      continue;
    }
    if (code.startsWith('//', index)) {
      const lineEnd = code.indexOf('\n', index + 2);
      index = lineEnd === -1 ? code.length : lineEnd + 1;
      continue;
    }
    if (code.startsWith('/*', index)) {
      const commentEnd = code.indexOf('*/', index + 2);
      index = commentEnd === -1 ? code.length : commentEnd + 2;
      continue;
    }
    break;
  }
  return index;
}

// extract static bare require() calls while ignoring comments & string contents
function decodeQuotedValue(value: string): string {
  return value.replace(
    /\\(?:(\r\n?|[\n\u2028\u2029])|u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(0|.))/g,
    (
      _match,
      continuation: string,
      braced: string,
      unicode: string,
      hex: string,
      escaped: string
    ) => {
      if (continuation) {
        return '';
      }
      if (braced) {
        return String.fromCodePoint(Number.parseInt(braced, 16));
      }
      if (unicode) {
        return String.fromCharCode(Number.parseInt(unicode, 16));
      }
      if (hex) {
        return String.fromCharCode(Number.parseInt(hex, 16));
      }
      const simpleEscapes: Record<string, string> = {
        '0': '\0',
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t',
        v: '\v',
      };
      return simpleEscapes[escaped] ?? escaped;
    }
  );
}

function parseRequireCall(
  code: string,
  start: number,
  identifierEnd: number
): RequireParseResult | null {
  let cursor = skipTrivia(code, identifierEnd);
  if (code[cursor] !== '(') {
    return null;
  }

  cursor = skipTrivia(code, cursor + 1);
  const quote = code[cursor];
  if (quote !== "'" && quote !== '"' && quote !== '`') {
    return null;
  }

  const quotedEnd =
    quote === '`'
      ? findStaticTemplateEnd(code, cursor)
      : findQuotedEnd(code, cursor, quote);
  if (!quotedEnd.terminated) {
    return null;
  }

  const runtimeRequest = decodeQuotedValue(
    code.slice(cursor + 1, quotedEnd.end)
  );
  cursor = skipTrivia(code, quotedEnd.end + 1);
  if (code[cursor] !== ')' || !runtimeRequest) {
    return null;
  }

  return {
    dependency: {
      index: start,
      dependency: toModuleDependency(runtimeRequest, 'require'),
    },
    end: cursor + 1,
  };
}

function createScannerContext(): ScannerContext {
  return {
    canStartRegex: true,
    statementStart: true,
    lineStart: true,
    previousToken: null,
    labelCandidate: false,
    lineTerminatorBoundary: null,
    pendingParenthesis: null,
    parentheses: [],
    braces: [],
    pendingClasses: [],
  };
}

function scanTemplateLiteral(
  code: string,
  start: number,
  dependencies: LocatedDependency[],
  esmDeclarationEnds: ReadonlySet<number>
): number {
  for (let index = start + 1; index < code.length; index += 1) {
    if (code[index] === '\\') {
      index += 1;
      continue;
    }
    if (code[index] === '`') {
      return index + 1;
    }
    if (code[index] === '$' && code[index + 1] === '{') {
      index =
        scanCode(code, index + 2, dependencies, esmDeclarationEnds, true) - 1;
    }
  }
  return code.length;
}

function scanIdentifier(
  code: string,
  start: number,
  dependencies: LocatedDependency[],
  context: ScannerContext
): number {
  const atStatementStart = context.statementStart;
  const token = readIdentifierToken(code, start);
  if (!token) {
    return start + 1;
  }
  const { end, value: identifier } = token;
  if (
    identifier === 'require' &&
    context.previousToken !== '.' &&
    context.previousToken !== '?.'
  ) {
    const parsed = parseRequireCall(code, start, end);
    if (parsed) {
      dependencies.push(parsed.dependency);
      context.canStartRegex = false;
      context.statementStart = false;
      context.previousToken = ')';
      context.labelCandidate = false;
      context.pendingParenthesis = null;
      return parsed.end;
    }
  }

  context.labelCandidate = false;
  if (CONTROL_PAREN_KEYWORDS.has(identifier)) {
    context.pendingParenthesis = 'control';
    context.canStartRegex = true;
  } else if (identifier === 'function') {
    context.pendingParenthesis = atStatementStart
      ? 'function-declaration'
      : 'function-expression';
    context.canStartRegex = true;
  } else if (identifier === 'class') {
    context.pendingClasses.push({
      kind: atStatementStart ? 'block' : 'expression-block',
      parenthesisDepth: context.parentheses.length,
      braceDepth: context.braces.length,
    });
    context.canStartRegex = false;
  } else if (atStatementStart && DECLARATION_PREFIX_KEYWORDS.has(identifier)) {
    context.canStartRegex = true;
    context.statementStart = true;
    context.previousToken = identifier;
    return end;
  } else if (
    atStatementStart &&
    RESTRICTED_STATEMENT_KEYWORDS.has(identifier)
  ) {
    context.canStartRegex = false;
    context.lineTerminatorBoundary = 'restricted';
  } else if (REGEX_PREFIX_KEYWORDS.has(identifier)) {
    context.canStartRegex = true;
  } else {
    context.canStartRegex = false;
    context.labelCandidate = atStatementStart;
  }
  context.statementStart = BLOCK_PREFIX_KEYWORDS.has(identifier);
  context.previousToken = identifier;
  return end;
}

function scanPunctuation(
  code: string,
  index: number,
  context: ScannerContext,
  stopAtTemplateExpression: boolean
): number | null {
  const char = code[index];
  const pair = code.slice(index, index + 2);
  const triple = code.slice(index, index + 3);

  if (char === '}' && stopAtTemplateExpression && context.braces.length === 0) {
    return null;
  }
  if (char === ':' && context.labelCandidate) {
    context.canStartRegex = true;
    context.statementStart = true;
    context.previousToken = ':label';
    context.labelCandidate = false;
    return index + 1;
  }
  context.labelCandidate = false;
  if (char === '(') {
    const kind = context.pendingParenthesis ?? 'normal';
    context.parentheses.push(kind);
    context.pendingParenthesis = null;
    context.canStartRegex = true;
    context.statementStart = false;
    context.previousToken = '(';
    return index + 1;
  }
  if (char === ')') {
    const kind = context.parentheses.pop() ?? 'normal';
    context.canStartRegex = kind === 'control';
    context.statementStart = kind === 'control';
    context.previousToken = kind === 'normal' ? ')' : `)${kind}`;
    return index + 1;
  }
  if (char === '{') {
    const previous = context.previousToken;
    const pendingClass = context.pendingClasses.at(-1);
    const classKind =
      pendingClass &&
      pendingClass.parenthesisDepth === context.parentheses.length &&
      pendingClass.braceDepth === context.braces.length
        ? context.pendingClasses.pop()?.kind
        : null;
    const kind: BraceKind =
      classKind ??
      (previous === '=>'
        ? 'expression-block'
        : previous === ')function-expression'
          ? 'expression-block'
          : previous === ')function-declaration' ||
              previous === ')control' ||
              context.statementStart ||
              (previous !== null && BLOCK_PREFIX_KEYWORDS.has(previous))
            ? 'block'
            : 'object');
    context.braces.push(kind);
    context.canStartRegex = true;
    context.statementStart = kind === 'block';
    context.previousToken = '{';
    return index + 1;
  }
  if (char === '}') {
    const kind = context.braces.pop() ?? 'block';
    context.canStartRegex = kind === 'block';
    context.statementStart = kind === 'block';
    context.previousToken = '}';
    return index + 1;
  }
  if (char === '[') {
    context.canStartRegex = true;
    context.statementStart = false;
    context.previousToken = '[';
    return index + 1;
  }
  if (char === ']') {
    context.canStartRegex = false;
    context.statementStart = false;
    context.previousToken = ']';
    return index + 1;
  }
  if (char === ';') {
    context.canStartRegex = true;
    context.statementStart = true;
    context.previousToken = ';';
    context.lineTerminatorBoundary = null;
    context.pendingParenthesis = null;
    return index + 1;
  }
  if (triple === '...') {
    context.canStartRegex = true;
    context.statementStart = false;
    context.previousToken = '...';
    return index + 3;
  }
  if (pair === '=>') {
    context.canStartRegex = true;
    context.statementStart = false;
    context.previousToken = '=>';
    return index + 2;
  }
  if (pair === '++' || pair === '--') {
    context.statementStart = false;
    context.previousToken = pair;
    return index + 2;
  }
  if (pair === '?.') {
    context.canStartRegex = false;
    context.statementStart = false;
    context.previousToken = '?.';
    return index + 2;
  }
  if (char === '.') {
    context.canStartRegex = false;
    context.statementStart = false;
    context.previousToken = '.';
    return index + 1;
  }

  context.canStartRegex = true;
  context.statementStart = false;
  context.previousToken = char;
  if (char === '=') {
    context.pendingParenthesis = null;
  }
  return index + 1;
}

function finishLineTerminatedStatement(context: ScannerContext): void {
  context.lineStart = true;
  if (context.lineTerminatorBoundary) {
    context.canStartRegex = true;
    context.statementStart = true;
    context.previousToken = ';';
    context.labelCandidate = false;
    context.lineTerminatorBoundary = null;
    context.pendingParenthesis = null;
  }
}

function skipLineComment(
  code: string,
  start: number,
  context: ScannerContext
): number {
  for (let index = start; index < code.length; index += 1) {
    if (/[\n\r\u2028\u2029]/.test(code[index])) {
      finishLineTerminatedStatement(context);
      return index + 1;
    }
  }
  return code.length;
}

function scanCode(
  code: string,
  start: number,
  dependencies: LocatedDependency[],
  esmDeclarationEnds: ReadonlySet<number>,
  stopAtTemplateExpression: boolean = false
): number {
  const context = createScannerContext();

  for (let index = start; index < code.length;) {
    const char = code[index];
    const nextChar = code[index + 1];

    if (esmDeclarationEnds.has(index)) {
      context.lineTerminatorBoundary = 'declaration';
    }
    if (/\s/.test(char)) {
      if (/[\n\r\u2028\u2029]/.test(char)) {
        finishLineTerminatedStatement(context);
      }
      index += 1;
      continue;
    }
    if (index === 0 && char === '#' && nextChar === '!') {
      index = skipLineComment(code, index + 2, context);
      continue;
    }
    if (code.startsWith('<!--', index)) {
      index = skipLineComment(code, index + 4, context);
      continue;
    }
    if (context.lineStart && code.startsWith('-->', index)) {
      index = skipLineComment(code, index + 3, context);
      continue;
    }
    if (char === '/' && nextChar === '/') {
      index = skipLineComment(code, index + 2, context);
      continue;
    }
    if (char === '/' && nextChar === '*') {
      const commentEnd = code.indexOf('*/', index + 2);
      if (commentEnd === -1) {
        return code.length;
      }
      if (/[\n\r\u2028\u2029]/.test(code.slice(index + 2, commentEnd))) {
        finishLineTerminatedStatement(context);
      }
      index = commentEnd + 2;
      continue;
    }
    context.lineStart = false;
    if (
      context.lineTerminatorBoundary === 'declaration' ||
      (context.lineTerminatorBoundary === 'restricted' &&
        !isIdentifierStart(char) &&
        !readUnicodeIdentifierEscape(code, index))
    ) {
      context.lineTerminatorBoundary = null;
    }
    if (char === "'" || char === '"') {
      const quotedEnd = findQuotedEnd(code, index, char);
      context.canStartRegex = false;
      context.statementStart = false;
      context.previousToken = 'literal';
      index = quotedEnd.terminated ? quotedEnd.end + 1 : quotedEnd.end;
      continue;
    }
    if (char === '`') {
      index = scanTemplateLiteral(
        code,
        index,
        dependencies,
        esmDeclarationEnds
      );
      context.canStartRegex = false;
      context.statementStart = false;
      context.previousToken = 'literal';
      continue;
    }
    if (char === '/') {
      if (context.canStartRegex) {
        const regexEnd = findRegexEnd(code, index);
        context.canStartRegex = false;
        context.statementStart = false;
        context.previousToken = 'literal';
        index = regexEnd.end;
      } else {
        context.canStartRegex = true;
        context.statementStart = false;
        context.previousToken = '/';
        index += nextChar === '=' ? 2 : 1;
      }
      continue;
    }
    if (isIdentifierStart(char) || readUnicodeIdentifierEscape(code, index)) {
      index = scanIdentifier(code, index, dependencies, context);
      continue;
    }
    if (/[0-9]/.test(char)) {
      index += 1;
      while (/[A-Za-z0-9_.]/.test(code[index] ?? '')) {
        index += 1;
      }
      context.canStartRegex = false;
      context.statementStart = false;
      context.previousToken = 'literal';
      continue;
    }

    const nextIndex = scanPunctuation(
      code,
      index,
      context,
      stopAtTemplateExpression
    );
    if (nextIndex === null) {
      return index + 1;
    }
    index = nextIndex;
  }

  return code.length;
}

function extractRequireDependenciesWithScanner(
  code: string,
  esmDeclarationEnds: ReadonlySet<number> = new Set()
): LocatedDependency[] {
  const dependencies: LocatedDependency[] = [];
  scanCode(code, 0, dependencies, esmDeclarationEnds);
  return dependencies;
}

function isParserResourceExhaustion(error: unknown): boolean {
  return (
    error instanceof RangeError ||
    /call stack|stack overflow|too deeply nested/i.test(
      extractErrorMessage(error)
    )
  );
}

async function extractRequireDependencies(
  code: string,
  esmDeclarationEnds: ReadonlySet<number> = new Set()
): Promise<LocatedDependency[]> {
  if (!mightHaveRequires(code)) {
    return [];
  }
  try {
    return await extractRequireDependenciesFromAst(code);
  } catch (error: unknown) {
    if (isParserResourceExhaustion(error)) {
      log.debug(`Babel require parse exhausted resources; failing closed`);
      return [];
    }
    log.debug(
      `Babel require parse failed, using scanner: ${extractErrorMessage(error)}`
    );
    return extractRequireDependenciesWithScanner(code, esmDeclarationEnds);
  }
}
