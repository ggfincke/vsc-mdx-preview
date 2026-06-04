// tests/helpers/fixtures.ts
// shared test fixtures for MDX compilation & preview tests

// intentionally independent from mdx-forge/tests/fixtures.ts - keys may diverge
export const FIXTURES = {
  // basic MDX
  basicMdx: '# Hello\n\nWorld',

  // MDX w/ frontmatter
  mdxWithFrontmatter: `---
title: Test Document
author: Test Author
---

# Content

Some text here.`,

  // MDX w/ JSX component
  mdxWithJsx: `# Hello

<CustomComponent prop="value">
  Child content
</CustomComponent>`,
} as const;
