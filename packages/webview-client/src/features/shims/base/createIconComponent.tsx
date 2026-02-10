// packages/webview-app/src/components/shims/base/createIconComponent.tsx
// factory for creating JSX icon components from shared SVG strings

import React, { type ReactElement } from 'react';

export interface IconProps {
  size?: number;
  className?: string;
}

// parsed SVG metadata extracted at module load time
interface ParsedSvg {
  viewBox: string;
  fill: string;
  stroke?: string;
  strokeWidth?: string;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  // inner SVG content (path, polyline, etc.)
  innerHtml: string;
}

// parse an SVG string to extract viewBox, style attributes & inner content
// called once per icon at module load time (not per-render)
function parseSvg(svgString: string): ParsedSvg {
  const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/);
  const fillMatch = svgString.match(/\sfill="([^"]+)"/);
  const strokeMatch = svgString.match(/\sstroke="([^"]+)"/);
  const strokeWidthMatch = svgString.match(/stroke-width="([^"]+)"/);
  const strokeLinecapMatch = svgString.match(/stroke-linecap="([^"]+)"/);
  const strokeLinejoinMatch = svgString.match(/stroke-linejoin="([^"]+)"/);
  const innerMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/);

  return {
    viewBox: viewBoxMatch?.[1] ?? '0 0 24 24',
    fill: fillMatch?.[1] ?? 'none',
    stroke: strokeMatch?.[1],
    strokeWidth: strokeWidthMatch?.[1],
    strokeLinecap: strokeLinecapMatch?.[1],
    strokeLinejoin: strokeLinejoinMatch?.[1],
    innerHtml: innerMatch?.[1] ?? '',
  };
}

// create a React icon component from a shared SVG string
// parse the SVG once at module level for zero per-render overhead
// inner content rendered via dangerouslySetInnerHTML (safe: compile-time constants)
export function createIconComponent(
  svgString: string,
  defaultSize: number = 16
): React.FC<IconProps> {
  const parsed = parseSvg(svgString);

  function IconComponent({ size = defaultSize, className }: IconProps): ReactElement {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={parsed.viewBox}
        fill={parsed.fill}
        stroke={parsed.stroke}
        strokeWidth={parsed.strokeWidth}
        strokeLinecap={parsed.strokeLinecap as 'round' | 'butt' | 'square' | undefined}
        strokeLinejoin={parsed.strokeLinejoin as 'round' | 'miter' | 'bevel' | undefined}
        className={className}
        dangerouslySetInnerHTML={{ __html: parsed.innerHtml }}
      />
    );
  }

  return IconComponent;
}
