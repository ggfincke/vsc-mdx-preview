// tests/helpers/fixtures.ts
// shared test fixtures for MDX compilation & preview tests

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

  // MDX w/ code block
  mdxWithCodeBlock: `# Code Example

\`\`\`javascript
const x = 1;
const y = 2;
\`\`\``,

  // MDX w/ default export (layout)
  mdxWithLayout: `export default function Layout({ children }) {
  return <div className="layout">{children}</div>
}

# Hello

Content w/ layout.`,

  // MDX w/ JSX component
  mdxWithJsx: `# Hello

<CustomComponent prop="value">
  Child content
</CustomComponent>`,

  // MDX w/ inline JSX
  mdxWithInlineJsx: `# Hello

This is <InlineComponent /> inline.`,

  // MDX w/ JavaScript expression
  mdxWithExpression: `# Hello

The answer is {21 + 21}.`,

  // MDX w/ imports
  mdxWithImports: `import Foo from './Foo'

# Hello

Some content.`,

  // invalid MDX (for error testing)
  invalidMdx: `# Hello

<div>
  <span>unclosed

{invalid expression`,

  // Docusaurus-style imports
  docusaurusTabs: `import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

# Tabs Example

<Tabs>
  <TabItem value="a" label="Tab A">Content A</TabItem>
  <TabItem value="b" label="Tab B">Content B</TabItem>
</Tabs>`,

  // Starlight-style imports
  starlightComponents: `import { Card, CardGrid } from '@astrojs/starlight/components'

<CardGrid>
  <Card title="Card 1">Content</Card>
</CardGrid>`,

  // Nextra-style imports
  nextraCallout: `import { Callout } from 'nextra/components'

# Nextra Example

<Callout type="info">
  Important information
</Callout>`,

  // MDX w/ multiple unknown components
  mdxWithUnknownComponents: `# Test

<UnknownComponent>
  Some content
</UnknownComponent>

<AnotherUnknown />`,
} as const;
