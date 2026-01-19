// packages/extension/module-system/resolver/strategies/FileProbeStrategy.ts
// File probing strategy for relative imports without extensions

import * as fs from 'fs';
import * as path from 'path';
import { debug } from '../../../logging';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
} from '../../types';
import type { IResolutionStrategy } from './types';

// default extensions for file probing
const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mdx', '.md'];
const INDEX_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * File probing strategy for relative imports.
 * Probes filesystem for files with common extensions when exact path doesn't exist.
 */
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
      return {
        fsPath: probed,
        isBuiltInShim: false,
        specifier,
        strategy: ResolutionStrategy.FileProbe,
      };
    }
    return null;
  }

  /**
   * Probe for a file with common extensions.
   * Tries: exact path, path + extensions, path/index + extensions
   */
  private probeFile(baseDir: string, specifier: string): string | null {
    const resolved = path.resolve(baseDir, specifier);

    // skip node_modules
    if (resolved.includes('node_modules')) {
      return null;
    }

    // check exact path
    try {
      const stat = fs.statSync(resolved);
      if (stat.isFile()) {
        return resolved;
      }
    } catch {
      // continue
    }

    // try with extensions
    for (const ext of DEFAULT_EXTENSIONS) {
      const fullPath = resolved + ext;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          return fullPath;
        }
      } catch {
        // continue
      }
    }

    // try index files
    for (const ext of INDEX_EXTENSIONS) {
      const indexPath = path.join(resolved, `index${ext}`);
      try {
        const stat = fs.statSync(indexPath);
        if (stat.isFile()) {
          return indexPath;
        }
      } catch {
        // continue
      }
    }

    return null;
  }
}

// singleton instance
let instance: FileProbeStrategy | null = null;

export function getFileProbeStrategy(): FileProbeStrategy {
  if (!instance) {
    instance = new FileProbeStrategy();
  }
  return instance;
}
