// packages/extension-host/src/shared/utils/validation/schema.ts
// schema & enum validators (config validation)

import {
  formatContext,
  getLogger,
  type ValidationOptions,
} from '../validation-factory';
import Ajv from 'ajv';
import {
  type FrameworkId,
  MDX_PREVIEW_CONFIG_SCHEMA,
} from '@mdx-preview/contracts';

// type for plugin specification: string or [string, options]
export type PluginSpecValue = string | [string, Record<string, unknown>];

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
