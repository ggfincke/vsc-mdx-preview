// packages/extension/extension.ts
// extension activation & deactivation w/ trust management & command registration

'use strict';

import * as vscode from 'vscode';

import { PreviewManager } from './preview/preview-manager';
import { TrustManager } from './security/TrustManager';
import { initWebviewAppHTMLResourcesAsync } from './preview/webview-manager';
import { initPrewarm } from './prewarm';
import { initWorkspaceHandlers } from './workspace-manager';
import { info, debug, showOutput, getOutputChannel } from './logging';
import { LogTags } from '@mdx-preview/shared';
import { StatusBarManager } from './preview/StatusBarManager';
import { ThemeManager } from './themes';
import { FrameworkDetector } from './framework/FrameworkDetector';
import {
  ServiceRegistry,
  ServiceNames,
  getPreviewManager,
  getStatusBarManager,
  getConfigManager,
} from './services';
import { TailwindProcessor } from './tailwind/TailwindProcessor';
import { ErrorReporter } from './errors';
import { PackageJsonWatcher } from './module-system/resolver/PackageJsonWatcher';
import { clearResolverCache } from './module-system/resolver/resolver-factory';
import { clearSassCache } from './module-system/handlers';
import { registerResolverSubsystem } from './module-system/resolver/resolver-subsystem';
import { registerCacheSubsystem } from './cache-subsystem';
import { ConfigManager, ConfigCache } from './config';
import {
  ComponentDiagnostics,
  registerComponentCodeActions,
} from './diagnostics';
import { registerAllCommands } from './commands';
import { MetaResolver } from './nextra/MetaResolver';

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
    await previewManager.refreshAllPreviews();

    if (trusted) {
      // offer to enable scripts
      const selection = await vscode.window.showInformationMessage(
        'Workspace trusted. Enable scripts for full MDX rendering w/ React components?',
        'Enable Scripts',
        'Not Now'
      );

      if (selection === 'Enable Scripts') {
        await getConfigManager().set(
          'preview.enableScripts',
          true,
          vscode.ConfigurationTarget.Workspace
        );
      }
    } else {
      // show safe mode notification if trust was revoked
      await showSafeModeNotificationIfNeeded(context);
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

// activate extension
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  debug(`[${LogTags.ACTIVATE}] Starting extension activation...`);

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
  // MetaResolver for Nextra _meta.json resolution
  registry.register(ServiceNames.META_RESOLVER, () =>
    MetaResolver.getInstance()
  );
  debug(`[${LogTags.ACTIVATE}] Services registered`);

  // register subsystems (AFTER services, so they dispose BEFORE services)
  registerResolverSubsystem();
  registerCacheSubsystem();
  debug(`[${LogTags.ACTIVATE}] Subsystems registered`);

  // G.3 optimization: Initialize resources in background (non-blocking)
  // Resources will be awaited when first preview panel is created
  debug(
    `[${LogTags.ACTIVATE}] Starting webview HTML resource initialization (background)...`
  );
  initWebviewAppHTMLResourcesAsync(context);
  debug(`[${LogTags.ACTIVATE}] Webview HTML resource initialization started`);

  // G.5 optimization: Initialize prewarm coordinator for improved first-render UX
  debug(`[${LogTags.ACTIVATE}] Initializing prewarm coordinator`);
  context.subscriptions.push(initPrewarm());

  initWorkspaceHandlers(context);
  debug(`[${LogTags.ACTIVATE}] Workspace handlers initialized`);

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
      debug(
        `[${LogTags.THEME}] VS Code color theme changed, refreshing previews`
      );
      getPreviewManager().refreshAllPreviews();
    })
  );

  // start package.json watcher to auto-invalidate resolver & sass caches
  const packageJsonWatcher = new PackageJsonWatcher(() => {
    clearResolverCache();
    clearSassCache();
    debug(
      `[${LogTags.WATCHER}] Resolver & Sass caches cleared due to package file change`
    );
  });
  void packageJsonWatcher.start();
  context.subscriptions.push(packageJsonWatcher);

  debug(`[${LogTags.ACTIVATE}] Extension activation complete`);
}

// deactivate extension
export function deactivate(): void {
  // single disposal call handles everything
  // 1. subsystems (resolver, meta) disposed first (reverse registration order)
  // 2. services disposed second (reverse registration order)
  ServiceRegistry.getInstance().dispose();
}
