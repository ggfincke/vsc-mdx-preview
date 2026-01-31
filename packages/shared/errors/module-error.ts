// packages/shared/errors/module-error.ts
// define shared module error base class for extension & webview

import type { ModuleErrorCode, ModuleErrorData } from './module-error-types';
import { formatModuleErrorDisplay } from './module-error-types';
import { getSuggestionsForCode } from './suggestions';

export interface ModuleErrorOptions<
  TCode extends ModuleErrorCode = ModuleErrorCode,
> {
  code: TCode;
  moduleId: string;
  parentModuleId?: string;
  cause?: Error;
  suggestions?: string[];
  recoverable?: boolean;
}

export class ModuleError<
  TCode extends ModuleErrorCode = ModuleErrorCode,
> extends Error {
  readonly code: TCode;
  readonly moduleId: string;
  readonly parentModuleId?: string;
  readonly suggestions: string[];
  readonly recoverable: boolean;
  readonly cause?: Error;

  constructor(message: string, options: ModuleErrorOptions<TCode>) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.moduleId = options.moduleId;
    this.parentModuleId = options.parentModuleId;
    this.suggestions =
      options.suggestions ??
      getSuggestionsForCode(options.code as ModuleErrorCode);
    this.recoverable = options.recoverable ?? true;
    this.cause = options.cause;

    if (options.cause) {
      (this as { cause?: Error }).cause = options.cause;
    }

    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }

  toModuleErrorData(): ModuleErrorData {
    return {
      code: this.code as ModuleErrorCode,
      message: this.message,
      moduleId: this.moduleId,
      parentModuleId: this.parentModuleId,
      suggestions: this.suggestions,
      recoverable: this.recoverable,
      stack: this.stack,
      causeMessage: this.cause?.message,
    };
  }

  toDisplayMessage(): string {
    return formatModuleErrorDisplay(this.toModuleErrorData());
  }
}
