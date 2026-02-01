// packages/webview-app/src/components/shims/base/createCollapsible.tsx
// factory for creating framework-specific collapsible/details components

import React, { useState, ReactNode, ReactElement, SyntheticEvent, MouseEvent } from 'react';
import { cn } from '../../../utils/cn';
import { ChevronIcon } from './icons';

// class names configuration for collapsible components
export interface CollapsibleClassNames {
  // container element class
  container: string;
  // summary/header element class
  summary: string;
  // icon wrapper class
  icon: string;
  // icon open state class (appended when open)
  iconOpen: string;
  // title/text element class
  title: string;
  // content container class
  content: string;
}

// configuration for creating a collapsible component
export interface CollapsibleConfig {
  // class names for each element
  classNames: CollapsibleClassNames;
  // icon size in pixels (default: 16)
  iconSize?: number;
  // whether to use native toggle event (default: true)
  useNativeToggle?: boolean;
  // whether to apply the open class to the icon wrapper (default: true)
  applyOpenClassToWrapper?: boolean;
  // default summary text when none provided (default: 'Details')
  defaultSummary?: string;
}

// common collapsible props (framework-specific components can extend this)
export interface BaseCollapsibleProps {
  // content to show when expanded
  children: ReactNode;
  // summary/title displayed in the header
  summary?: ReactNode;
  // alias for summary
  title?: ReactNode;
  // whether to start expanded (default: false)
  defaultOpen?: boolean;
  // alias for defaultOpen
  open?: boolean;
  // additional CSS class for the container
  className?: string;
}

// factory function to create framework-specific Collapsible components
export function createCollapsible(config: CollapsibleConfig): React.FC<BaseCollapsibleProps> {
  const {
    classNames,
    iconSize = 16,
    useNativeToggle = true,
    applyOpenClassToWrapper = true,
    defaultSummary = 'Details',
  } = config;

  function Collapsible({
    children,
    summary,
    title,
    defaultOpen = false,
    open,
    className,
  }: BaseCollapsibleProps): ReactElement {
    // resolve prop aliases
    const effectiveSummary = summary ?? title ?? defaultSummary;
    const effectiveDefaultOpen = open ?? defaultOpen;

    const [isOpen, setIsOpen] = useState(effectiveDefaultOpen);

    // native toggle handler (Docusaurus pattern)
    const handleNativeToggle = useNativeToggle
      ? (e: SyntheticEvent<HTMLDetailsElement>) => {
          setIsOpen((e.target as HTMLDetailsElement).open);
        }
      : undefined;

    // custom click handler (Generic Collapsible pattern)
    const handleSummaryClick = !useNativeToggle
      ? (e: MouseEvent) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }
      : undefined;

    // prevent native toggle when using custom click handling
    const handleDetailsClick = !useNativeToggle
      ? (e: MouseEvent<HTMLDetailsElement>) => {
          if ((e.target as HTMLElement).tagName === 'SUMMARY') {
            e.preventDefault();
          }
        }
      : undefined;

    // determine icon class based on applyOpenClassToWrapper
    const iconWrapperClass = applyOpenClassToWrapper
      ? cn(classNames.icon, isOpen && classNames.iconOpen)
      : classNames.icon;

    const iconSvgClass = !applyOpenClassToWrapper && isOpen ? classNames.iconOpen : undefined;

    return (
      <details
        className={cn(classNames.container, className)}
        data-component="collapsible"
        open={isOpen}
        onToggle={handleNativeToggle}
        onClick={handleDetailsClick}
      >
        <summary className={classNames.summary} onClick={handleSummaryClick}>
          <span className={iconWrapperClass}>
            <ChevronIcon size={iconSize} className={iconSvgClass} />
          </span>
          <span className={classNames.title}>{effectiveSummary}</span>
        </summary>
        <div className={classNames.content}>{children}</div>
      </details>
    );
  }

  return Collapsible;
}
