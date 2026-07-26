// packages/webview-client/src/shared/utils/StyleInjector.ts
// unified CSS injection utility for webview (themes, custom CSS, Tailwind)

export interface StyleInjectorOptions {
  // insertion anchor ID
  insertBefore?: string;
  // document data attribute
  dataAttribute?: { name: string; value: string };
  // optional attributes applied to the style element
  attributes?: Record<string, string>;
}

// well-known style element IDs used by the extension - ensures consistency across the codebase
export const STYLE_IDS = {
  PREVIEW_THEME: 'mpe-preview-theme',
  CODE_BLOCK_THEME: 'mpe-code-block-theme',
  CUSTOM_CSS: 'mdx-preview-custom-css',
  SAFE_MODE: 'mdx-safe-mode-styles',
  TAILWIND_CSS: 'mdx-preview-tailwind-css',
  TAILWIND_BROWSER_INPUT_CSS: 'mdx-preview-tailwind-browser-input-css',
} as const;

function applyAttributes(
  styleEl: HTMLStyleElement,
  attributes?: Record<string, string>
): void {
  if (!attributes) {
    return;
  }

  for (const [name, value] of Object.entries(attributes)) {
    styleEl.setAttribute(name, value);
  }
}

function hasMatchingAttributes(
  styleEl: HTMLStyleElement,
  attributes?: Record<string, string>
): boolean {
  return (
    !attributes ||
    Object.entries(attributes).every(
      ([name, value]) => styleEl.getAttribute(name) === value
    )
  );
}

// centralized style injection manager for theme, custom & Tailwind CSS
class StyleInjectorImpl {
  // inject CSS w/ the given ID - creates or updates a <style> element in document.head
  inject(id: string, css: string, options: StyleInjectorOptions = {}): void {
    const { insertBefore, dataAttribute, attributes } = options;

    let styleEl = document.getElementById(id) as HTMLStyleElement | null;

    if (
      styleEl &&
      styleEl.textContent === css &&
      hasMatchingAttributes(styleEl, attributes) &&
      (!dataAttribute ||
        document.documentElement.getAttribute(dataAttribute.name) ===
          dataAttribute.value)
    ) {
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = id;
      applyAttributes(styleEl, attributes);

      // handle insertion order (e.g., Tailwind before Custom CSS)
      if (insertBefore) {
        const beforeEl = document.getElementById(insertBefore);
        if (beforeEl?.parentNode) {
          beforeEl.parentNode.insertBefore(styleEl, beforeEl);
        } else {
          document.head.appendChild(styleEl);
        }
      } else {
        document.head.appendChild(styleEl);
      }
    } else {
      applyAttributes(styleEl, attributes);
    }

    styleEl.textContent = css;

    // set data attribute on document element if specified (for theme detection)
    if (dataAttribute) {
      document.documentElement.setAttribute(
        dataAttribute.name,
        dataAttribute.value
      );
    }
  }

  // remove a style element by ID
  remove(id: string): void {
    const styleEl = document.getElementById(id);
    if (styleEl) {
      styleEl.remove();
    }
  }

  // remove a data attribute from document element
  removeDataAttribute(name: string): void {
    document.documentElement.removeAttribute(name);
  }
}

// singleton instance
export const StyleInjector = new StyleInjectorImpl();
