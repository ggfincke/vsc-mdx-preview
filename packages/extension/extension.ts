// packages/extension/extension.ts
// extension activation & deactivation w/ trust management & command registration

'use strict';

import * as vscode from 'vscode';

import { PreviewManager } from './preview/preview-manager';
import { TrustManager } from './security/TrustManager';
import { initWebviewAppHTMLResources } from './preview/webview-manager';
import { initWorkspaceHandlers } from './workspace-manager';
import { info, debug, showOutput, getOutputChannel } from './logging';
import { StatusBarManager } from './preview/StatusBarManager';
import { ThemeManager } from './themes';
import { FrameworkDetector } from './framework';
import {
  ServiceRegistry,
  ServiceNames,
  getPreviewManager,
  getStatusBarManager,
} from './services';
import { TailwindProcessor } from './tailwind/TailwindProcessor';
import { ErrorReporter } from './errors';
import { PackageJsonWatcher } from './module-fetcher/PackageJsonWatcher';
import { clearResolverCache } from './module-fetcher/resolver-factory';
import { ConfigManager, ConfigCache } from './config';
import {
  ComponentDiagnostics,
  registerComponentCodeActions,
} from './diagnostics';
import { registerAllCommands } from './commands';
import { disposeMetaWatchers } from './nextra/MetaResolver';

// show one-time safe mode notification in untrusted workspaces
async function showSafeModeNotificationIfNeeded(
  context: vscode.ExtensionContext
): Promise<void> {
  if (vscode.workspace.isTrusted) {
    return;
  }

  // check if notification already shown for this workspace
  const hasShownNotification = context.workspaceState.get<boolean>(
    'mdx-preview.shownSafeModeNotification'
  );

  if (hasShownNotification) {
    return;
  }

  const selection = await vscode.window.showInformationMessage(
    'MDX Preview is running in Safe Mode. JavaScript execution is disabled. Trust this workspace & enable scripts for full MDX rendering.',
    'Manage Trust',
    'Learn More'
  );

  if (selection === 'Manage Trust') {
    await vscode.commands.executeCommand('workbench.trust.manage');
  } else if (selection === 'Learn More') {
    await vscode.commands.executeCommand(
      'workbench.action.openWalkthrough',
      'xyc.vscode-mdx-preview#mdx-preview.gettingStarted'
    );
  }

  // mark as shown for this workspace
  await context.workspaceState.update(
    'mdx-preview.shownSafeModeNotification',
    true
  );
}

// set up workspace trust event handlers for trust grant & revoke
function setupTrustHandlers(context: vscode.ExtensionContext): void {
  const workspaceWithTrust = vscode.workspace as typeof vscode.workspace & {
    onDidChangeWorkspaceTrust?: vscode.Event<boolean>;
  };

  const handleTrustChange = async (trusted: boolean): Promise<void> => {
    const previewManager = getPreviewManager();

    // refresh all previews w/ updated trust state
    previewManager.refreshAllPreviews();

    if (trusted) {
      // offer to enable scripts
      const selection = await vscode.window.showInformationMessage(
        'Workspace trusted. Enable scripts for full MDX rendering w/ React components?',
        'Enable Scripts',
        'Not Now'
      );

      if (selection === 'Enable Scripts') {
        await vscode.workspace
          .getConfiguration('mdx-preview')
          .update(
            'preview.enableScripts',
            true,
            vscode.ConfigurationTarget.Workspace
          );
      }
    } else {
      // show safe mode notification if trust was revoked
      showSafeModeNotificationIfNeeded(context);
    }
  };

  if (workspaceWithTrust.onDidChangeWorkspaceTrust) {
    // handle workspace trust changes (grant & revoke)
    context.subscriptions.push(
      workspaceWithTrust.onDidChangeWorkspaceTrust(handleTrustChange)
    );
  } else {
    // fallback for older VS Code versions (grant only)
    context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => handleTrustChange(true))
    );
  }

  // when enableScripts setting changes, refresh previews
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('mdx-preview.preview.enableScripts')) {
        getPreviewManager().refreshAllPreviews();
      }
    })
  );
}

