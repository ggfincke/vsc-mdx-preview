export type ModuleErrorCode =
  | 'MODULE_NOT_FOUND'
  | 'CIRCULAR_DEPENDENCY'
  | 'FETCH_FAILED'
  | 'EVALUATION_FAILED'
  | 'MODULE_DEPTH_EXCEEDED';

export interface ModuleErrorData {
  code: ModuleErrorCode;
  moduleId?: string;
  request?: string;
  parentId?: string;
  depth?: number;
}

export class ModuleError extends Error {
  readonly data: ModuleErrorData;

  constructor(message: string, data: ModuleErrorData, cause?: Error) {
    super(message);
    this.name = 'ModuleError';
    this.data = data;
    if (cause) {
      (this as { cause?: Error }).cause = cause;
    }
  }
}

export function isModuleErrorData(value: unknown): value is ModuleErrorData {
  return typeof value === 'object' && value !== null && 'code' in value;
}

export function createModuleNotFoundError(
  request: string,
  parentId: string
): ModuleError {
  return new ModuleError(
    `Module not found: "${request}" (required by "${parentId}")`,
    {
      code: 'MODULE_NOT_FOUND',
      request,
      parentId,
    }
  );
}

export function createCircularDependencyError(
  moduleId: string,
  parentId?: string
): ModuleError {
  return new ModuleError(`Circular dependency detected for "${moduleId}"`, {
    code: 'CIRCULAR_DEPENDENCY',
    moduleId,
    parentId,
  });
}

export function createFetchFailedError(
  request: string,
  parentId: string,
  cause?: Error
): ModuleError {
  return new ModuleError(
    `Failed to fetch "${request}" (requested by "${parentId}")`,
    {
      code: 'FETCH_FAILED',
      request,
      parentId,
    },
    cause
  );
}

export function createEvaluationFailedError(
  moduleId: string,
  cause?: Error
): ModuleError {
  return new ModuleError(
    `Failed to evaluate module "${moduleId}"`,
    {
      code: 'EVALUATION_FAILED',
      moduleId,
    },
    cause
  );
}

export function createModuleDepthExceededError(
  moduleId: string,
  depth: number
): ModuleError {
  return new ModuleError(
    `Module load depth exceeded for "${moduleId}" at depth ${depth}`,
    {
      code: 'MODULE_DEPTH_EXCEEDED',
      moduleId,
      depth,
    }
  );
}
