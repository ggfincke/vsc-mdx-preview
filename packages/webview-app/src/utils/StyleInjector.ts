// packages/webview-app/src/utils/StyleInjector.ts
// unified CSS injection utility for webview
//
// ARCHITECTURE NOTE
// StyleInjector is a pure DOM manipulation layer - the authoritative source
// of truth for which styles have been injected is ModuleRegistry (in
// module-system/registry/ModuleRegistry.ts), which has reference counting
// & LRU eviction - callers should check ModuleRegistry before calling
// injectModuleCss() to avoid duplicate injection

export interface StyleInjectorOptions {
  // enable deduplication check (skip if already injected) - for non-module styles
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

// centralized style injection manager
// handle module CSS, theme CSS, custom CSS, & Tailwind CSS w/ proper ordering
// for module CSS specifically, ModuleRegistry is the authoritative tracker
// call registry.hasInjectedStyle() before calling injectModuleCss()
class StyleInjectorImpl {
  // track non-module injected style IDs for deduplication (themes, custom CSS, etc.)
  private injectedIds = new Set<string>();
  // cache DOM element references for O(1) removal (instead of querySelector)
  private moduleStyleElements: Map<string, HTMLStyleElement> = new Map();

  // inject CSS w/ the given ID - creates or updates a <style> element in document.head
  // for non-module styles (themes, custom CSS, etc.)
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
    }

    styleEl.textContent = css;

    if (deduplicate) {
      this.injectedIds.add(id);
    }

    // set data attribute on document element if specified (for theme detection)
    if (dataAttribute) {
      document.documentElement.setAttribute(
        dataAttribute.name,
        dataAttribute.value
      );
    }
  }

  // inject CSS for a module (uses data-module-id attribute pattern)
  // IMPORTANT: callers must check ModuleRegistry.hasInjectedStyle() before calling
  // this method to avoid duplicate injection - ModuleRegistry is the authoritative
  // source of truth for module style tracking
  injectModuleCss(moduleId: string, css: string): void {
    const style = document.createElement('style');
    style.setAttribute('data-module-id', moduleId);
    style.textContent = css;
    document.head.appendChild(style);

    // cache DOM reference for O(1) removal
    this.moduleStyleElements.set(moduleId, style);
  }

  // remove a style element by ID (for non-module styles)
  remove(id: string): void {
    const styleEl = document.getElementById(id);
    if (styleEl) {
      styleEl.remove();
    }
    this.injectedIds.delete(id);
  }

  // remove CSS for a specific module (for incremental updates)
  // O(1) via cached DOM reference instead of O(n) querySelector
  removeModuleCss(moduleId: string): void {
    const style = this.moduleStyleElements.get(moduleId);
    if (style?.parentNode) {
      style.remove();
    }
    this.moduleStyleElements.delete(moduleId);
  }

  // remove a data attribute from document element
  removeDataAttribute(name: string): void {
    document.documentElement.removeAttribute(name);
  }

  // clear styles matching a pattern
  // - 'modules': clears all module CSS via cached references (O(k))
  // - CSS selector string: clears matching elements via querySelectorAll
  clear(selector?: 'modules' | string): void {
    if (selector === 'modules') {
      // clear all module-injected styles using cached references
      for (const [, style] of this.moduleStyleElements) {
        if (style.parentNode) {
          style.remove();
        }
      }
      this.moduleStyleElements.clear();
    } else if (selector) {
      // clear by custom selector (rare case, still uses querySelectorAll)
      const styles = document.querySelectorAll(selector);
      styles.forEach((style) => {
        if (style.id) {
          this.injectedIds.delete(style.id);
        }
        style.remove();
      });
    }
  }

  // clear all non-module tracked injection state (for reset operations)
  // does not remove style elements - use clear() for that
  clearTracking(): void {
    this.injectedIds.clear();
    this.moduleStyleElements.clear();
  }

  // check if a non-module style has been injected
  hasInjected(id: string): boolean {
    return this.injectedIds.has(id);
  }

  // mark a non-module style as injected (for external tracking synchronization)
  markInjected(id: string): void {
    this.injectedIds.add(id);
  }
}

// singleton instance
export const StyleInjector = new StyleInjectorImpl();
