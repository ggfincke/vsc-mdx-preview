// packages/extension/utils/validation/index.ts
// extension-host validators w/ logging & ValidationOptions
// for pure type guards (isString, isBoolean, etc.), use @mdx-preview/runtime-utils

export {
  validateString,
  validateBoolean,
  validateNumber,
  validateFunction,
} from './primitives';

export { validateArray, validateObject, validateRecord } from './collections';

export { validateUrl } from './url';

export {
  validateEnumValue,
  validatePluginSpec,
  validateConfigSchema,
  type PluginSpecValue,
  type ConfigValidationResult,
} from './schema';

export {
  type ValidationOptions,
  type LogFn,
  createOptionalValidator,
  createPrimitiveValidator,
  formatContext,
  getLogger,
} from '../validation-factory';

import { createOptionalValidator } from '../validation-factory';
import { validateNumber } from './primitives';

// validate optional number parameter (used for line/column in openDocument)
export const validateOptionalNumber = createOptionalValidator(validateNumber);
