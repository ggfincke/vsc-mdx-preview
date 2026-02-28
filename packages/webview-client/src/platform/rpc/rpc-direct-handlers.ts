// packages/webview-client/src/platform/rpc/rpc-direct-handlers.ts
// immediate (non-queued) webview RPC handlers

import type {
  TaggedLogger,
  Framework,
  WebviewRPC,
} from '@mdx-preview/contracts';
import { StyleInjector, STYLE_IDS } from '../../shared/utils/StyleInjector';
import { loadModuleSystem } from './module-system-loader';

type DirectHandlerKeys =
  | 'setCustomCss'
  | 'setTailwindCss'
  | 'setTailwindBrowserCss'
  | 'setFramework'
  | 'setUsedComponents'
  | 'invalidate'
  | 'clearAllCaches';

export type RpcDirectHandlers = Pick<WebviewRPC, DirectHandlerKeys>;

interface CreateRpcDirectHandlersOptions {
  log: TaggedLogger;
  loadModuleSystemFn?: typeof loadModuleSystem;
  documentRef?: Document;
}

export function createRpcDirectHandlers(
  options: CreateRpcDirectHandlersOptions
): RpcDirectHandlers {
  const loadModuleSystemFn = options.loadModuleSystemFn ?? loadModuleSystem;
  const documentRef = options.documentRef ?? document;

  return {
    setCustomCss(css: string): void {
      options.log.debug(`setCustomCss called, length: ${css.length}`);
      StyleInjector.inject(STYLE_IDS.CUSTOM_CSS, css);
    },

    setTailwindCss(css: string): void {
      options.log.debug(`setTailwindCss called, length: ${css.length}`);
      StyleInjector.remove(STYLE_IDS.TAILWIND_BROWSER_INPUT_CSS);
      if (!css.trim()) {
        StyleInjector.remove(STYLE_IDS.TAILWIND_CSS);
        return;
      }

      StyleInjector.inject(STYLE_IDS.TAILWIND_CSS, css, {
        insertBefore: STYLE_IDS.CUSTOM_CSS,
      });
    },

    setTailwindBrowserCss(css: string): void {
      options.log.debug(`setTailwindBrowserCss called, length: ${css.length}`);
      StyleInjector.remove(STYLE_IDS.TAILWIND_CSS);
      if (!css.trim()) {
        StyleInjector.remove(STYLE_IDS.TAILWIND_BROWSER_INPUT_CSS);
        return;
      }

      StyleInjector.inject(STYLE_IDS.TAILWIND_BROWSER_INPUT_CSS, css, {
        insertBefore: STYLE_IDS.CUSTOM_CSS,
        attributes: {
          type: 'text/tailwindcss',
        },
      });
    },

    setFramework(framework: Framework): void {
      options.log.debug(`setFramework called: ${framework}`);
      void loadModuleSystemFn()
        .then(({ ensureFrameworkShimsLoaded }) => {
          ensureFrameworkShimsLoaded(framework);
        })
        .catch((err) => {
          options.log.error(
            `Failed to load framework shims for ${framework}:`,
            err
          );
        });
    },

    setUsedComponents(components: string[]): void {
      options.log.debug(`setUsedComponents called: ${components.join(', ')}`);
      void loadModuleSystemFn()
        .then(({ ensureGenericShimsLoaded }) => {
          ensureGenericShimsLoaded(components);
        })
        .catch((err) => {
          options.log.error('Failed to load generic shims:', err);
        });
    },

    async invalidate(fsPath: string): Promise<void> {
      options.log.debug(`invalidate called: ${fsPath}`);
      const { invalidateModule } = await loadModuleSystemFn();
      invalidateModule(fsPath);
    },

    async clearAllCaches(): Promise<void> {
      options.log.debug('clearAllCaches called');
      const { clearAllCaches } = await loadModuleSystemFn();
      clearAllCaches();
      const styleElements = documentRef.querySelectorAll(
        'style[data-mdx-module]'
      );
      styleElements.forEach((el) => el.remove());
      options.log.debug('clearAllCaches complete');
    },
  };
}
