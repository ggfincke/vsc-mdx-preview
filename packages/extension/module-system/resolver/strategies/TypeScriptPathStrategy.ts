// packages/extension/module-system/resolver/strategies/TypeScriptPathStrategy.ts
// TypeScript path alias resolution strategy

import * as path from 'path';
import * as typescript from 'typescript';
import { debug } from '../../../logging';
import { createSingleton } from '../../../utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
} from '../../types';
import type { IResolutionStrategy } from './types';
import { buildResolutionResult } from '../result-builders';

// TypeScript path resolution strategy (tsconfig.json paths)
export class TypeScriptPathStrategy implements IResolutionStrategy {
  readonly name = 'TypeScript';

  resolve(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): ResolutionResult | null {
    if (!context.tsConfig) {
      return null;
    }

    const { tsCompilerOptions, tsCompilerHost } = context.tsConfig;
    const containingFile = path.join(context.baseDir, 'index.ts'); // virtual file

    const resolvedModule = typescript.resolveModuleName(
      specifier,
      containingFile,
      tsCompilerOptions,
      tsCompilerHost
    ).resolvedModule;

    if (resolvedModule) {
      const fsPath = resolvedModule.resolvedFileName;
      // skip .d.ts files
      if (fsPath.endsWith('.d.ts')) {
        return null;
      }
      debug(`[TYPESCRIPT] ${specifier} -> ${fsPath}`);
      return buildResolutionResult(fsPath, specifier, ResolutionStrategy.TypeScript);
    }

    return null;
  }
}

// singleton instance
const { get: getTypeScriptPathStrategy } = createSingleton(
  () => new TypeScriptPathStrategy()
);

export { getTypeScriptPathStrategy };
