import * as path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import type { PluginLoader } from '../types';

function resolvePluginPath(specifier: string, fromDir: string): string {
  const resolver = createRequire(
    path.join(fromDir, '__mdx_tools_resolver__.js')
  );
  return resolver.resolve(specifier);
}

async function loadPluginModule(resolvedPath: string): Promise<unknown> {
  // prefer dynamic import for ESM support; fall back to require for older CJS packages
  try {
    return await import(pathToFileURL(resolvedPath).href);
  } catch {
    // in CJS context (e.g., bundled by esbuild), use native require;
    // in standalone ESM context, create require from import.meta.url
    const req =
      typeof require === 'function' ? require : createRequire(import.meta.url);
    return req(resolvedPath);
  }
}

export const DEFAULT_PLUGIN_LOADER: PluginLoader = {
  resolve: resolvePluginPath,
  load: loadPluginModule,
};
