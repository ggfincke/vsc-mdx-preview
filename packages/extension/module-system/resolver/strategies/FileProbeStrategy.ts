// packages/extension/module-system/resolver/strategies/FileProbeStrategy.ts
// file probing strategy for relative imports w/o extensions

import * as path from 'path';
import { createTaggedLogger } from '../../../logging';
import { LogTags } from '@mdx-preview/shared';
import { createSingleton } from '../../../utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
  type IResolutionStrategy,
} from '../../../types';
import { buildResolutionResult } from '../result-builders';
import { probeModuleFile, probeModuleFileAsync } from '../file-prober';

// module-level tagged logger for file probe strategy
const log = createTaggedLogger(LogTags.FILE_PROBE);

// file probing strategy for relative imports
// probe for files w/ common extensions (.ts, .tsx, .js, .jsx, .mdx, .md)
// & index files when the specifier points to a directory
// skip node_modules paths (use EnhancedResolveStrategy for those)
export class FileProbeStrategy implements IResolutionStrategy {
  readonly name = 'FileProbe';

  resolve(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): ResolutionResult | null {
    const resolved = path.resolve(context.baseDir, specifier);
    const probed = probeModuleFile(resolved);

    if (probed) {
      log.debug(`${specifier} -> ${probed}`);
      return buildResolutionResult(
        probed,
        specifier,
        ResolutionStrategy.FileProbe
      );
    }
    return null;
  }

  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): Promise<ResolutionResult | null> {
    const resolved = path.resolve(context.baseDir, specifier);
    const probed = await probeModuleFileAsync(resolved);

    if (probed) {
      log.debug(`${specifier} -> ${probed}`);
      return buildResolutionResult(
        probed,
        specifier,
        ResolutionStrategy.FileProbe
      );
    }
    return null;
  }
}

// singleton instance
const { get: getFileProbeStrategy } = createSingleton(
  () => new FileProbeStrategy()
);

export { getFileProbeStrategy };
