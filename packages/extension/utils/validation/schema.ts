// packages/extension/utils/validation/schema.ts
// schema & enum validators (config validation)

import {
  formatContext,
  getLogger,
  type ValidationOptions,
} from '../validation-factory';
import Ajv from 'ajv';
import {
  MDX_PREVIEW_CONFIG_SCHEMA,
  type FrameworkId,
} from '@mdx-preview/shared';

// validate value is one of allowed enum string values
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

// validate plugin spec: string | [string, Record<string, unknown>]
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
    framework?: FrameworkId;
    frameworkOptions?: {
      enableShims?: boolean;
      customAliases?: Record<string, string>;
    };
    tailwind?: {
      enabled?: 'auto' | 'enabled' | 'disabled';
      configPath?: string;
    };
    unknownBehavior?: 'strip' | 'placeholder' | 'raw';
    enableScripts?: boolean;
  };
}

// Note: enum arrays imported from @mdx-preview/shared (canonical source)
// FRAMEWORK_IDS, TAILWIND_ENABLED_VALUES, UNKNOWN_BEHAVIOR_VALUES

// ajv schema validator singleton
const configSchemaValidator = new Ajv({
  allErrors: true,
  allowUnionTypes: true,
  strict: false,
}).compile(MDX_PREVIEW_CONFIG_SCHEMA);

// format ajv errors for display
function formatAjvError(error: {
  instancePath?: string;
  message?: string;
  keyword?: string;
}): string {
  const path = error.instancePath
    ? `config${error.instancePath.replace(/\//g, '.')}`
    : 'config';
  const message = error.message ?? 'is invalid';
  return `${path} ${message}`;
}

// validate complete MDX Preview config schema
// return validation result w/ errors array & validated config if valid
export function validateConfigSchema(
  config: unknown,
  opts?: Pick<ValidationOptions, 'context'>
): ConfigValidationResult {
  const log = getLogger(opts);
  const ctx = formatContext(opts?.context ?? 'config');

  const valid = configSchemaValidator(config) as boolean;
  if (!valid) {
    const errors = (configSchemaValidator.errors ?? []).map(formatAjvError);
    for (const error of errors) {
      log(`${ctx}${error}`);
    }
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    config: config as ConfigValidationResult['config'],
  };
}
