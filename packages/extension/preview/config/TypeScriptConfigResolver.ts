// packages/extension/preview/config/TypeScriptConfigResolver.ts
// resolve TypeScript configuration from tsconfig.json for MDX compilation

import * as typescript from 'typescript';
import { error as logError } from '../../logging';

export interface TypeScriptConfiguration {
  tsCompilerOptions: typescript.CompilerOptions;
  tsCompilerHost: typescript.CompilerHost;
}

// resolve TypeScript configuration from a tsconfig.json file
// handles extends, paths, baseUrl, references, etc.
export function resolveTypescriptConfig(
  configFile: string | null
): TypeScriptConfiguration {
  let tsCompilerOptions: typescript.CompilerOptions;

  if (configFile) {
    // use getParsedCommandLineOfConfigFile for full tsconfig resolution
    // properly handles extends, paths, baseUrl, references
    const parsedConfig = typescript.getParsedCommandLineOfConfigFile(
      configFile,
      // existing options to merge
      {},
      {
        ...typescript.sys,
        onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
          logError(
            'TypeScript config error',
            typescript.flattenDiagnosticMessageText(
              diagnostic.messageText,
              '\n'
            )
          );
        },
      }
    );

    if (parsedConfig) {
      tsCompilerOptions = parsedConfig.options;
    } else {
      // fallback if parsing fails
      tsCompilerOptions = typescript.getDefaultCompilerOptions();
    }
  } else {
    tsCompilerOptions = typescript.getDefaultCompilerOptions();
  }

  // override certain options for preview purposes
  delete tsCompilerOptions.emitDeclarationOnly;
  delete tsCompilerOptions.declaration;
  tsCompilerOptions.module = typescript.ModuleKind.ESNext;
  tsCompilerOptions.target = typescript.ScriptTarget.ESNext;
  tsCompilerOptions.noEmitHelpers = false;
  tsCompilerOptions.importHelpers = false;

  const tsCompilerHost = typescript.createCompilerHost(tsCompilerOptions);

  return {
    tsCompilerHost,
    tsCompilerOptions,
  };
}

// find tsconfig.json for a given directory
export function findTsConfig(directory: string): string | undefined {
  return typescript.findConfigFile(directory, typescript.sys.fileExists);
}
