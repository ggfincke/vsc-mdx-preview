#!/usr/bin/env node
// packages/extension/test/shiki-smoke.mjs
// smoke test: verify MDX w/ code blocks compiles without "raw node" error
// run after build: node packages/extension/test/shiki-smoke.mjs

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '../../../build/extension/transpiler/mdx');

async function main() {
  console.log(
    'Shiki smoke test: verifying MDX compilation with code blocks...'
  );

  // import compiled mdx.js from build output
  const { mdxTranspileAsync } = await import(join(buildDir, 'mdx.js'));

  const mdx = `# Test

\`\`\`typescript
const x: number = 1;
const y = x + 2;
\`\`\`

Some text after code.
`;

  // mock Preview object w/ minimal config
  const mockPreview = {
    doc: { uri: { fsPath: '/test/file.mdx' } },
    configuration: {
      customLayoutFilePath: undefined,
      useVscodeMarkdownStyles: false,
      useWhiteBackground: false,
    },
  };

  try {
    const result = await mdxTranspileAsync(mdx, true, mockPreview);

    // basic sanity checks
    if (!result.code) {
      throw new Error('Expected result.code to be defined');
    }
    if (!result.code.includes('MDXContent')) {
      throw new Error('Expected compiled output to contain MDXContent');
    }

    console.log('SUCCESS: MDX with code blocks compiled without errors');
    console.log(`Output length: ${result.code.length} characters`);
    process.exit(0);
  } catch (err) {
    console.error('FAILED:', err.message);
    if (err.message.includes('raw')) {
      console.error(
        '\nThis is the "Cannot handle unknown node `raw`" error that should be fixed.'
      );
    }
    process.exit(1);
  }
}

main();
