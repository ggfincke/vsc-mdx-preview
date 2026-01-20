// packages/webview-app/src/components/shims/base/BaseCollapsible.tsx
// Shared base component for collapsible/details implementations
// Used by generic/Collapsible and docusaurus/Details

import React, { useState, ReactNode, ReactElement, SyntheticEvent, MouseEvent } from 'react';
import { cn } from '../../../utils/cn';
import { ChevronIcon } from './icons';

/**
 * Class names configuration for BaseCollapsible
 * Allows framework-specific styling while sharing logic
 */
export interface CollapsibleClassNames {
  /** Container element class */
  container: string;
  /** Summary/header element class */
  summary: string;
  /** Icon wrapper class */
  icon: string;
  /** Icon open state class (appended when open) */
  iconOpen: string;
  /** Title/text element class */
  title: string;
  /** Content container class */
  content: string;
}

export interface BaseCollapsibleProps {
  /** Content to show when expanded */
  children: ReactNode;

  /**
   * Summary/title displayed in the header
   * Can be a string or ReactNode (allows icons, JSX)
   */
  summary: ReactNode;

  /** Whether to start expanded (default: false) */
  defaultOpen?: boolean;

  /** Additional CSS class for the container */
  className?: string;

  /**
   * Class names for each element
   * Allows framework-specific styling
   */
  classNames: CollapsibleClassNames;

  /**
   * Icon size in pixels (default: 16)
   * Generic Collapsible uses 16, Docusaurus Details uses 14
   */
  iconSize?: number;

  /**
   * Whether to use native toggle event (onToggle) or custom click handling
   * - true: Uses native onToggle event (Docusaurus pattern - more semantic)
   * - false: Uses custom onClick handler (Generic pattern - prevents native behavior)
   * Default: true
   */
  useNativeToggle?: boolean;

  /**
   * Whether to apply the open class to the icon element vs the SVG inside
   * - true: Apply to icon wrapper (Generic Collapsible pattern)
   * - false: Apply to SVG element directly (Docusaurus Details pattern)
   * Default: true
   */
  applyOpenClassToWrapper?: boolean;
}

/**
 * BaseCollapsible - Shared collapsible/details component base
 *
 * Consolidates common logic between Generic Collapsible and Docusaurus Details:
 * - State management (useState for open/close)
 * - Toggle handling (native or custom)
 * - Chevron icon rendering with rotation
 *
 * Framework-specific styling is achieved through classNames prop.
 */
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

  // Native toggle handler (Docusaurus pattern)
  const handleNativeToggle = useNativeToggle
    ? (e: SyntheticEvent<HTMLDetailsElement>) => {
        setIsOpen((e.target as HTMLDetailsElement).open);
      }
    : undefined;

  // Custom click handler (Generic Collapsible pattern)
  const handleSummaryClick = !useNativeToggle
    ? (e: MouseEvent) => {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    : undefined;

  // Prevent native toggle when using custom click handling
  const handleDetailsClick = !useNativeToggle
    ? (e: MouseEvent<HTMLDetailsElement>) => {
        if ((e.target as HTMLElement).tagName === 'SUMMARY') {
          e.preventDefault();
        }
      }
    : undefined;

  // Determine icon class based on applyOpenClassToWrapper
  const iconWrapperClass = applyOpenClassToWrapper
    ? cn(classNames.icon, isOpen && classNames.iconOpen)
    : classNames.icon;

  const iconSvgClass = !applyOpenClassToWrapper && isOpen ? classNames.iconOpen : undefined;

  return (
    <details
      className={cn(classNames.container, className)}
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

// ============================================================================
// Preset class configurations for each framework
// ============================================================================

/**
 * Class names for Generic Collapsible
 * Uses: mdx-preview-generic-collapsible-* pattern
 */
export const GENERIC_COLLAPSIBLE_CLASSES: CollapsibleClassNames = {
  container: 'mdx-preview-generic-collapsible',
  summary: 'mdx-preview-generic-collapsible-summary',
  icon: 'mdx-preview-generic-collapsible-icon',
  iconOpen: 'open',
  title: 'mdx-preview-generic-collapsible-title',
  content: 'mdx-preview-generic-collapsible-content',
};

/**
 * Class names for Docusaurus Details
 * Uses: docusaurus-details, details-* pattern
 */
export const DOCUSAURUS_DETAILS_CLASSES: CollapsibleClassNames = {
  container: 'docusaurus-details',
  summary: 'details-summary',
  icon: 'details-toggle-icon',
  iconOpen: 'expanded',
  title: 'details-summary-text',
  content: 'details-content',
};

export default BaseCollapsible;
