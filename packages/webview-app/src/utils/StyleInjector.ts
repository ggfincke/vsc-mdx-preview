// packages/webview-app/src/utils/StyleInjector.ts
// Unified CSS injection utility for webview

export interface StyleInjectorOptions {
  // enable deduplication check (skip if already injected)
  deduplicate?: boolean;
  // insert before element w/ this ID (for ordering)
  insertBefore?: string;
  // set data attribute on document element
  dataAttribute?: { name: string; value: string };
}

// well-known style element IDs used by the extension - ensures consistency across the codebase
export const STYLE_IDS = {
  PREVIEW_THEME: 'mpe-preview-theme',
  CODE_BLOCK_THEME: 'mpe-code-block-theme',
  CUSTOM_CSS: 'mdx-preview-custom-css',
  TAILWIND_CSS: 'mdx-preview-tailwind-css',
} as const;

// * centralized style injection manager
// handles module CSS, theme CSS, custom CSS, & Tailwind CSS w/ proper ordering
class StyleInjectorImpl {
  // track injected style IDs for deduplication
  private injectedIds = new Set<string>();

  // inject CSS w/ the given ID - creates or updates a <style> element in document.head
  inject(id: string, css: string, options: StyleInjectorOptions = {}): void {
    const { deduplicate = false, insertBefore, dataAttribute } = options;

    // deduplication check - skip if already injected w/ this ID
    if (deduplicate && this.injectedIds.has(id)) {
      return;
    }

    let styleEl = document.getElementById(id) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = id;

      // Handle insertion order (e.g., Tailwind before Custom CSS)
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
    }

    styleEl.textContent = css;

    if (deduplicate) {
      this.injectedIds.add(id);
    }

    // Set data attribute on document element if specified (for theme detection)
    if (dataAttribute) {
      document.documentElement.setAttribute(
        dataAttribute.name,
        dataAttribute.value
      );
    }
  }

  // inject CSS for a module (uses data-module-id attribute pattern)
  // this pattern is used for CSS from imported files
  injectModuleCss(moduleId: string, css: string): void {
    // Don't inject the same module styles twice
    if (this.injectedIds.has(moduleId)) {
      return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-module-id', moduleId);
    style.textContent = css;
    document.head.appendChild(style);

    this.injectedIds.add(moduleId);
  }

  // remove a style element by ID
  remove(id: string): void {
    const styleEl = document.getElementById(id);
    if (styleEl) {
      styleEl.remove();
    }
    this.injectedIds.delete(id);
  }

  // remove CSS for a specific module (for incremental updates)
  removeModuleCss(moduleId: string): void {
    const style = document.querySelector(`style[data-module-id="${moduleId}"]`);
    if (style) {
      style.remove();
    }
    this.injectedIds.delete(moduleId);
  }

  // remove a data attribute from document element
  removeDataAttribute(name: string): void {
    document.documentElement.removeAttribute(name);
  }

  // clear styles matching a pattern ('modules' for all module CSS, or a CSS selector string)
  clear(selector?: 'modules' | string): void {
    if (selector === 'modules') {
      // Clear all module-injected styles (data-module-id pattern)
      const styles = document.querySelectorAll('style[data-module-id]');
      styles.forEach((style) => {
        const moduleId = style.getAttribute('data-module-id');
        if (moduleId) {
          this.injectedIds.delete(moduleId);
        }
        style.remove();
      });
    } else if (selector) {
      // Clear by custom selector
      const styles = document.querySelectorAll(selector);
      styles.forEach((style) => {
        if (style.id) {
          this.injectedIds.delete(style.id);
        }
        style.remove();
      });
    }
  }

  // clear all tracked injection state (for reset operations)
  // does not remove style elements - use clear() for that
  clearTracking(): void {
    this.injectedIds.clear();
  }

  // check if a style has been injected
  hasInjected(id: string): boolean {
    return this.injectedIds.has(id);
  }

  // mark a style as injected (for external tracking synchronization)
  markInjected(id: string): void {
    this.injectedIds.add(id);
  }
}

// Singleton instance
export const StyleInjector = new StyleInjectorImpl();
