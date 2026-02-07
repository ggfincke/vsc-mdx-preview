// packages/webview-app/src/components/shims/base/icons.tsx
// shared icon registry for all shim components

import React, { ReactElement } from 'react';
import {
  CALLOUT_ICONS as SHARED_CALLOUT_ICONS,
  GITHUB_ICONS as SHARED_GITHUB_ICONS,
  FILE_TREE_ICONS as SHARED_FILE_TREE_ICONS,
  LUCIDE_ICONS as SHARED_LUCIDE_ICONS,
} from '@mdx-preview/shared';
import { createIconComponent, type IconProps } from './createIconComponent';

// re-export type for external consumers
export type { IconProps } from './createIconComponent';

// re-export SVG icon registries from shared package
export const CALLOUT_ICONS = SHARED_CALLOUT_ICONS;
export const FILE_TREE_ICONS = SHARED_FILE_TREE_ICONS;
export const GITHUB_ICONS = SHARED_GITHUB_ICONS;
export const LUCIDE_ICONS = SHARED_LUCIDE_ICONS;

// unified copy/check icons for clipboard functionality
// use GitHub Primer style for consistency w/ code blocks
export const COPY_ICONS = {
  copy: GITHUB_ICONS.copy,
  check: GITHUB_ICONS.check,
} as const;

// JSX icon components derived from shared SVG strings
// eliminates SVG path duplication between shared & webview packages

// chevron icon (Lucide style) - used for collapsibles & tree views
export const ChevronIcon = createIconComponent(FILE_TREE_ICONS.chevron, 16);

// GitHub Primer style lightbulb icon - used for Nextra default callout
export const LightbulbIcon = createIconComponent(GITHUB_ICONS.lightbulb, 16);

// GitHub Primer style info icon - used for Nextra info callout
export const InfoIconGitHub = createIconComponent(GITHUB_ICONS.info, 16);

// GitHub Primer style warning icon - used for Nextra warning callout
export const WarningIconGitHub = createIconComponent(GITHUB_ICONS.warning, 16);

// GitHub Primer style error/octagon icon - used for Nextra error callout
export const ErrorIconGitHub = createIconComponent(GITHUB_ICONS.error, 16);

// GitHub Primer style comment/important icon - used for Nextra important callout
export const ImportantIconGitHub = createIconComponent(GITHUB_ICONS.important, 16);

// pre-create GitHub variant at module level (avoid per-render allocation)
const GitHubArrowIcon = createIconComponent(GITHUB_ICONS.arrowRight, 16);
const LucideArrowIcon = createIconComponent(LUCIDE_ICONS.arrowRight, 16);

export interface ArrowIconProps extends IconProps {
  // icon style: 'lucide' (stroke-based) or 'github' (filled)
  variant?: 'lucide' | 'github';
}

// arrow icon - used for link cards & navigation
export function ArrowIcon({
  size = 16,
  className,
  variant = 'lucide',
}: ArrowIconProps): ReactElement {
  if (variant === 'github') {
    return <GitHubArrowIcon size={size} className={className} />;
  }

  return <LucideArrowIcon size={size} className={className} />;
}

// copy icon (Lucide style) - used for copy buttons
export const CopyIcon = createIconComponent(LUCIDE_ICONS.copy, 16);

// check icon (Lucide style) - used for copy confirmation
export const CheckIcon = createIconComponent(LUCIDE_ICONS.check, 16);

// Nextra callout type icons
export type NextraCalloutType = 'default' | 'info' | 'warning' | 'error' | 'important';

export const NEXTRA_CALLOUT_ICONS: Record<NextraCalloutType, React.FC<IconProps>> = {
  default: LightbulbIcon,
  info: InfoIconGitHub,
  warning: WarningIconGitHub,
  error: ErrorIconGitHub,
  important: ImportantIconGitHub,
};
