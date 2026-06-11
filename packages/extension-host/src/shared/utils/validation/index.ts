// packages/extension-host/src/shared/utils/validation/index.ts
// extension-host validators w/ logging & ValidationOptions

export { validateString, validateBoolean, validateNumber } from './primitives';

export { validateArray, validateObject, validateRecord } from './collections';

export { validateUrl } from './url';

export {
  validateConfigSchema,
  type PluginSpecValue,
  type ConfigValidationResult,
} from './schema';

export {
  type ValidationOptions,
  type LogFn,
  createOptionalValidator,
  formatContext,
  getLogger,
} from '../validation-factory';

import { createOptionalValidator } from '../validation-factory';
import { validateNumber } from './primitives';

// validate optional number parameter (used for line/column in openDocument)
export const validateOptionalNumber = createOptionalValidator(validateNumber);
