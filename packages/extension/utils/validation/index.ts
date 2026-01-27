// packages/extension/utils/validation/index.ts
// barrel export for validation utilities (backward compatibility)

export {
  validateString,
  validateBoolean,
  validateNumber,
  validateFunction,
} from './primitives';

export { validateOptionalNumber } from './optional';

export { validateArray, validateObject, validateRecord } from './collections';

export { validateUrl } from './url';

export {
  validateEnumValue,
  validatePluginSpec,
  validateConfigSchema,
} from './schema';

export type {
  ValidationOptions,
  PluginSpecValue,
  ConfigValidationResult,
} from './types';
