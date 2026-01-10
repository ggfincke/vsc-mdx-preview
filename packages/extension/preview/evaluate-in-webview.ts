// packages/extension/preview/evaluate-in-webview.ts
// * evaluate MDX content in webview (Trusted Mode w/ code execution or Safe Mode w/ static HTML)

import * as fs from 'fs';
import { performance } from 'perf_hooks';
import { init as initLexer, parse as parseImports } from 'es-module-lexer';

import { transformEntry } from '../module-fetcher/transform';
import { Preview } from './preview-manager';
import { TrustManager } from '../security/TrustManager';
import { compileToSafeHTML } from '../transpiler/mdx/mdx-safe';
import { error as logError, debug } from '../logging';

// initialize es-module-lexer once
let lexerInitialized = false;
async function ensureLexerInitialized(): Promise<void> {
  if (!lexerInitialized) {
    await initLexer;
    lexerInitialized = true;
  }
}

// extract imports from code using es-module-lexer (ESM) w/ CJS fallback
async function extractImports(code: string): Promise<string[]> {
  await ensureLexerInitialized();

  try {
    const [imports] = parseImports(code);
    const esmImports = imports
      .map((imp) => imp.n)
      .filter((name): name is string => name !== undefined && name !== null);

    // ESM lexer returns empty for CJS code, so also try regex fallback
    if (esmImports.length === 0) {
      const requireMatches = code.matchAll(
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
      );
      return Array.from(requireMatches, (m) => m[1]);
    }

    return esmImports;
  } catch {
    // fallback for code that can't be parsed
    const requireMatches = code.matchAll(
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
    );
    return Array.from(requireMatches, (m) => m[1]);
  }
}

// * evaluate content in webview (Trusted Mode: compiled code | Safe Mode: static HTML)
export default async function evaluateInWebview(
  preview: Preview,
  text: string,
  fsPath: string
): Promise<void> {
  debug(`[EVALUATE] evaluateInWebview called for: ${fsPath}`);
  const { webviewHandle } = preview;
  // use document-specific trust check (includes remote/scheme checks)
  const trustState = TrustManager.getInstance().getStateForDocument(
    preview.doc.uri
  );
  debug(
    `[EVALUATE] Trust state: canExecute=${trustState.canExecute}, workspaceTrusted=${trustState.workspaceTrusted}, scriptsEnabled=${trustState.scriptsEnabled}`
  );

  try {
    performance.mark('preview/start');

    debug('[EVALUATE] Waiting for webviewHandshakePromise...');
    await preview.webviewHandshakePromise;
    debug('[EVALUATE] Handshake complete!');

    // push initial config after handshake
    preview.onWebviewReady();

    // send trust state to webview
    debug('[EVALUATE] Sending trust state to webview');
    webviewHandle.setTrustState(trustState);

    if (trustState.canExecute) {
      // trusted mode: full code evaluation
      debug('[EVALUATE] Using Trusted Mode');
      await evaluateTrusted(preview, text, fsPath);
    } else {
      // safe mode: static HTML rendering
      debug('[EVALUATE] Using Safe Mode');
      await evaluateSafe(preview, text);
    }
    debug('[EVALUATE] evaluateInWebview complete');
  } catch (error) {
    debug(
      `[EVALUATE] ERROR: ${error instanceof Error ? error.message : String(error)}`
    );
    logError('Preview evaluation failed', error);
    if (webviewHandle) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      webviewHandle.showPreviewError({ message, stack });
    }
  }
}

// evaluate in Trusted Mode (full code execution)
async function evaluateTrusted(
  preview: Preview,
  text: string,
  fsPath: string
): Promise<void> {
  debug('[EVALUATE] evaluateTrusted called');
  const { webviewHandle } = preview;

  debug('[EVALUATE] Transforming entry...');
  const { code, frontmatter } = await transformEntry(text, fsPath, preview);
  debug(`[EVALUATE] Transform complete, code length: ${code.length}`);

  // use async fs.promises.realpath instead of sync version
  const entryFilePath = await fs.promises.realpath(fsPath);
  // use es-module-lexer for ESM-first import extraction
  const entryFileDependencies = await extractImports(code);
  debug(`[EVALUATE] Dependencies: ${entryFileDependencies.join(', ')}`);

  // update dependency watcher with local imports
  preview.updateDependencies(entryFileDependencies);

  // push theme state w/ frontmatter overrides
  if (frontmatter) {
    preview.pushThemeState(frontmatter);
  }

  debug('[EVALUATE] Calling webviewHandle.updatePreview');
  webviewHandle.updatePreview(code, entryFilePath, entryFileDependencies);
  debug('[EVALUATE] updatePreview called');
}

// evaluate in Safe Mode (static HTML only, no code execution)
async function evaluateSafe(preview: Preview, text: string): Promise<void> {
  debug('[EVALUATE] evaluateSafe called');
  const { webviewHandle } = preview;

  // compile MDX to safe HTML (no code execution)
  debug('[EVALUATE] Compiling to safe HTML...');
  const { html, frontmatter } = await compileToSafeHTML(
    text,
    preview.mdxPreviewConfig
  );
  debug(`[EVALUATE] Safe HTML compiled, length: ${html.length}`);

  // push theme state w/ frontmatter overrides
  if (frontmatter) {
    preview.pushThemeState(frontmatter);
  }

  debug('[EVALUATE] Calling webviewHandle.updatePreviewSafe');
  webviewHandle.updatePreviewSafe(html);
  debug('[EVALUATE] updatePreviewSafe called');
}
