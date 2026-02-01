// packages/webview-app/src/components/shims/base/BaseCollapsible.tsx
// shared base component for collapsible/details implementations
// used by generic/Collapsible & docusaurus/Details

/* eslint-disable react-refresh/only-export-components -- Class name presets are co-located with component */

import React, { useState, ReactNode, ReactElement, SyntheticEvent, MouseEvent } from 'react';
import { cn } from '../../../utils/cn';
import { ChevronIcon } from './icons';

// class names configuration for BaseCollapsible
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

export interface BaseCollapsibleProps {
  // content to show when expanded
  children: ReactNode;
  // summary/title displayed in the header
  summary: ReactNode;
  // whether to start expanded (default: false)
  defaultOpen?: boolean;
  // additional CSS class for the container
  className?: string;
  // class names for each element
  classNames: CollapsibleClassNames;
  // icon size in pixels (default: 16)
  iconSize?: number;
  // whether to use native toggle event (default: true)
  useNativeToggle?: boolean;
  // whether to apply the open class to the icon wrapper (default: true)
  applyOpenClassToWrapper?: boolean;
}

// BaseCollapsible - shared collapsible/details component base
export function BaseCollapsible({
  children,
  summary,
  defaultOpen = false,
  className,
  classNames,
  iconSize = 16,
  useNativeToggle = true,
  applyOpenClassToWrapper = true,
}: BaseCollapsibleProps): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
        <span className={classNames.title}>{summary}</span>
      </summary>
      <div className={classNames.content}>{children}</div>
    </details>
  );
}

// preset class configurations for each framework

// class names for Generic Collapsible
export const GENERIC_COLLAPSIBLE_CLASSES: CollapsibleClassNames = {
  container: 'mdx-preview-generic-collapsible',
  summary: 'mdx-preview-generic-collapsible-summary',
  icon: 'mdx-preview-generic-collapsible-icon',
  iconOpen: 'open',
  title: 'mdx-preview-generic-collapsible-title',
  content: 'mdx-preview-generic-collapsible-content',
};

// class names for Docusaurus Details
export const DOCUSAURUS_DETAILS_CLASSES: CollapsibleClassNames = {
  container: 'docusaurus-details',
  summary: 'details-summary',
  icon: 'details-toggle-icon',
  iconOpen: 'expanded',
  title: 'details-summary-text',
  content: 'details-content',
};

export default BaseCollapsible;
