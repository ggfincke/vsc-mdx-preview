// packages/webview-app/src/components/shims/generic/CodeGroup.test.tsx
// Tests for generic CodeGroup component

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeGroup } from './CodeGroup';

// Helper to create code block elements with various props
function CodeBlock({
  children,
  title,
  label,
  filename,
  language,
  lang,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  label?: string;
  filename?: string;
  language?: string;
  lang?: string;
  className?: string;
}) {
  return (
    <pre
      data-testid="code-block"
      title={title}
      data-label={label}
      data-filename={filename}
      data-language={language}
      data-lang={lang}
      className={className}
    >
      <code>{children}</code>
    </pre>
  );
}

describe('CodeGroup', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(
        <CodeGroup>
          <CodeBlock>console.log('hello');</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByText("console.log('hello');")).toBeInTheDocument();
    });

    it('renders with base CSS class', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock>code</CodeBlock>
        </CodeGroup>
      );
      expect(
        container.querySelector('.mdx-preview-generic-code-group')
      ).toBeInTheDocument();
    });
  });

  describe('single block behavior', () => {
    it('renders single block without tabs', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock>single block</CodeBlock>
        </CodeGroup>
      );
      expect(container.querySelector('[role="tablist"]')).not.toBeInTheDocument();
      expect(container.querySelector('[role="tab"]')).not.toBeInTheDocument();
    });

    it('renders single block directly', () => {
      render(
        <CodeGroup>
          <CodeBlock>single code</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByText('single code')).toBeInTheDocument();
    });
  });

  describe('multiple blocks behavior', () => {
    it('renders tab UI for multiple blocks', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="JS">js code</CodeBlock>
          <CodeBlock title="TS">ts code</CodeBlock>
        </CodeGroup>
      );
      expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
    });

    it('renders correct number of tab buttons', () => {
      render(
        <CodeGroup>
          <CodeBlock title="JS">js</CodeBlock>
          <CodeBlock title="TS">ts</CodeBlock>
          <CodeBlock title="Python">py</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getAllByRole('tab')).toHaveLength(3);
    });

    it('renders correct number of tab panels', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="JS">js</CodeBlock>
          <CodeBlock title="TS">ts</CodeBlock>
        </CodeGroup>
      );
      expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
    });
  });

  describe('label extraction', () => {
    it('extracts label from title prop', () => {
      render(
        <CodeGroup>
          <CodeBlock title="JavaScript">js</CodeBlock>
          <CodeBlock title="TypeScript">ts</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'JavaScript' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'TypeScript' })).toBeInTheDocument();
    });

    it('extracts label from label prop', () => {
      render(
        <CodeGroup>
          <CodeBlock label="Label 1">code1</CodeBlock>
          <CodeBlock label="Label 2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'Label 1' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Label 2' })).toBeInTheDocument();
    });

    it('extracts label from filename prop', () => {
      render(
        <CodeGroup>
          <CodeBlock filename="index.js">code1</CodeBlock>
          <CodeBlock filename="app.ts">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'index.js' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'app.ts' })).toBeInTheDocument();
    });

    it('extracts label from language prop', () => {
      render(
        <CodeGroup>
          <CodeBlock language="javascript">code1</CodeBlock>
          <CodeBlock language="typescript">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'javascript' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'typescript' })).toBeInTheDocument();
    });

    it('extracts label from lang prop', () => {
      render(
        <CodeGroup>
          <CodeBlock lang="js">code1</CodeBlock>
          <CodeBlock lang="ts">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'js' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'ts' })).toBeInTheDocument();
    });

    it('extracts label from className language pattern', () => {
      render(
        <CodeGroup>
          <CodeBlock className="language-python">code1</CodeBlock>
          <CodeBlock className="language-ruby">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'python' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'ruby' })).toBeInTheDocument();
    });

    it('uses default "Code" label when no label found', () => {
      render(
        <CodeGroup>
          <CodeBlock>code1</CodeBlock>
          <CodeBlock>code2</CodeBlock>
        </CodeGroup>
      );
      // Both tabs should have "Code" label
      expect(screen.getAllByRole('tab', { name: 'Code' })).toHaveLength(2);
    });

    it('title takes priority over other props', () => {
      render(
        <CodeGroup>
          <CodeBlock title="Title" label="Label" language="lang">
            code
          </CodeBlock>
          <CodeBlock>other</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'Title' })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Label' })).not.toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'lang' })).not.toBeInTheDocument();
    });

    it('label takes priority over filename/language', () => {
      render(
        <CodeGroup>
          <CodeBlock label="Label" filename="file.js" language="javascript">
            code
          </CodeBlock>
          <CodeBlock>other</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'Label' })).toBeInTheDocument();
    });

    it('filename takes priority over language', () => {
      render(
        <CodeGroup>
          <CodeBlock filename="file.js" language="javascript">
            code
          </CodeBlock>
          <CodeBlock>other</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'file.js' })).toBeInTheDocument();
    });
  });

  describe('labels prop', () => {
    it('uses provided labels', () => {
      render(
        <CodeGroup labels={['Custom 1', 'Custom 2']}>
          <CodeBlock>code1</CodeBlock>
          <CodeBlock>code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'Custom 1' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Custom 2' })).toBeInTheDocument();
    });

    it('labels prop overrides extracted labels', () => {
      render(
        <CodeGroup labels={['Override']}>
          <CodeBlock title="Title">code</CodeBlock>
          <CodeBlock>other</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'Override' })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: 'Title' })).not.toBeInTheDocument();
    });

    it('falls back to extraction when labels array is shorter', () => {
      render(
        <CodeGroup labels={['First']}>
          <CodeBlock>code1</CodeBlock>
          <CodeBlock title="Second">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'First' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Second' })).toBeInTheDocument();
    });
  });

  describe('tab switching', () => {
    it('first tab is active by default', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="First">first code</CodeBlock>
          <CodeBlock title="Second">second code</CodeBlock>
        </CodeGroup>
      );
      const firstTab = screen.getByRole('tab', { name: 'First' });
      expect(firstTab).toHaveAttribute('aria-selected', 'true');
      expect(firstTab).toHaveClass('active');

      const panels = container.querySelectorAll('[role="tabpanel"]');
      expect(panels[0]).not.toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');
    });

    it('clicking a tab changes active state', () => {
      render(
        <CodeGroup>
          <CodeBlock title="First">first code</CodeBlock>
          <CodeBlock title="Second">second code</CodeBlock>
        </CodeGroup>
      );

      const secondTab = screen.getByRole('tab', { name: 'Second' });
      fireEvent.click(secondTab);

      expect(secondTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    it('clicking a tab shows corresponding content', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="First">first code</CodeBlock>
          <CodeBlock title="Second">second code</CodeBlock>
        </CodeGroup>
      );

      const panels = container.querySelectorAll('[role="tabpanel"]');

      // Initially first panel visible
      expect(panels[0]).not.toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');

      // Click second tab
      fireEvent.click(screen.getByRole('tab', { name: 'Second' }));

      // Now second panel visible
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });

    it('can switch between multiple tabs', () => {
      render(
        <CodeGroup>
          <CodeBlock title="One">1</CodeBlock>
          <CodeBlock title="Two">2</CodeBlock>
          <CodeBlock title="Three">3</CodeBlock>
        </CodeGroup>
      );

      // Click third
      fireEvent.click(screen.getByRole('tab', { name: 'Three' }));
      expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Click first
      fireEvent.click(screen.getByRole('tab', { name: 'One' }));
      expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Click second
      fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
      expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  describe('accessibility', () => {
    it('tab buttons have role="tab"', () => {
      render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('tab header has role="tablist"', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
    });

    it('tab panels have role="tabpanel"', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(2);
    });

    it('active tab has tabIndex="0"', () => {
      render(
        <CodeGroup>
          <CodeBlock title="Active">code</CodeBlock>
          <CodeBlock title="Inactive">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute(
        'tabIndex',
        '0'
      );
    });

    it('inactive tabs have tabIndex="-1"', () => {
      render(
        <CodeGroup>
          <CodeBlock title="Active">code</CodeBlock>
          <CodeBlock title="Inactive">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getByRole('tab', { name: 'Inactive' })).toHaveAttribute(
        'tabIndex',
        '-1'
      );
    });
  });

  describe('CSS classes', () => {
    it('applies header class', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(
        container.querySelector('.mdx-preview-generic-code-group-header')
      ).toBeInTheDocument();
    });

    it('applies button class to tabs', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(
        container.querySelectorAll('.mdx-preview-generic-code-group-button')
      ).toHaveLength(2);
    });

    it('applies active class to active button', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      const activeButtons = container.querySelectorAll(
        '.mdx-preview-generic-code-group-button.active'
      );
      expect(activeButtons).toHaveLength(1);
    });

    it('applies content class', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(
        container.querySelector('.mdx-preview-generic-code-group-content')
      ).toBeInTheDocument();
    });

    it('applies panel class to tab panels', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(
        container.querySelectorAll('.mdx-preview-generic-code-group-panel')
      ).toHaveLength(2);
    });

    it('applies active class to active panel', () => {
      const { container } = render(
        <CodeGroup>
          <CodeBlock title="Tab">code</CodeBlock>
          <CodeBlock title="Tab2">code2</CodeBlock>
        </CodeGroup>
      );
      expect(
        container.querySelectorAll('.mdx-preview-generic-code-group-panel.active')
      ).toHaveLength(1);
    });
  });

  describe('empty state', () => {
    it('renders empty wrapper for no children', () => {
      const { container } = render(<CodeGroup>{null}</CodeGroup>);
      expect(
        container.querySelector('.mdx-preview-generic-code-group-empty')
      ).toBeInTheDocument();
    });

    it('handles undefined children', () => {
      const { container } = render(<CodeGroup>{undefined}</CodeGroup>);
      expect(
        container.querySelector('.mdx-preview-generic-code-group-empty')
      ).toBeInTheDocument();
    });

    it('filters out non-element children', () => {
      render(
        <CodeGroup>
          {/* This is a comment and will be filtered */}
          Just text
        </CodeGroup>
      );
      // Text nodes aren't valid elements, so should go to empty state
      expect(
        screen.getByText('Just text').closest('.mdx-preview-generic-code-group-empty')
      ).toBeInTheDocument();
    });
  });

  describe('mixed children', () => {
    it('only uses valid React elements', () => {
      render(
        <CodeGroup>
          <CodeBlock title="Valid">code</CodeBlock>
          <CodeBlock title="Also Valid">code2</CodeBlock>
        </CodeGroup>
      );
      expect(screen.getAllByRole('tab')).toHaveLength(2);
    });
  });
});
