// packages/extension/compiler/trusted/component-mapper.ts
// generate import statements for custom component mappings from config

import * as vscode from 'vscode';
import { debug, info } from '../../logging';
import { toAbsolutePath, toRelativeImportPath } from '../../utils/path-utils';
import type { ResolvedConfig } from '../../types';
import { tryRequireTrustedModeForDocument } from '../../security/validateTrust';

// use shared component registry as single source of truth
import { getAllGenericComponentNames, LogTags } from '@mdx-preview/shared';

// use consolidated warning utilities
import {
  createIgnoredComponentsWarning,
  emitWarning,
} from '../shared/pipeline-warnings';

// result of generating component imports
export interface ComponentImportsResult {
  // import statements to prepend to MDX
  imports: string;
  // component object literal for MDX provider
  componentsObject: string;
  // whether any components were generated
  hasComponents: boolean;
}

// options for component import generation
export interface ComponentImportsOptions {
  // whether built-in generic shims should be auto-injected (default: true)
  builtinsEnabled?: boolean;
}

// built-in generic component names derived from shared component registry
const BUILTIN_GENERIC_COMPONENTS = getAllGenericComponentNames();

// generate import statements & components object for custom component mapping (only generates in Trusted Mode)
export function generateComponentImports(
  config: ResolvedConfig | undefined,
  documentDir: string,
  documentUri: vscode.Uri,
  options: ComponentImportsOptions = {}
): ComponentImportsResult {
  const { builtinsEnabled = true } = options;

  debug(
    `[${LogTags.COMPONENT_MAPPER}] Called with config: ${config ? JSON.stringify(config.config) : 'undefined'}`
  );
  debug(`[${LogTags.COMPONENT_MAPPER}] documentDir: ${documentDir}`);
  debug(`[${LogTags.COMPONENT_MAPPER}] builtinsEnabled: ${builtinsEnabled}`);

  const result: ComponentImportsResult = {
    imports: '',
    componentsObject: '{}',
    hasComponents: false,
  };

  // require Trusted Mode for component imports
  const trustState = tryRequireTrustedModeForDocument(
    documentUri,
    'generate component imports',
    () => {
      const components = config?.config.components;
      if (components && Object.keys(components).length > 0) {
        emitWarning(createIgnoredComponentsWarning(Object.keys(components)));
      }
    }
  );
  if (!trustState) {
    return result;
  }
  debug(
    `[${LogTags.COMPONENT_MAPPER}] trustState.canExecute: ${trustState.canExecute}`
  );

  const importStatements: string[] = [];
  const componentEntries: string[] = [];

  // track which component names are defined by user config (these take precedence)
  const userDefinedComponents = new Set<string>();

  // process user-defined components from config first
  const components = config?.config.components;
  if (components && Object.keys(components).length > 0) {
    const configDir = config.configDir;

    for (const [componentName, componentPath] of Object.entries(components)) {
      userDefinedComponents.add(componentName);

      // resolve component path relative to config directory
      const absolutePath = toAbsolutePath(componentPath, configDir);

      // convert to relative import path from document directory
      const relativePath = toRelativeImportPath(absolutePath, documentDir);

      // generate import statement w/ a safe variable name
      const safeVarName = `_component_${componentName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      importStatements.push(`import ${safeVarName} from '${relativePath}';`);
      componentEntries.push(`  ${componentName}: ${safeVarName}`);
    }
  }

  // add built-in generic shims (if enabled & not overridden by user config)
  if (builtinsEnabled) {
    for (const componentName of BUILTIN_GENERIC_COMPONENTS) {
      // skip if user has defined this component in config (user takes precedence)
      if (userDefinedComponents.has(componentName)) {
        continue;
      }

      // generate import from the component name (resolved via preload aliases in webview)
      const safeVarName = `_builtin_${componentName}`;
      importStatements.push(`import ${safeVarName} from '${componentName}';`);
      componentEntries.push(`  ${componentName}: ${safeVarName}`);
    }
  }

  if (importStatements.length > 0) {
    result.imports = importStatements.join('\n');
    result.componentsObject = `{\n${componentEntries.join(',\n')}\n}`;
    result.hasComponents = true;

    const userCount = userDefinedComponents.size;
    const builtinCount = importStatements.length - userCount;

    if (userCount > 0 && builtinCount > 0) {
      info(
        `Generated imports for ${userCount} custom component(s) & ${builtinCount} built-in shim(s)`
      );
    } else if (userCount > 0) {
      info(`Generated imports for ${userCount} custom component(s)`);
    } else if (builtinCount > 0) {
      debug(`Injected ${builtinCount} built-in generic shim(s)`);
    }

    debug(
      `[${LogTags.COMPONENT_MAPPER}] Generated imports:\n` + result.imports
    );
    debug(
      `[${LogTags.COMPONENT_MAPPER}] Components object: ` +
        result.componentsObject
    );
  } else {
    debug(`[${LogTags.COMPONENT_MAPPER}] No imports generated`);
  }

  return result;
}
