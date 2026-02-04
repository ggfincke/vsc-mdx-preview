// packages/webview-app/src/components/shims/nextjs/Image.tsx
// shim for next/image - provides basic image rendering without Next.js optimization

import { ImgHTMLAttributes } from 'react';

// Next.js Image component props subset (relevant props for preview)
export interface ImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'srcSet' | 'ref' | 'width' | 'height' | 'loading'
> {
  src: string | { src: string; height?: number; width?: number };
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  quality?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  loader?: (props: { src: string; width: number; quality?: number }) => string;
  unoptimized?: boolean;
  sizes?: string;
}

// simple image component that renders without Next.js optimization
export function Image({
  src,
  alt,
  width,
  height,
  fill,
  priority,
  placeholder,
  blurDataURL,
  loader: _loader,
  unoptimized: _unoptimized,
  quality: _quality,
  sizes: _sizes,
  className,
  style,
  ...rest
}: ImageProps) {
  // extract actual src string
  const srcString = typeof src === 'string' ? src : src.src;

  // extract dimensions from src object if not provided
  const actualWidth =
    width ?? (typeof src === 'object' ? src.width : undefined);
  const actualHeight =
    height ?? (typeof src === 'object' ? src.height : undefined);

  // fill mode: image fills parent container
  const fillStyles: React.CSSProperties = fill
    ? {
        position: 'absolute',
        height: '100%',
        width: '100%',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        objectFit: 'cover',
      }
    : {};

  // blur placeholder
  const placeholderStyles: React.CSSProperties =
    placeholder === 'blur' && blurDataURL
      ? {
          backgroundImage: `url(${blurDataURL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {};

  return (
    <img
      src={srcString}
      alt={alt}
      width={fill ? undefined : actualWidth}
      height={fill ? undefined : actualHeight}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      style={{
        ...fillStyles,
        ...placeholderStyles,
        ...style,
      }}
      {...rest}
    />
  );
}

export default Image;
