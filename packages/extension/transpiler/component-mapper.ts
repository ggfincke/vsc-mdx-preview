// packages/extension/transpiler/component-mapper.ts
// generate import statements for custom component mappings from config

import * as path from 'path';
import { warn, debug, info } from '../logging';
import type { ResolvedConfig } from '../preview/config';
import { TrustManager, SecurityMode } from '../security/TrustManager';

// result of generating component imports
export interface ComponentImportsResult {
  // import statements to prepend to MDX
  imports: string;
  // component object literal for MDX provider
  componentsObject: string;
  // whether any components were generated
  hasComponents: boolean;
}

// generate import statements & components object for custom component mapping (only generates in Trusted Mode)
export function generateComponentImports(
  config: ResolvedConfig | undefined,
  documentDir: string
): ComponentImportsResult {
  const result: ComponentImportsResult = {
    imports: '',
    componentsObject: '{}',
    hasComponents: false,
  };

  if (!config) {
    return result;
  }

  const { components } = config.config;
  if (!components || Object.keys(components).length === 0) {
    return result;
  }

  // check trust state
  const trustManager = TrustManager.getInstance();
  const securityMode = trustManager.getMode();

  if (securityMode !== SecurityMode.Trusted) {
    warn(
      `Custom components configured but cannot load in Safe Mode. ` +
        `${Object.keys(components).length} component(s) will be ignored.`
    );
    return result;
  }

  const configDir = config.configDir;
  const importStatements: string[] = [];
  const componentEntries: string[] = [];

  for (const [componentName, componentPath] of Object.entries(components)) {
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

  if (importStatements.length > 0) {
    result.imports = importStatements.join('\n');
    result.componentsObject = `{\n${componentEntries.join(',\n')}\n}`;
    result.hasComponents = true;

    info(
      `Generated imports for ${importStatements.length} custom component(s)`
    );
    debug('Component imports:', result.imports);
  }

  return result;
}
