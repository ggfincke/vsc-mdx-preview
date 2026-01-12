// Tests for Next.js Image component shim

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Image } from './Image';

describe('Image', () => {
  describe('src handling', () => {
    it('renders img with src string', () => {
      render(<Image src="/image.jpg" alt="Test image" />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/image.jpg');
    });

    it('extracts src from object { src, width, height }', () => {
      render(
        <Image
          src={{ src: '/photo.png', width: 800, height: 600 }}
          alt="Photo"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/photo.png');
    });

    it('uses dimensions from src object when not provided as props', () => {
      render(
        <Image
          src={{ src: '/sized.jpg', width: 400, height: 300 }}
          alt="Sized"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('width', '400');
      expect(img).toHaveAttribute('height', '300');
    });

    it('prefers prop dimensions over src object dimensions', () => {
      render(
        <Image
          src={{ src: '/override.jpg', width: 400, height: 300 }}
          alt="Override"
          width={200}
          height={150}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('width', '200');
      expect(img).toHaveAttribute('height', '150');
    });
  });

  describe('attributes', () => {
    it('passes alt attribute', () => {
      render(<Image src="/pic.jpg" alt="A beautiful picture" />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', 'A beautiful picture');
    });

    it('passes width and height attributes', () => {
      render(<Image src="/sized.jpg" alt="Sized" width={500} height={400} />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('width', '500');
      expect(img).toHaveAttribute('height', '400');
    });

    it('applies custom className', () => {
      render(<Image src="/styled.jpg" alt="Styled" className="my-image" />);

      const img = screen.getByRole('img');
      expect(img).toHaveClass('my-image');
    });
  });

  describe('fill mode', () => {
    it('applies absolute positioning when fill={true}', () => {
      render(<Image src="/fill.jpg" alt="Fill" fill={true} />);

      const img = screen.getByRole('img');
      expect(img).toHaveStyle({ position: 'absolute' });
      expect(img).toHaveStyle({ width: '100%' });
      expect(img).toHaveStyle({ height: '100%' });
    });

    it('does not set width/height when fill={true}', () => {
      render(
        <Image
          src="/fill.jpg"
          alt="Fill"
          fill={true}
          width={100}
          height={100}
        />
      );

      const img = screen.getByRole('img');
      expect(img).not.toHaveAttribute('width');
      expect(img).not.toHaveAttribute('height');
    });
  });

  describe('loading behavior', () => {
    it('uses lazy loading by default', () => {
      render(<Image src="/lazy.jpg" alt="Lazy" />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('uses eager loading when priority={true}', () => {
      render(<Image src="/priority.jpg" alt="Priority" priority={true} />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('loading', 'eager');
    });
  });

  describe('blur placeholder', () => {
    it('applies background image style when placeholder="blur" with blurDataURL', () => {
      const blurUrl = 'data:image/jpeg;base64,/9j/...';
      render(
        <Image
          src="/blur.jpg"
          alt="Blur"
          placeholder="blur"
          blurDataURL={blurUrl}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveStyle({ backgroundImage: `url(${blurUrl})` });
    });

    it('does not apply blur styles when blurDataURL is not provided', () => {
      render(<Image src="/no-blur.jpg" alt="No blur" placeholder="blur" />);

      const img = screen.getByRole('img');
      // When no blurDataURL, backgroundImage should not be set
      expect(img.style.backgroundImage).toBe('');
    });

    it('does not apply blur styles when placeholder is "empty"', () => {
      render(
        <Image
          src="/empty.jpg"
          alt="Empty"
          placeholder="empty"
          blurDataURL="data:image/..."
        />
      );

      const img = screen.getByRole('img');
      // When placeholder is "empty", backgroundImage should not be set
      expect(img.style.backgroundImage).toBe('');
    });
  });

  describe('async decoding', () => {
    it('applies decoding="async"', () => {
      render(<Image src="/async.jpg" alt="Async" />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('decoding', 'async');
    });
  });
});
