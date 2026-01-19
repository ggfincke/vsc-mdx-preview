// packages/extension/compiler/shared/pipeline-warnings.ts
// consolidated warning codes and messages for MDX pipeline operations
//
// This module provides consistent warning messages across both Safe and Trusted modes,
// ensuring users receive uniform feedback about pipeline configuration issues.

import { warn, info, debug } from '../../logging';

// warning codes for MDX pipeline operations
export enum PipelineWarningCode {
  // Safe Mode warnings
  CUSTOM_PLUGINS_IGNORED = 'MDX001',
  CUSTOM_COMPONENTS_IGNORED = 'MDX002',

  // Plugin loading warnings
  PLUGIN_LOAD_FAILED = 'MDX003',
  PLUGIN_INVALID_EXPORT = 'MDX004',

  // Component handling warnings
  BUILTIN_TRANSFORM_FAILED = 'MDX005',
  UNKNOWN_COMPONENT_DETECTED = 'MDX006',

  // Configuration warnings
  INVALID_CONFIG_VALUE = 'MDX007',
  CONFIG_FILE_NOT_FOUND = 'MDX008',
}

// structured warning object
export interface PipelineWarning {
  code: PipelineWarningCode;
  message: string;
  severity: 'info' | 'warning' | 'error';
  context?: Record<string, unknown>;
}

// create warning for custom plugins being ignored in Safe Mode
export function createIgnoredPluginsWarning(
  remarkCount: number,
  rehypeCount: number
): PipelineWarning {
  const total = remarkCount + rehypeCount;
  const details = [];
  if (remarkCount > 0) details.push(`${remarkCount} remark`);
  if (rehypeCount > 0) details.push(`${rehypeCount} rehype`);

  return {
    code: PipelineWarningCode.CUSTOM_PLUGINS_IGNORED,
    message:
      `Custom plugins from .mdx-previewrc.json are ignored in Safe Mode. ` +
      `${total} plugin(s) (${details.join(', ')}) will not be loaded. ` +
      `Enable Trusted Mode to use custom plugins.`,
    severity: 'warning',
    context: { remarkCount, rehypeCount, total },
  };
}

// create warning for custom components being ignored in Safe Mode
export function createIgnoredComponentsWarning(
  componentNames: string[]
): PipelineWarning {
  const count = componentNames.length;
  const names =
    count <= 3
      ? componentNames.join(', ')
      : `${componentNames.slice(0, 3).join(', ')}...`;

  return {
    code: PipelineWarningCode.CUSTOM_COMPONENTS_IGNORED,
    message:
      `Custom components configured but cannot load in Safe Mode. ` +
      `${count} component(s) (${names}) will be ignored.`,
    severity: 'warning',
    context: { count, componentNames },
  };
}

// create warning for plugin load failure
export function createPluginLoadFailureWarning(
  pluginName: string,
  error: Error
): PipelineWarning {
  return {
    code: PipelineWarningCode.PLUGIN_LOAD_FAILED,
    message: `Failed to load plugin "${pluginName}": ${error.message}`,
    severity: 'error',
    context: { pluginName, error: error.message },
  };
}

// create warning for invalid plugin export
export function createInvalidPluginExportWarning(
  pluginName: string,
  actualType: string
): PipelineWarning {
  return {
    code: PipelineWarningCode.PLUGIN_INVALID_EXPORT,
    message:
      `Plugin "${pluginName}" does not export a function. Got: ${actualType}. ` +
      `Plugins must export a function as default or named export.`,
    severity: 'error',
    context: { pluginName, actualType },
  };
}

// create warning for builtin component transform failure
export function createBuiltinTransformFailureWarning(
  componentName: string
): PipelineWarning {
  return {
    code: PipelineWarningCode.BUILTIN_TRANSFORM_FAILED,
    message:
      `Built-in component "${componentName}" could not be transformed. ` +
      `It will appear as a placeholder in Safe Mode.`,
    severity: 'warning',
    context: { componentName },
  };
}

// create warning for unknown component detection
export function createUnknownComponentWarning(
  componentName: string,
  behavior: 'strip' | 'placeholder' | 'raw'
): PipelineWarning {
  const actionMap = {
    strip: 'removed from output',
    placeholder: 'replaced with a placeholder',
    raw: 'rendered with children only',
  };

  return {
    code: PipelineWarningCode.UNKNOWN_COMPONENT_DETECTED,
    message:
      `Unknown component "${componentName}" detected in Safe Mode. ` +
      `It will be ${actionMap[behavior]}.`,
    severity: 'info',
    context: { componentName, behavior },
  };
}

// emit warning to the logging system
export function emitWarning(warning: PipelineWarning): void {
  const formattedMessage = `[${warning.code}] ${warning.message}`;

  switch (warning.severity) {
    case 'error':
      warn(formattedMessage);
      break;
    case 'warning':
      warn(formattedMessage);
      break;
    case 'info':
      info(formattedMessage);
      break;
  }
}

// emit warning for ignored Safe Mode configuration
export function warnIgnoredSafeModeConfig(config: {
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  components?: Record<string, string>;
}): void {
  const remarkCount = config.remarkPlugins?.length ?? 0;
  const rehypeCount = config.rehypePlugins?.length ?? 0;
  const hasPlugins = remarkCount > 0 || rehypeCount > 0;

  const componentNames = config.components
    ? Object.keys(config.components)
    : [];
  const hasComponents = componentNames.length > 0;

  if (hasPlugins) {
    emitWarning(createIgnoredPluginsWarning(remarkCount, rehypeCount));
  }

  if (hasComponents) {
    emitWarning(createIgnoredComponentsWarning(componentNames));
  }
}

// log debug information about plugin loading
export function logPluginLoadResult(result: {
  loaded: number;
  failed: number;
  errors: string[];
}): void {
  if (result.loaded > 0) {
    info(
      `Loaded ${result.loaded} custom plugin(s)` +
        (result.failed > 0 ? ` (${result.failed} failed)` : '')
    );
  }

  if (result.errors.length > 0) {
    debug(`Plugin errors: ${result.errors.join('; ')}`);
  }
}
