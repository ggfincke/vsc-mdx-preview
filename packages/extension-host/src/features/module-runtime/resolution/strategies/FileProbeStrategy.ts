// packages/extension-host/src/features/module-runtime/resolution/strategies/FileProbeStrategy.ts
// file probing strategy for relative imports w/o extensions

import * as path from 'path';
import { createTaggedLogger } from '../../../../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { createSingleton } from '../../../../shared/utils/singleton-factory';
import {
  ResolutionStrategy,
  type ResolutionContext,
  type ResolutionResult,
  type ResolutionMode,
  type IResolutionStrategy,
} from '../../../types';
import { buildResolutionResult } from '../resolution-builders';
import { probeModuleFile, probeModuleFileAsync } from '../file-prober';

// module-level tagged logger for file probe strategy
const log = createTaggedLogger(LogTags.FILE_PROBE);

// build resolution result from probed path
function buildProbeResult(
  specifier: string,
  probed: string | null
): ResolutionResult | null {
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
    return buildProbeResult(specifier, probeModuleFile(resolved));
  }

  async resolveAsync(
    specifier: string,
    context: ResolutionContext,
    _mode: ResolutionMode
  ): Promise<ResolutionResult | null> {
    const resolved = path.resolve(context.baseDir, specifier);
    return buildProbeResult(specifier, await probeModuleFileAsync(resolved));
  }
}

// singleton instance
const { get: getFileProbeStrategy } = createSingleton(
  () => new FileProbeStrategy()
);

export { getFileProbeStrategy };
