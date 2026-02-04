// packages/webview-app/src/components/shims/generic/CodeGroup.tsx
// Generic CodeGroup component shim for MDX Preview
// provides tabbed code blocks without framework dependency

import React, {
  ReactElement,
  Children,
  isValidElement,
  useState,
} from 'react';
import { CodeGroupProps } from './types';

// extract label from code block element
function extractLabelFromCodeBlock(child: ReactElement): string {
  const props = child.props as Record<string, unknown>;

  // try various prop names used by different frameworks
  if (typeof props.title === 'string') {
    return props.title;
  }
  if (typeof props.label === 'string') {
    return props.label;
  }
  if (typeof props.filename === 'string') {
    return props.filename;
  }
  if (typeof props.language === 'string') {
    return props.language;
  }
  if (typeof props.lang === 'string') {
    return props.lang;
  }

  // try to get from className (e.g., "language-javascript")
  if (typeof props.className === 'string') {
    const match = props.className.match(/language-(\w+)/);
    if (match) {
      return match[1];
    }
  }

  return 'Code';
}

// render tabbed code blocks from children
export function CodeGroup({ children, labels }: CodeGroupProps): ReactElement {
  const childArray = Children.toArray(children).filter(isValidElement);
  const [activeIndex, setActiveIndex] = useState(0);

  // extract tabs from children
  const tabs = childArray.map((child, index) => {
    const label = labels?.[index] || extractLabelFromCodeBlock(child as ReactElement);
    return { label, content: child };
  });

  if (tabs.length === 0) {
    return <div className="mdx-preview-generic-code-group-empty">{children}</div>;
  }

  // if only one code block, just render it directly
  if (tabs.length === 1) {
    return (
      <div className="mdx-preview-generic-code-group">{tabs[0].content}</div>
    );
  }

  return (
    <div className="mdx-preview-generic-code-group">
      {/* Tab headers */}
      <div className="mdx-preview-generic-code-group-header" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={index}
            role="tab"
            className={`mdx-preview-generic-code-group-button${index === activeIndex ? ' active' : ''}`}
            aria-selected={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            tabIndex={index === activeIndex ? 0 : -1}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mdx-preview-generic-code-group-content">
        {tabs.map((tab, index) => (
          <div
            key={index}
            role="tabpanel"
            className={`mdx-preview-generic-code-group-panel${index === activeIndex ? ' active' : ''}`}
            hidden={index !== activeIndex}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export default CodeGroup;
