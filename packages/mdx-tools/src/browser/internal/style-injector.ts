import type { StyleInjector } from '../types';

class DomStyleInjector implements StyleInjector {
  private moduleStyleElements: Map<string, HTMLStyleElement> = new Map();

  injectModuleCss(id: string, css: string): void {
    const style = document.createElement('style');
    style.setAttribute('data-module-id', id);
    style.textContent = css;
    document.head.appendChild(style);
    this.moduleStyleElements.set(id, style);
  }

  removeModuleCss(id: string): void {
    const style = this.moduleStyleElements.get(id);
    if (style?.parentNode) {
      style.remove();
    }
    this.moduleStyleElements.delete(id);
  }

  clearModules(): void {
    for (const style of this.moduleStyleElements.values()) {
      if (style.parentNode) {
        style.remove();
      }
    }
    this.moduleStyleElements.clear();
  }
}

let styleInjector: StyleInjector = new DomStyleInjector();

export function getStyleInjector(): StyleInjector {
  return styleInjector;
}

export function setStyleInjector(next: StyleInjector): void {
  styleInjector = next;
}
