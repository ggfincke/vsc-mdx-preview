// packages/extension/transpiler/component-mapper.ts
// generate import statements for custom component mappings from config

import * as path from 'path';
import { warn, debug, info } from '../logging';
import type { ResolvedConfig } from '../preview/config';
import { SecurityMode } from '../security/TrustManager';
import { getTrustManager } from '../services';

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

// built-in generic component names that can be auto-injected
// these map directly to preloaded shims in the webview
const BUILTIN_GENERIC_COMPONENTS = [
  'Callout',
  'Alert',
  'Admonition',
  'Collapsible',
  'Accordion',
  'Tabs',
  'TabItem',
  'Tab',
  'CodeGroup',
] as const;

// generate import statements & components object for custom component mapping (only generates in Trusted Mode)
export function generateComponentImports(
  config: ResolvedConfig | undefined,
  documentDir: string,
  options: ComponentImportsOptions = {}
): ComponentImportsResult {
  const { builtinsEnabled = true } = options;

  const result: ComponentImportsResult = {
    imports: '',
    componentsObject: '{}',
    hasComponents: false,
  };

  // check trust state - only generate in Trusted Mode
  const trustManager = getTrustManager();
  const securityMode = trustManager.getMode();

  if (securityMode !== SecurityMode.Trusted) {
    const components = config?.config.components;
    if (components && Object.keys(components).length > 0) {
      warn(
        `Custom components configured but cannot load in Safe Mode. ` +
          `${Object.keys(components).length} component(s) will be ignored.`
      );
    }
    return result;
  }

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
      const absolutePath = path.isAbsolute(componentPath)
        ? componentPath
        : path.resolve(configDir, componentPath);

      // convert to relative path from document directory
      let relativePath = path.relative(documentDir, absolutePath);

      // ensure path starts with ./ for relative imports
      if (!relativePath.startsWith('.') && !relativePath.startsWith('/')) {
        relativePath = './' + relativePath;
      }

      // normalize path separators for imports
      relativePath = relativePath.replace(/\\/g, '/');

      // generate import statement w/ a safe variable name
      const safeVarName = `_component_${componentName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      importStatements.push(`import ${safeVarName} from '${relativePath}';`);
      componentEntries.push(`  ${componentName}: ${safeVarName}`);
    }
  }

  // add built-in generic shims (if enabled and not overridden by user config)
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
        `Generated imports for ${userCount} custom component(s) and ${builtinCount} built-in shim(s)`
      );
    } else if (userCount > 0) {
      info(`Generated imports for ${userCount} custom component(s)`);
    } else if (builtinCount > 0) {
      debug(`Injected ${builtinCount} built-in generic shim(s)`);
    }

    debug('Component imports:', result.imports);
  }

  return result;
}
