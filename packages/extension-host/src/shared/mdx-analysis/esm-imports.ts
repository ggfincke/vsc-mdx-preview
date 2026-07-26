// packages/extension-host/src/shared/mdx-analysis/esm-imports.ts
// parse MDX ESM imports & describe import/export statements

import type {
  ImportDeclaration,
  ImportSpecifier,
  Literal,
  Program,
} from 'estree';

// single named-import binding (local name + optional alias source)
export interface NamedBinding {
  // imported name (before `as`)
  imported: string;
  // local binding name (after `as`, else == imported)
  local: string;
}

// structured form of a single `import ... from 'path'` statement
export interface ParsedImport {
  // default import local name (if any)
  defaultImport?: string;
  // namespace import local name from `* as Foo` (if any)
  namespaceImport?: string;
  // named bindings from `{ ... }` (raw, unfiltered)
  named: NamedBinding[];
  // raw inner text of `{ ... }` (trimmed) for display contract
  namedRaw?: string;
  // module specifier
  path: string;
}

// match default, named, aliased & namespace import statements
const importRegex =
  /import\s+(?:(\w+)|(?:\{([^}]+)\})|(?:\*\s+as\s+(\w+)))\s+from\s+['"]([^'"]+)['"]/g;

// parse all import statements in an ESM node value into structured data
export function parseEsmImports(
  value: string,
  estree?: Program | null
): ParsedImport[] {
  const estreeImports = estree ? parseEstreeImports(estree) : [];
  if (estreeImports.length > 0) {
    return estreeImports;
  }

  const results: ParsedImport[] = [];

  // reset shared regex state (module-level global regex)
  importRegex.lastIndex = 0;

  let match;
  while ((match = importRegex.exec(value)) !== null) {
    const defaultImport = match[1];
    const namedImports = match[2];
    const namespaceImport = match[3];
    const path = match[4];

    const named: NamedBinding[] = [];
    if (namedImports) {
      const parts = namedImports.split(',').map((s) => s.trim());
      for (const part of parts) {
        if (!part) {
          continue;
        }
        const asMatch = part.match(/(\w+)\s+as\s+(\w+)/);
        if (asMatch) {
          named.push({ imported: asMatch[1], local: asMatch[2] });
        } else {
          named.push({ imported: part, local: part });
        }
      }
    }

    results.push({
      defaultImport: defaultImport || undefined,
      namespaceImport: namespaceImport || undefined,
      named,
      namedRaw: namedImports ? namedImports.trim() : undefined,
      path,
    });
  }

  return results;
}

function parseEstreeImports(program: Program): ParsedImport[] {
  const results: ParsedImport[] = [];
  for (const stmt of program.body) {
    if (stmt.type !== 'ImportDeclaration') {
      continue;
    }
    results.push(parseEstreeImport(stmt));
  }
  return results;
}

function parseEstreeImport(stmt: ImportDeclaration): ParsedImport {
  const named: NamedBinding[] = [];
  let defaultImport: string | undefined;
  let namespaceImport: string | undefined;

  for (const spec of stmt.specifiers) {
    if (spec.type === 'ImportDefaultSpecifier') {
      defaultImport = spec.local.name;
      continue;
    }
    if (spec.type === 'ImportNamespaceSpecifier') {
      namespaceImport = spec.local.name;
      continue;
    }
    named.push({
      imported: importName(spec.imported),
      local: spec.local.name,
    });
  }

  return {
    defaultImport,
    namespaceImport,
    named,
    namedRaw: named.map((binding) => binding.local).join(', ') || undefined,
    path: literalString(stmt.source),
  };
}

function importName(imported: ImportSpecifier['imported']): string {
  if (imported.type === 'Identifier') {
    return imported.name;
  }
  return literalString(imported);
}

function literalString(literal: Literal): string {
  return typeof literal.value === 'string'
    ? literal.value
    : String(literal.value ?? '');
}

// extract a display name from an import/export statement (symbol-tree contract)
export function describeEsmStatement(value: string): string {
  // import Foo from 'path'
  const defaultMatch = value.match(/import\s+(\w+)\s+from/);
  if (defaultMatch) {
    return defaultMatch[1];
  }

  // import { Foo, Bar } from 'path'
  const namedMatch = value.match(/import\s+\{([^}]+)\}\s+from/);
  if (namedMatch) {
    return namedMatch[1].trim();
  }

  // import * as Foo from 'path'
  const namespaceMatch = value.match(/import\s+\*\s+as\s+(\w+)\s+from/);
  if (namespaceMatch) {
    return namespaceMatch[1];
  }

  // export const foo =
  const exportMatch = value.match(
    /export\s+(?:const|let|var|function|class)\s+(\w+)/
  );
  if (exportMatch) {
    return exportMatch[1];
  }

  // export default
  if (value.includes('export default')) {
    return 'default';
  }

  // fallback: first line truncated
  return value.split('\n')[0].substring(0, 40);
}
