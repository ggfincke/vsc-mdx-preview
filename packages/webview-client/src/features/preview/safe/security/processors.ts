// packages/webview-client/src/features/preview/safe/security/processors.ts
// post-processing functions for sanitized HTML

// process links to ensure external links open safely
// internal anchor links (#...) are left unchanged
// external links get target="_blank" & rel="noopener noreferrer"
export function processLinks(container: HTMLElement): void {
  const links = container.querySelectorAll('a');
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    // internal anchor links
    if (href.startsWith('#')) {
      return;
    }

    // external links (open in new tab securely)
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}

// add clickable cursor to images for lightbox functionality
export function processImages(container: HTMLElement): void {
  const images = container.querySelectorAll('img');
  images.forEach((img) => {
    img.style.cursor = 'zoom-in';
  });
}
