// packages/extension-host/src/features/module-runtime/resolution/resolution-context.ts
// build canonical module resolution context from preview-owned inputs

import * as vscode from 'vscode';
import { getFrameworkDetector } from '../../../app/services';
import type {
  ResolutionContext,
  TypeScriptConfiguration,
} from '../types/module-system';

interface BuildResolutionContextOptions {
  baseDir: string;
  documentUri: vscode.Uri;
  entryFsDirectory: string | null;
  tsConfig?: TypeScriptConfiguration;
  workspaceRoot?: string | null;
}

export function buildResolutionContext(
  options: BuildResolutionContextOptions
): ResolutionContext {
  const frameworkDetector = getFrameworkDetector();
  const frameworkInfo = frameworkDetector.getFramework(options.documentUri);
  const workspaceRoot =
    options.workspaceRoot ??
    vscode.workspace.getWorkspaceFolder(options.documentUri)?.uri.fsPath ??
    options.entryFsDirectory ??
    undefined;

  return {
    baseDir: options.baseDir,
    tsConfig: options.tsConfig,
    framework: frameworkInfo.framework,
    workspaceRoot,
    shimsEnabled: frameworkDetector.areShimsEnabled(options.documentUri),
  };
}