// * activate extension
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  debug('[ACTIVATE] Starting extension activation...');

  // register services w/ centralized registry before using service locators
  // order matters: register services w/ no dependencies first, then dependent services
  const registry = ServiceRegistry.getInstance();
  registry.register(ServiceNames.CONFIG_MANAGER, () =>
    ConfigManager.getInstance()
  );
  registry.register(ServiceNames.CONFIG_CACHE, () => ConfigCache.getInstance());
  registry.register(ServiceNames.TRUST_MANAGER, () =>
    TrustManager.getInstance()
  );
  registry.register(ServiceNames.THEME_MANAGER, () =>
    ThemeManager.getInstance()
  );
  registry.register(ServiceNames.PREVIEW_MANAGER, () =>
    PreviewManager.getInstance()
  );
  registry.register(ServiceNames.FRAMEWORK_DETECTOR, () =>
    FrameworkDetector.getInstance()
  );
  registry.register(ServiceNames.TAILWIND_PROCESSOR, () =>
    TailwindProcessor.getInstance()
  );
  registry.register(ServiceNames.ERROR_REPORTER, () =>
    ErrorReporter.getInstance()
  );
  // wrap OutputChannel for IService compatibility (shared channel from logging.ts)
  registry.register(ServiceNames.OUTPUT_CHANNEL, () => {
    const channel = getOutputChannel();
    return {
      channel,
      dispose() {
        channel.dispose();
      },
    };
  });
  // StatusBarManager depends on TrustManager, FrameworkDetector, PreviewManager
  registry.register(ServiceNames.STATUS_BAR_MANAGER, () =>
    StatusBarManager.getInstance()
  );
  // ComponentDiagnostics for unknown component warnings
  registry.register(ServiceNames.COMPONENT_DIAGNOSTICS, () =>
    ComponentDiagnostics.getInstance()
  );
  debug('[ACTIVATE] Services registered');

  // THEN: Initialize resources (now safe to call getPreviewManager())
  debug('[ACTIVATE] Initializing webview HTML resources...');
  await initWebviewAppHTMLResources(context);
  debug('[ACTIVATE] Webview HTML resources initialized');

  initWorkspaceHandlers(context);
  debug('[ACTIVATE] Workspace handlers initialized');

  info('Extension activated');

  // show output channel automatically for debugging
  showOutput();

  // show safe mode notification if in untrusted workspace
  showSafeModeNotificationIfNeeded(context);

  // set up trust event handlers
  setupTrustHandlers(context);

  // register component diagnostics code actions
  registerComponentCodeActions(context);

  // register all commands (extracted to commands/ directory)
  context.subscriptions.push(...registerAllCommands());

  // initialize status bar manager (handles trust state & framework display)
  const statusBarManager = getStatusBarManager();
  context.subscriptions.push(...statusBarManager.getDisposables());
  statusBarManager.updateVisibility();

  // listen for VS Code color theme changes to auto-switch preview theme
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      debug('[THEME] VS Code color theme changed, refreshing previews');
      getPreviewManager().refreshAllPreviews();
    })
  );

  // start package.json watcher to auto-invalidate resolver cache
  const packageJsonWatcher = new PackageJsonWatcher();
  packageJsonWatcher.start(() => {
    clearResolverCache();
    debug('[WATCHER] Resolver cache cleared due to package file change');
  });
  context.subscriptions.push(packageJsonWatcher);

  debug('[ACTIVATE] Extension activation complete');
}

// deactivate extension
export function deactivate(): void {
  // clear resolver cache to prevent stale data on reload
  clearResolverCache();

  // dispose Nextra _meta.json file watchers
  disposeMetaWatchers();

  // dispose all registered services in reverse registration order
  // (dependent services like StatusBarManager disposed before their dependencies)
  // ConfigCache & OutputChannel are now managed by ServiceRegistry
  ServiceRegistry.getInstance().dispose();
}
