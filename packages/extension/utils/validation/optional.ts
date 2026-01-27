// packages/extension/utils/validation/optional.ts
// optional value validators (wrappers that pass undefined through without logging)

import { createOptionalValidator } from '../validation-factory';
import { validateNumber } from './primitives';

// validates an optional number parameter (used for line/column in openDocument)
// returns the validated number, or undefined if the value is undefined or invalid
// does not log for undefined values (they're optional) - factory-generated wrapper
export const validateOptionalNumber = createOptionalValidator(validateNumber);

// NOTE: validateOptionalString was removed as it was exported but never used
