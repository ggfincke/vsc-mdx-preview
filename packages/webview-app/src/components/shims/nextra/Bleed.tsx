// packages/webview-app/src/components/shims/nextra/Bleed.tsx
// Nextra Bleed component shim for MDX Preview
// Provides preview-compatible version of nextra/components Bleed
// Allows content to overflow beyond the container width

import { ReactNode, ReactElement, HTMLAttributes } from 'react';

// Text size options
type TextSize = 'sm' | 'base' | 'lg' | 'xl';

// Font weight options
type FontWeight = 'normal' | 'medium' | 'semibold' | 'bold';

// Alignment options
type HAlign = 'left' | 'center' | 'right';
type VAlign = 'top' | 'middle' | 'bottom';

// Height presets
type HeightPreset = 'sm' | 'md' | 'lg' | 'xl' | 'screen' | 'half';

// Bleed props (compatible w/ Nextra)
export interface BleedProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  size?: TextSize;
  weight?: FontWeight;
  italic?: boolean;
  align?: HAlign;
  valign?: VAlign;
  height?: HeightPreset;
}

// Bleed component
export function Bleed({
  children,
  size,
  weight,
  italic = false,
  align,
  valign,
  height,
  className,
  ...props
}: BleedProps): ReactElement {
  const classes = [
    'mdx-preview-nextra-bleed',
    size ? `mdx-preview-nextra-bleed-size-${size}` : '',
    weight ? `mdx-preview-nextra-bleed-weight-${weight}` : '',
    italic ? 'mdx-preview-nextra-bleed-italic' : '',
    align ? `mdx-preview-nextra-bleed-align-${align}` : '',
    valign ? `mdx-preview-nextra-bleed-valign-${valign}` : '',
    height ? `mdx-preview-nextra-bleed-height-${height}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export default Bleed;
