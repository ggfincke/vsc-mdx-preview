// packages/contracts/src/errors/suggestions.ts
// reusable suggestion templates for module errors

import type { ModuleErrorCode } from './module-error-types';

// suggestion templates by error code
export const MODULE_ERROR_SUGGESTIONS: Record<ModuleErrorCode, string[]> = {
  E100: [
    'Check that the import path is correct',
    'Verify the file exists in your workspace',
    'For npm packages, ensure they are installed',
    'Check your .mdx-previewrc.json component mappings',
  ],
  E101: [
    'Move the file inside your workspace folder',
    'Check that symlinks resolve within workspace',
    'Verify workspace folder settings in VS Code',
  ],
  E102: [
    'Break the circular import by restructuring your modules',
    'Move shared code to a separate file that both modules can import',
    'Consider using lazy imports or dynamic imports',
  ],
  E110: [
    'Check for syntax errors in the file',
    'Verify the file encoding is UTF-8',
    'Look for unmatched brackets or quotes',
  ],
  E120: [
    'Check for unsupported JavaScript/TypeScript syntax',
    'Verify JSX/TSX syntax is correct',
    'Check Babel/TypeScript configuration',
  ],
  E140: [
    'Check that the file path is valid',
    'Verify file permissions allow reading',
    'If using TypeScript paths, ensure tsconfig.json is correct',
  ],
  E150: [
    'Check for syntax errors in the module',
    'Verify all imports are available',
    'Look for runtime errors in the code',
  ],
};

// get suggestions for an error code
export function getSuggestionsForCode(code: ModuleErrorCode): string[] {
  return MODULE_ERROR_SUGGESTIONS[code] ?? [];
}
