// packages/extension-host/src/features/diagnostics/ComponentCodeActions.ts
// provide quick-fix code actions for component diagnostics

import * as vscode from 'vscode';
import * as path from 'path';
import { writeFileSync } from 'fs';
import { findConfigFile } from '../preview/configuration/ConfigResolver';
import { DIAGNOSTIC_CODES, readDiagnosticCode } from './ComponentDiagnostics';
import { docsUriForCode } from './diagnostic-adapter';
import type { UnknownComponentDiagnosticData } from './types';
import { KNOWN_GENERIC_COMPONENTS } from 'mdx-forge/compiler';
import {
  getCanonicalComponentName,
  getSemanticAlias,
} from 'mdx-forge/components/registry';
import { createTaggedLogger } from '../../shared/logging/logger';
import { ConfigError, ErrorContext } from '../../shared/errors';
import { LogTags } from '@mdx-preview/contracts';
import { extractErrorMessage } from '@mdx-preview/runtime-utils';
import { CommandNames } from '../commands/command-names';
import { getErrorReporter } from '../../app/services';
import { readJsonSync } from '../../shared/utils/file-utils';

const log = createTaggedLogger(LogTags.COMPONENT_CODE_ACTIONS);

// config file name
const CONFIG_FILE_NAME = '.mdx-previewrc.json';
const UNKNOWN_COMPONENT_MESSAGE_PATTERN = /^Unknown component "([^"]+)"/;

// read component name from data first, then VS Code-preserved message text
function readComponentName(diagnostic: vscode.Diagnostic): string | null {
  const data = (diagnostic as vscode.Diagnostic & { data?: unknown }).data as
    UnknownComponentDiagnosticData | undefined;
  if (data && typeof data.componentName === 'string' && data.componentName) {
    return data.componentName;
  }

  const match = UNKNOWN_COMPONENT_MESSAGE_PATTERN.exec(diagnostic.message);
  return match?.[1] ?? null;
}

// prefer all paired tag-name ranges carried by the diagnostic
function readTagNameRanges(diagnostic: vscode.Diagnostic): vscode.Range[] {
  const data = (diagnostic as vscode.Diagnostic & { data?: unknown }).data as
    UnknownComponentDiagnosticData | undefined;
  return data?.tagNameRanges?.length ? data.tagNameRanges : [diagnostic.range];
}

