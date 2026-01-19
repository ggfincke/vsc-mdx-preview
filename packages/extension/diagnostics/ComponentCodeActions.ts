// packages/extension/diagnostics/ComponentCodeActions.ts
// provides quick-fix code actions for component diagnostics

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DIAGNOSTIC_CODES } from './ComponentDiagnostics';
import { KNOWN_GENERIC_COMPONENTS } from '../compiler/shared/remark/generic-components';
import { debug, info } from '../logging';
import { ConfigError, ErrorContext } from '../errors';
import { getErrorReporter } from '../services';

// config file name
const CONFIG_FILE_NAME = '.mdx-previewrc.json';

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

    // filter to only our diagnostics
    const relevantDiagnostics = context.diagnostics.filter(
      (d) => d.code === DIAGNOSTIC_CODES.UNKNOWN_COMPONENT
    );

    for (const diagnostic of relevantDiagnostics) {
      // extract component name from diagnostic message
      const match = diagnostic.message.match(/Unknown component "([^"]+)"/);
      if (!match) {
        continue;
      }

      const componentName = match[1];

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

    const configPath = path.join(workspaceFolder.uri.fsPath, CONFIG_FILE_NAME);
    const action = new vscode.CodeAction(
      `Add "${componentName}" to ${CONFIG_FILE_NAME}`,
      vscode.CodeActionKind.QuickFix
    );

    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    // create command to add component to config
    action.command = {
      title: 'Add component to config',
      command: 'mdx-preview.addComponentToConfig',
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

    // create edit to replace component name with the suggestion
    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(document.uri, diagnostic.range, suggestion);

    return action;
  }

  // find similar built-in component name
  private findSimilarBuiltin(name: string): string | null {
    const lowerName = name.toLowerCase();

    // check for common aliases
    const aliases: Record<string, string> = {
      note: 'Callout',
      tip: 'Callout',
      warning: 'Callout',
      danger: 'Callout',
      info: 'Callout',
      caution: 'Callout',
      important: 'Callout',
      admonition: 'Callout',
      alert: 'Callout',
      hint: 'Callout',
      notice: 'Callout',
      accordion: 'Collapsible',
      details: 'Collapsible',
      expandable: 'Collapsible',
      toggle: 'Collapsible',
      tabgroup: 'Tabs',
      tabpanel: 'TabItem',
      tabcontent: 'TabItem',
      codeblock: 'CodeGroup',
      codetabs: 'CodeGroup',
    };

    if (aliases[lowerName]) {
      return aliases[lowerName];
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
      arguments: [
        vscode.Uri.parse(
          'https://github.com/example/mdx-preview#component-mapping'
        ),
      ],
    };

    return action;
  }
}

// command to add component to config file
export async function addComponentToConfig(
  componentName: string,
  configPath: string
): Promise<void> {
  debug(`[ComponentCodeActions] Adding ${componentName} to ${configPath}`);

  try {
    let config: Record<string, unknown> = {};

    // read existing config if it exists
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(content);
    }

    // ensure components object exists
    if (!config.components || typeof config.components !== 'object') {
      config.components = {};
    }

    // add component with placeholder path
    const components = config.components as Record<string, string>;
    if (!components[componentName]) {
      components[componentName] = `./src/components/${componentName}.tsx`;
    }

    // write updated config
    const updatedContent = JSON.stringify(config, null, 2) + '\n';
    fs.writeFileSync(configPath, updatedContent, 'utf-8');

    // open the config file
    const document = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(document);

    // show info message
    vscode.window.showInformationMessage(
      `Added "${componentName}" to ${CONFIG_FILE_NAME}. Update the path to your component file.`
    );

    info(`[ComponentCodeActions] Added ${componentName} to config`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
      'mdx-preview.addComponentToConfig',
      addComponentToConfig
    )
  );

  info('[ComponentCodeActions] Code actions registered');
}
