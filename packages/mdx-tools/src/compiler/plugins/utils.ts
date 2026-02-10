// packages/extension/compiler/plugins/utils.ts
// plugin specification parsing utilities

import type { PluginSpec, ParsedPluginSpec } from '../types';

// re-export canonical type definition from types/
export type { ParsedPluginSpec } from '../types';

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
