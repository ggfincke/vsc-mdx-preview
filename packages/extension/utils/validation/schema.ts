// packages/extension/utils/validation/schema.ts
// schema and enum validators (config validation)

import {
  formatContext,
  getLogger,
  type ValidationOptions,
} from '../validation-factory';
import { validateString, validateBoolean } from './primitives';
import { validateArray, validateObject, validateRecord } from './collections';
import type { FrameworkName } from '@mdx-preview/shared';

// validates value is one of allowed enum string values
export function validateEnumValue<T extends string>(
  value: unknown,
  name: string,
  allowedValues: readonly T[],
  opts?: ValidationOptions
): T | undefined {
  const log = getLogger(opts);
  const ctx = formatContext(opts?.context);

  if (typeof value !== 'string') {
    log(`${ctx}${name} must be a string`, value);
    return undefined;
  }

  if (!allowedValues.includes(value as T)) {
    log(`${ctx}${name} must be one of: ${allowedValues.join(', ')}`, value);
    return undefined;
  }

  return value as T;
}

// type for plugin specification: string or [string, options]
export type PluginSpecValue = string | [string, Record<string, unknown>];

// validates plugin spec: string | [string, Record<string, unknown>]
export function validatePluginSpec(
  value: unknown,
  name: string,
  opts?: ValidationOptions
): PluginSpecValue | undefined {
  const log = getLogger(opts);
  const ctx = formatContext(opts?.context);

  // string plugin name is valid
  if (typeof value === 'string') {
    if (value.trim() === '') {
      log(`${ctx}${name} cannot be an empty string`);
      return undefined;
    }
    return value;
  }

  // tuple [string, object] is valid
  if (Array.isArray(value)) {
    if (value.length !== 2) {
      log(
        `${ctx}${name} tuple must have exactly 2 elements [name, options]`,
        value
      );
      return undefined;
    }

    const [pluginName, pluginOptions] = value;

    if (typeof pluginName !== 'string' || pluginName.trim() === '') {
      log(
        `${ctx}${name}[0] must be a non-empty string plugin name`,
        pluginName
      );
      return undefined;
    }

    if (
      typeof pluginOptions !== 'object' ||
      pluginOptions === null ||
      Array.isArray(pluginOptions)
    ) {
      log(`${ctx}${name}[1] must be an options object`, pluginOptions);
      return undefined;
    }

    return [pluginName, pluginOptions as Record<string, unknown>];
  }

  log(`${ctx}${name} must be a string or [string, options] tuple`, value);
  return undefined;
}

// result of config schema validation
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  config?: {
    remarkPlugins?: PluginSpecValue[];
    rehypePlugins?: PluginSpecValue[];
    components?: Record<string, string>;
    framework?: FrameworkName;
    frameworkOptions?: {
      enableShims?: boolean;
      customAliases?: Record<string, string>;
    };
    tailwind?: {
      enabled?: 'auto' | 'enabled' | 'disabled';
      configPath?: string;
    };
    unknownBehavior?: 'strip' | 'placeholder' | 'raw';
  };
}

// allowed values for validation
const FRAMEWORK_VALUES = [
  'generic',
  'docusaurus',
  'nextjs',
  'starlight',
  'nextra',
] as const;
const TAILWIND_ENABLED_VALUES = ['auto', 'enabled', 'disabled'] as const;
const UNKNOWN_BEHAVIOR_VALUES = ['strip', 'placeholder', 'raw'] as const;

// validates complete MDX Preview config schema
// returns validation result w/ errors array & validated config if valid
export function validateConfigSchema(
  config: unknown,
  opts?: Pick<ValidationOptions, 'context'>
): ConfigValidationResult {
  const errors: string[] = [];
  const collectError = (msg: string) => errors.push(msg);
  const validationOpts = {
    context: opts?.context ?? 'config',
    log: collectError,
  };

  // validate root is an object
  const cfg = validateObject(config, 'config', validationOpts);
  if (!cfg) {
    return { valid: false, errors };
  }

  const result: NonNullable<ConfigValidationResult['config']> = {};

  // validate remarkPlugins array
  if (cfg.remarkPlugins !== undefined) {
    const validated = validateArray(
      cfg.remarkPlugins,
      'remarkPlugins',
      (plugin, i) =>
        validatePluginSpec(plugin, `remarkPlugins[${i}]`, validationOpts),
      validationOpts
    );
    if (validated) {
      result.remarkPlugins = validated;
    }
  }

  // validate rehypePlugins array
  if (cfg.rehypePlugins !== undefined) {
    const validated = validateArray(
      cfg.rehypePlugins,
      'rehypePlugins',
      (plugin, i) =>
        validatePluginSpec(plugin, `rehypePlugins[${i}]`, validationOpts),
      validationOpts
    );
    if (validated) {
      result.rehypePlugins = validated;
    }
  }

  // validate components record
  if (cfg.components !== undefined) {
    const validated = validateRecord(
      cfg.components,
      'components',
      (v, key) => validateString(v, `components.${key}`, validationOpts),
      validationOpts
    );
    if (validated) {
      result.components = validated;
    }
  }

  // validate framework enum
  if (cfg.framework !== undefined) {
    const validated = validateEnumValue(
      cfg.framework,
      'framework',
      FRAMEWORK_VALUES,
      validationOpts
    );
    if (validated) {
      result.framework = validated;
    }
  }

  // validate frameworkOptions object
  if (cfg.frameworkOptions !== undefined) {
    const fOpts = validateObject(
      cfg.frameworkOptions,
      'frameworkOptions',
      validationOpts
    );
    if (fOpts) {
      result.frameworkOptions = {};

      if (fOpts.enableShims !== undefined) {
        const validated = validateBoolean(
          fOpts.enableShims,
          'frameworkOptions.enableShims',
          validationOpts
        );
        if (validated !== undefined) {
          result.frameworkOptions.enableShims = validated;
        }
      }

      if (fOpts.customAliases !== undefined) {
        const validated = validateRecord(
          fOpts.customAliases,
          'frameworkOptions.customAliases',
          (v, key) =>
            validateString(
              v,
              `frameworkOptions.customAliases.${key}`,
              validationOpts
            ),
          validationOpts
        );
        if (validated) {
          result.frameworkOptions.customAliases = validated;
        }
      }
    }
  }

  // validate tailwind options
  if (cfg.tailwind !== undefined) {
    const tw = validateObject(cfg.tailwind, 'tailwind', validationOpts);
    if (tw) {
      result.tailwind = {};

      if (tw.enabled !== undefined) {
        const validated = validateEnumValue(
          tw.enabled,
          'tailwind.enabled',
          TAILWIND_ENABLED_VALUES,
          validationOpts
        );
        if (validated) {
          result.tailwind.enabled = validated;
        }
      }

      if (tw.configPath !== undefined) {
        const validated = validateString(
          tw.configPath,
          'tailwind.configPath',
          validationOpts
        );
        if (validated) {
          result.tailwind.configPath = validated;
        }
      }
    }
  }

  // validate unknownBehavior enum
  if (cfg.unknownBehavior !== undefined) {
    const validated = validateEnumValue(
      cfg.unknownBehavior,
      'unknownBehavior',
      UNKNOWN_BEHAVIOR_VALUES,
      validationOpts
    );
    if (validated) {
      result.unknownBehavior = validated;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    config: errors.length === 0 ? result : undefined,
  };
}
