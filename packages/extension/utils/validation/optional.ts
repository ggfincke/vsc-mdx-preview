// packages/extension/utils/validation/optional.ts
// optional value validators (wrappers that pass undefined through w/o logging)

import { createOptionalValidator } from '../validation-factory';
import { validateNumber } from './primitives';

// validate optional number parameter (used for line/column in openDocument)
// return validated number, or undefined if value is undefined or invalid
// does not log for undefined values (they're optional) - factory-generated wrapper
export const validateOptionalNumber = createOptionalValidator(validateNumber);

// NOTE: validateOptionalString was removed as it was exported but never used
