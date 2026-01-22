// packages/extension/compiler/plugins/utils.ts
// plugin specification parsing utilities

import type { PluginSpec } from '../types';

// parsed plugin specification w/ separated name & options
export interface ParsedPluginSpec {
  // plugin name (npm package or relative path)
  name: string;
  // plugin options object, undefined if none specified
  options: Record<string, unknown> | undefined;
}

// parse a plugin specification to extract name & options
export function parsePluginSpec(spec: PluginSpec): ParsedPluginSpec {
  if (typeof spec === 'string') {
    return { name: spec, options: undefined };
  }
  return { name: spec[0], options: spec[1] };
}

// extract just the plugin name from a specification
export function getPluginName(spec: PluginSpec): string {
  return typeof spec === 'string' ? spec : spec[0];
}
