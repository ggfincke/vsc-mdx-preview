// packages/contracts/src/errors/module-error-types.ts
// shared module error types for extension & webview environments

// unified module error codes (E100-E199 range)
export type ModuleErrorCode =
  // MODULE_NOT_FOUND
  | 'E100'
  // OUTSIDE_WORKSPACE
  | 'E101'
  // CIRCULAR_DEPENDENCY
  | 'E102'
  // PARSE_ERROR
  | 'E110'
  // TRANSFORM_ERROR
  | 'E120'
  // FETCH_FAILED (webview RPC failure)
  | 'E140'
  // EVALUATION_FAILED (runtime error)
  | 'E150';

// serializable module error data (crosses RPC boundary)
export interface ModuleErrorData {
  code: ModuleErrorCode;
  message: string;
  moduleId: string;
  parentModuleId?: string;
  suggestions: string[];
  recoverable: boolean;
  stack?: string;
  causeMessage?: string;
}

// type guard for ModuleErrorData
export function isModuleErrorData(value: unknown): value is ModuleErrorData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'moduleId' in value &&
    typeof (value as ModuleErrorData).code === 'string' &&
    typeof (value as ModuleErrorData).message === 'string' &&
    typeof (value as ModuleErrorData).moduleId === 'string'
  );
}
