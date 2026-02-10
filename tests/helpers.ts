// tests/helpers.ts
// shared test fixtures for MDX compilation & preview tests

export const FIXTURES = {
  basicMdx: `# Hello

World`,

  mdxWithFrontmatter: `---
title: Test Document
author: Test Author
---

# Content

Some text here.`,

  mdxWithCodeBlock: `# Code Example

\`\`\`javascript
const x = 1;
const y = 2;
\`\`\``,

  mdxWithLayout: `export default function Layout({ children }) {
  return <div className="layout">{children}</div>
}

# Hello

Content w/ layout.`,

  mdxWithJsx: `# Hello

<CustomComponent prop="value">
  Child content
</CustomComponent>`,

  mdxWithInlineJsx: `# Hello

This is <InlineComponent /> inline.`,

  mdxWithExpression: `# Hello

The answer is {21 + 21}.`,

  mdxWithImports: `import Foo from './Foo'

# Hello

Some content.`,

  invalidMdx: `# Hello

<div>
  <span>unclosed

{invalid expression`,

  docusaurusTabs: `import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

# Tabs Example

<Tabs>
  <TabItem value="a" label="Tab A">Content A</TabItem>
  <TabItem value="b" label="Tab B">Content B</TabItem>
</Tabs>`,

  nextraCallout: `import { Callout } from 'nextra/components'

# Nextra Example

<Callout type="info">
  Important information
</Callout>`,
};
