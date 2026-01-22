// tests/helpers/fixtures.ts
// Reusable MDX content fixtures for tests

export const FIXTURES = {
  // Basic MDX
  basicMdx: '# Hello\n\nWorld',

  // MDX w/ frontmatter
  mdxWithFrontmatter: `---
title: Test Document
author: Test Author
---

# Hello

Content here.`,

  // MDX w/ JSX component
  mdxWithJsx: `# Hello

<CustomComponent prop="value">
  Child content
</CustomComponent>`,

  // MDX w/ imports
  mdxWithImports: `import Button from './Button'
import { Card } from './Card'

# Hello

<Button>Click me</Button>`,

  // MDX w/ default export (layout)
  mdxWithLayout: `export default function Layout({ children }) {
  return <div className="layout">{children}</div>
}

# Hello`,

  // MDX w/ JavaScript expression
  mdxWithExpression: `# Hello

The answer is {40 + 2}.`,

  // Docusaurus-style imports
  docusaurusTabs: `import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

<Tabs>
  <TabItem value="js" label="JavaScript">
    JavaScript content
  </TabItem>
</Tabs>`,

  // Starlight-style imports
  starlightComponents: `import { Card, CardGrid } from '@astrojs/starlight/components'

<CardGrid>
  <Card title="Card 1">Content</Card>
</CardGrid>`,

  // Nextra-style imports
  nextraCallout: `import { Callout } from 'nextra/components'

<Callout type="info">
  Important information
</Callout>`,

  // MDX w/ multiple unknown components
  mdxWithUnknownComponents: `# Test

<UnknownComponent>
  Some content
</UnknownComponent>

<AnotherUnknown />`,

  // Invalid MDX (for error testing)
  invalidMdx: `# Hello

<Unclosed`,

  // MDX w/ inline JSX
  mdxWithInlineJsx: `# Hello

This has an <InlineComponent /> inline.`,

  // MDX w/ code block
  mdxWithCodeBlock: `# Code Example

\`\`\`javascript
const x = 1;
console.log(x);
\`\`\``,
} as const;
