// tests/shared/constant-parity.test.ts
// verify cross-repo constant alignment & theme label completeness
// prevent runtime, settings, preload ID & framework union drift

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  EXTENSION_DISPLAY_NAME,
  SHIM_LOAD_MAX_RETRIES,
  SHIM_LOAD_RETRY_DELAY_MS,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  MERMAID_THEME_LABELS,
  PRELOADED_MODULE_IDS,
  FRAMEWORK_IDS,
} from '@mdx-preview/contracts';
import { CODE_COPY_FEEDBACK_DURATION_MS } from '../../packages/webview-client/src/app/constants';
import {
  SAFE_PREVIEW_CLASS,
  TRUSTED_PREVIEW_CLASS,
} from '../../packages/webview-client/src/features/preview/safe/security/previewClassNames';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// resolve a file from installed node_modules or sibling repo checkout
// prefer src (dev/sibling checkout); fall back to shipped dist (published pkg ships dist only, e.g. CI)
function resolveFromMdxForge(srcRelPath: string, distRelPath: string): string {
  const roots = [
    path.resolve(HERE, '../../node_modules/mdx-forge'),
    path.resolve(HERE, '../../../mdx-forge'),
  ];
  for (const relPath of [srcRelPath, distRelPath]) {
    for (const root of roots) {
      const candidate = path.resolve(root, relPath);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  throw new Error(`could not resolve mdx-forge file: ${srcRelPath}`);
}

// extract a single quoted string literal value for the given object key
function extractQuotedValue(source: string, key: string): string {
  const re = new RegExp(`${key}:\\s*'((?:\\\\.|[^'\\\\])*)'`);
  const match = source.match(re);
  if (!match) {
    throw new Error(`could not extract '${key}' literal`);
  }
  return match[1];
}

describe('cross-repo constant parity', () => {
  it('contracts shim retry constants have expected canonical values', () => {
    // these are the canonical values both mdx-forge & vsc-mdx-preview must use
    // mdx-forge's own tests verify its constants match these values
    // see: mdx-forge/tests/browser/constants-contract.test.ts
    expect(SHIM_LOAD_MAX_RETRIES).toBe(3);
    expect(SHIM_LOAD_RETRY_DELAY_MS).toBe(200);
  });

  it('EXTENSION_DISPLAY_NAME is single-sourced from contracts', () => {
    // brand string for the webview HTML-export fallback title
    expect(EXTENSION_DISPLAY_NAME).toBe('MDX Preview');
  });

  it('code copy feedback duration matches mdx-forge canonical value', () => {
    // must match: mdx-forge/src/components/internal/constants.ts
    // see: mdx-forge/tests/components/constants-contract.test.ts
    expect(CODE_COPY_FEEDBACK_DURATION_MS).toBe(2000);
  });
});

describe('preloaded module ID parity (Finding 15)', () => {
  // ! cross-repo parity: mdx-forge/src/browser/types.ts declares its own PRELOADED_MODULE_IDS
  // these canonical values must stay in sync across both repos

  it('PRELOADED_MODULE_IDS keys match expected canonical set', () => {
    const expectedKeys = [
      'react',
      'reactDom',
      'reactDomClient',
      'jsxRuntime',
      'mdxReact',
      'vscodeLayout',
    ];
    expect(Object.keys(PRELOADED_MODULE_IDS).sort()).toEqual(
      expectedKeys.sort()
    );
  });

  it('PRELOADED_MODULE_IDS values match mdx-forge canonical values', () => {
    // these exact strings are declared in mdx-forge/src/browser/types.ts
    // if mdx-forge changes these, this test must be updated
    expect(PRELOADED_MODULE_IDS.react).toBe('npm://react@18');
    expect(PRELOADED_MODULE_IDS.reactDom).toBe('npm://react-dom@18');
    expect(PRELOADED_MODULE_IDS.reactDomClient).toBe(
      'npm://react-dom/client@18'
    );
    expect(PRELOADED_MODULE_IDS.jsxRuntime).toBe('npm://react/jsx-runtime@18');
    expect(PRELOADED_MODULE_IDS.mdxReact).toBe('npm://@mdx-js/react@3');
    expect(PRELOADED_MODULE_IDS.vscodeLayout).toBe(
      'npm://vscode-markdown-layout@0.1.0'
    );
  });
});

describe('framework union parity (Finding 15)', () => {
  // ! cross-repo parity: mdx-forge/src/browser/types.ts & mdx-forge/src/components/registry/types.ts
  // declare their own Framework/FrameworkId unions

  it('FRAMEWORK_IDS matches expected canonical set', () => {
    const expected = ['generic', 'docusaurus', 'nextjs', 'starlight', 'nextra'];
    expect([...FRAMEWORK_IDS].sort()).toEqual(expected.sort());
  });
});

describe('theme label completeness', () => {
  it('PREVIEW_THEME_LABELS keys match PREVIEW_THEMES', () => {
    expect(Object.keys(PREVIEW_THEME_LABELS).sort()).toEqual(
      [...PREVIEW_THEMES].sort()
    );
  });

  it('CODE_BLOCK_THEME_LABELS keys match CODE_BLOCK_THEMES', () => {
    expect(Object.keys(CODE_BLOCK_THEME_LABELS).sort()).toEqual(
      [...CODE_BLOCK_THEMES].sort()
    );
  });
});

describe('code-block copy icon cross-repo parity', () => {
  // ! cross-repo duplicate: CodeBlock COPY_ICONS must stay byte-identical w/
  // mdx-forge GITHUB_ICONS.copy/.check (no shared import across the seam)
  it('COPY_ICONS copy/check match mdx-forge GITHUB_ICONS', () => {
    const codeBlockSource = fs.readFileSync(
      path.resolve(
        HERE,
        '../../packages/webview-client/src/features/code-block/ui/CodeBlock.tsx'
      ),
      'utf8'
    );
    const iconsSource = fs.readFileSync(
      resolveFromMdxForge(
        'src/internal/icons.ts',
        'dist/esm/internal/icons.js'
      ),
      'utf8'
    );

    expect(extractQuotedValue(codeBlockSource, 'copy')).toBe(
      extractQuotedValue(iconsSource, 'copy')
    );
    expect(extractQuotedValue(codeBlockSource, 'check')).toBe(
      extractQuotedValue(iconsSource, 'check')
    );
  });
});

describe('preview container class-name constants', () => {
  it('SAFE_PREVIEW_CLASS / TRUSTED_PREVIEW_CLASS have canonical values', () => {
    expect(SAFE_PREVIEW_CLASS).toBe('mdx-safe-preview');
    expect(TRUSTED_PREVIEW_CLASS).toBe('mdx-trusted-preview');
  });
});
