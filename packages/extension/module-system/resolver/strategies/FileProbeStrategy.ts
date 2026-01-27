// packages/extension/module-system/resolver/strategies/FileProbeStrategy.ts
// file probing strategy for relative imports without extensions

import * as path from 'path';
import * as fs from 'fs';
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

// I.3: async file stat result
interface AsyncStatResult {
  path: string;
  isFile: boolean;
}

// I.3: batch stat multiple paths in parallel
async function batchStatFilesAsync(
  paths: string[]
): Promise<Map<string, AsyncStatResult>> {
  const results = new Map<string, AsyncStatResult>();

  const statResults = await Promise.all(
    paths.map(async (p) => {
      try {
        const stat = await fs.promises.stat(p);
        return { path: p, isFile: stat.isFile() };
      } catch {
        return { path: p, isFile: false };
      }
    })
  );

  for (const result of statResults) {
    results.set(result.path, result);
  }

  return results;
}

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

  // I.3: async resolution with parallel file probing
  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): Promise<ResolutionResult | null> {
    const probed = await this.probeFileAsync(context.baseDir, specifier);
    if (probed) {
      debug(`[FILE-PROBE] ${specifier} -> ${probed}`);
      return buildResolutionResult(probed, specifier, ResolutionStrategy.FileProbe);
    }
    return null;
  }

  // I.3: async file probing with parallel stat calls
  private async probeFileAsync(
    baseDir: string,
    specifier: string
  ): Promise<string | null> {
    const resolved = path.resolve(baseDir, specifier);

    // skip node_modules
    if (resolved.includes('node_modules')) {
      return null;
    }

    // generate all candidate paths
    const candidates = [
      resolved, // exact path
      ...DEFAULT_EXTENSIONS.map((ext) => resolved + ext),
    ];

    // batch stat all candidates in parallel
    const results = await batchStatFilesAsync(candidates);

    // check exact path first
    const exactResult = results.get(resolved);
    if (exactResult?.isFile) {
      return resolved;
    }

    // check extensions in priority order
    for (const ext of DEFAULT_EXTENSIONS) {
      const fullPath = resolved + ext;
      const result = results.get(fullPath);
      if (result?.isFile) {
        return fullPath;
      }
    }

    // check if resolved path is a directory by trying to stat index files
    const indexCandidates = INDEX_EXTENSIONS.map((ext) =>
      path.join(resolved, `index${ext}`)
    );
    const indexResults = await batchStatFilesAsync(indexCandidates);

    for (const ext of INDEX_EXTENSIONS) {
      const indexPath = path.join(resolved, `index${ext}`);
      const result = indexResults.get(indexPath);
      if (result?.isFile) {
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