// code action provider for component diagnostics
export class ComponentCodeActionsProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];

    // filter to only our diagnostics (code may be a clickable { value, target })
    const relevantDiagnostics = context.diagnostics.filter(
      (d) => readDiagnosticCode(d) === DIAGNOSTIC_CODES.UNKNOWN_COMPONENT
    );

    for (const diagnostic of relevantDiagnostics) {
      // read component name from diagnostic metadata or preserved message
      const componentName = readComponentName(diagnostic);
      if (!componentName) {
        continue;
      }

      // action: add to .mdx-previewrc.json
      const addToConfigAction = this.createAddToConfigAction(
        document,
        componentName,
        diagnostic
      );
      if (addToConfigAction) {
        actions.push(addToConfigAction);
      }

      // action: use built-in equivalent (if similar name exists)
      const useBuiltinAction = this.createUseBuiltinAction(
        document,
        componentName,
        diagnostic
      );
      if (useBuiltinAction) {
        actions.push(useBuiltinAction);
      }

      // action: learn more
      const learnMoreAction = this.createLearnMoreAction(diagnostic);
      actions.push(learnMoreAction);
    }

    return actions;
  }

  // create action to add component to .mdx-previewrc.json
  private createAddToConfigAction(
    document: vscode.TextDocument,
    componentName: string,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction | null {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return null;
    }

    const configPath =
      findConfigFile(path.dirname(document.uri.fsPath)) ??
      path.join(workspaceFolder.uri.fsPath, CONFIG_FILE_NAME);
    const action = new vscode.CodeAction(
      `Add "${componentName}" to ${CONFIG_FILE_NAME}`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    // create command to add component to config
    action.command = {
      title: 'Add component to config',
      command: CommandNames.ADD_COMPONENT_TO_CONFIG,
      arguments: [componentName, configPath],
    };

    return action;
  }

  // create action to use built-in equivalent
  private createUseBuiltinAction(
    document: vscode.TextDocument,
    componentName: string,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction | null {
    // check if there's a similar built-in component
    const suggestion = this.findSimilarBuiltin(componentName);
    if (!suggestion) {
      return null;
    }

    const action = new vscode.CodeAction(
      `Use built-in "${suggestion}" instead`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];

    // replace only tag names so paired element children survive
    action.edit = new vscode.WorkspaceEdit();
    for (const range of readTagNameRanges(diagnostic)) {
      action.edit.replace(document.uri, range, suggestion);
    }

    return action;
  }

  // find similar built-in component name
  private findSimilarBuiltin(name: string): string | null {
    const lowerName = name.toLowerCase();

    // check registry for canonical component alias resolution
    const canonical =
      getCanonicalComponentName(name) ?? getCanonicalComponentName(lowerName);
    if (canonical) {
      return canonical;
    }

    // semantic alias lookup from registry
    const semanticMatch = getSemanticAlias(name);
    if (semanticMatch) {
      return semanticMatch;
    }

    // check if exact match in builtins (different case)
    for (const builtin of KNOWN_GENERIC_COMPONENTS) {
      if (builtin.toLowerCase() === lowerName) {
        return builtin;
      }
    }

    return null;
  }

  // create action to open documentation
  private createLearnMoreAction(
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Learn about component mapping',
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];

    action.command = {
      title: 'Open documentation',
      command: 'vscode.open',
      arguments: [docsUriForCode(DIAGNOSTIC_CODES.UNKNOWN_COMPONENT)],
    };

    return action;
  }
}

// command to add component to config file
export async function addComponentToConfig(
  componentName: string,
  configPath: string
): Promise<void> {
  log.debug(`Adding ${componentName} to ${configPath}`);

  try {
    // only create fresh config when the target does not exist
    let readError: unknown;
    const existingConfig = readJsonSync<Record<string, unknown>>(configPath, {
      onError: (error) => {
        readError = error;
      },
    });
    const missing =
      readError instanceof Error &&
      (readError as NodeJS.ErrnoException).code === 'ENOENT';
    const config: Record<string, unknown> | null = missing
      ? {}
      : existingConfig;
    if (config === null) {
      throw new Error(`Malformed JSON in ${configPath}; update refused`);
    }

    // ensure components object exists
    if (!config.components || typeof config.components !== 'object') {
      config.components = {};
    }

    // add component w/ placeholder path
    const components = config.components as Record<string, string>;
    if (!components[componentName]) {
      components[componentName] = `./src/components/${componentName}.tsx`;
    }

    // write updated config
    const updatedContent = JSON.stringify(config, null, 2) + '\n';
    writeFileSync(configPath, updatedContent, 'utf-8');

    // open the config file
    const document = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(document);

    // show info message
    vscode.window.showInformationMessage(
      `Added "${componentName}" to ${CONFIG_FILE_NAME}. Update the path to your component file.`
    );

    log.info(`Added ${componentName} to config`);
  } catch (err) {
    const message = extractErrorMessage(err);
    getErrorReporter().reportToUser(
      new ConfigError(
        `Failed to update ${CONFIG_FILE_NAME}: ${message}`,
        'CONFIG_PARSE_ERROR',
        configPath
      ),
      ErrorContext.Config
    );
  }
}

// register the code action provider
export function registerComponentCodeActions(
  context: vscode.ExtensionContext
): void {
  // register code action provider
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: 'mdx', scheme: 'file' },
      new ComponentCodeActionsProvider(),
      {
        providedCodeActionKinds:
          ComponentCodeActionsProvider.providedCodeActionKinds,
      }
    )
  );

  // register command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      CommandNames.ADD_COMPONENT_TO_CONFIG,
      addComponentToConfig
    )
  );

  log.info('Code actions registered');
}
