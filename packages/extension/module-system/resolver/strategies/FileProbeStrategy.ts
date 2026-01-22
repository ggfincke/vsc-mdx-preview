// packages/extension/module-system/resolver/strategies/FileProbeStrategy.ts
// file probing strategy for relative imports without extensions

import * as path from 'path';
import { debug } from '../../../logging';
import { fileExistsAsFile } from '../../../utils/file-utils';
import { createSingleton } from '../../../utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
} from '../../types';
import type { IResolutionStrategy } from './types';
import { buildResolutionResult } from '../result-builders';

// default extensions for file probing
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mdx', '.md'];
const INDEX_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// file probing strategy for relative imports
export class FileProbeStrategy implements IResolutionStrategy {
  readonly name = 'FileProbe';

  resolve(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): ResolutionResult | null {
    const probed = this.probeFile(context.baseDir, specifier);
    if (probed) {
      debug(
        `[FILE-PROBE] ${specifier} -> ${probed}`
      );
      return buildResolutionResult(probed, specifier, ResolutionStrategy.FileProbe);
    }
    return null;
  }

  // probe for a file w/ common extensions
  private probeFile(baseDir: string, specifier: string): string | null {
    const resolved = path.resolve(baseDir, specifier);

    // skip node_modules
    if (resolved.includes('node_modules')) {
      return null;
    }

    // check exact path
    if (fileExistsAsFile(resolved)) {
      return resolved;
    }

    // try w/ extensions
    for (const ext of DEFAULT_EXTENSIONS) {
      const fullPath = resolved + ext;
      if (fileExistsAsFile(fullPath)) {
        return fullPath;
      }
    }

    // try index files
    for (const ext of INDEX_EXTENSIONS) {
      const indexPath = path.join(resolved, `index${ext}`);
      if (fileExistsAsFile(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }
}

// singleton instance
const { get: getFileProbeStrategy } = createSingleton(
  () => new FileProbeStrategy()
);

export { getFileProbeStrategy };
