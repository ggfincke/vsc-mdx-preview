// packages/extension-host/src/entry/activate.ts
// extension activation & deactivation w/ trust management & command registration

'use strict';

import * as vscode from 'vscode';

import { PreviewManager } from '../features/preview/preview-manager';
import { TrustManager } from '../features/security/TrustManager';
import { initWebviewAppHTMLResourcesAsync } from '../features/preview/webview-manager';
import { initPrewarm } from '../features/prewarm';
import { initWorkspaceHandlers } from '../app/workspace-events';
import {
  createTaggedLogger,
  showOutput,
  getOutputChannel,
  initLogging,
  isDebugEnabled,
} from '../shared/logging/logger';
import { LogTags } from '@mdx-preview/contracts';
import { SETTINGS } from '../shared/config/ConfigManager';
import { EXTENSION_DISPLAY_NAME } from '../shared/constants';

const log = createTaggedLogger(LogTags.ACTIVATE);
const themeLog = createTaggedLogger(LogTags.THEME);
const watcherLog = createTaggedLogger(LogTags.WATCHER);
import { StatusBarManager } from '../features/preview/StatusBarManager';
import { ThemeManager } from '../features/themes';
import { FrameworkDetector } from '../features/framework/FrameworkDetector';
import {
  ServiceRegistry,
  ServiceNames,
  type ServiceName,
  getPreviewManager,
  getStatusBarManager,
  getConfigManager,
  getTrustManager,
  getErrorReporter,
} from '../app/services';
import type { ServiceFactory, IService } from '../app/services/types';
import { TailwindProcessor } from '../features/tailwind/TailwindProcessor';
import { ErrorReporter, ErrorContext, ErrorSeverity } from '../shared/errors';
import { PackageJsonWatcher } from '../features/module-runtime/resolution/PackageJsonWatcher';
import { invalidateResolution } from '../features/module-runtime/resolution/resolver-factory';
import { clearSassCache } from '../features/module-runtime/handlers';
import { registerResolverSubsystem } from '../features/module-runtime/resolution/resolver-subsystem';
import { registerCacheSubsystem } from '../app/lifecycle/cache-subsystem';
import { ConfigManager, ConfigCache } from '../shared/config';
import {
  ComponentDiagnostics,
  registerComponentCodeActions,
} from '../features/diagnostics';
import { registerLanguageProviders } from '../features/language';
import { registerAllCommands } from '../features/commands';
import { MetaResolver } from '../features/framework/nextra/MetaResolver';

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
    `${EXTENSION_DISPLAY_NAME} is running in Safe Mode. JavaScript execution is disabled. Trust this workspace & enable scripts for full MDX rendering.`,
    'Manage Trust',
    'Learn More'
  );

  if (selection === 'Manage Trust') {
    await vscode.commands.executeCommand('workbench.trust.manage');
  } else if (selection === 'Learn More') {
    await vscode.commands.executeCommand(
      'workbench.action.openWalkthrough',
      'ggfincke.vsc-mdx-preview#mdx-preview.gettingStarted'
    );
  }

  // mark as shown for this workspace
  await context.workspaceState.update(
    'mdx-preview.shownSafeModeNotification',
    true
  );
}

// log unhandled rejections to output without interrupting the user w/ popups
export function reportUnhandledPromiseRejection(reason: unknown): void {
  const message =
    reason instanceof Error ? reason.message : String(reason ?? 'Unknown');
  const error = new Error(`Unhandled promise rejection: ${message}`);

  if (reason instanceof Error && reason.stack) {
    error.stack = reason.stack;
  }

  try {
    getErrorReporter().report(error, {
      context: ErrorContext.Extension,
      severity: ErrorSeverity.Error,
      showNotification: false,
      metadata:
        reason instanceof Error
          ? { rejectionName: reason.name }
          : { rejectionValueType: typeof reason },
    });
  } catch (reportError: unknown) {
    log.error('Failed to report unhandled promise rejection', reportError);
  }
}

function handleUnhandledPromiseRejection(reason: unknown): void {
  reportUnhandledPromiseRejection(reason);
}

let unhandledRejectionDisposable: vscode.Disposable | null = null;

export function registerUnhandledRejectionHandler(
  context: vscode.ExtensionContext
): void {
  if (unhandledRejectionDisposable) {
    return;
  }

  process.on('unhandledRejection', handleUnhandledPromiseRejection);
  unhandledRejectionDisposable = {
    dispose() {
      process.off('unhandledRejection', handleUnhandledPromiseRejection);
      unhandledRejectionDisposable = null;
    },
  };
  context.subscriptions.push(unhandledRejectionDisposable);
}

export function disposeUnhandledRejectionHandler(): void {
  unhandledRejectionDisposable?.dispose();
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
          SETTINGS.ENABLE_SCRIPTS,
          true,
          vscode.ConfigurationTarget.Workspace
        );
      }
    } else {
      // show safe mode notification if trust was revoked
      await showSafeModeNotificationIfNeeded(context);
    }
  };

  const scheduleTrustChange = (trusted: boolean): void => {
    void handleTrustChange(trusted).catch((error) => {
      log.error('Failed to handle workspace trust change', error);
    });
  };

  if (workspaceWithTrust.onDidChangeWorkspaceTrust) {
    // handle workspace trust changes (grant & revoke)
    context.subscriptions.push(
      workspaceWithTrust.onDidChangeWorkspaceTrust(scheduleTrustChange)
    );
  } else {
    // fallback for older VS Code versions (grant only)
    context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => scheduleTrustChange(true))
    );
  }

  // subscribe to TrustManager for enableScripts changes
  // track to avoid double-refresh (trust change handler already refreshes)
  let lastCanExecute = getTrustManager().canExecute();
  context.subscriptions.push(
    getTrustManager().subscribe((state) => {
      if (state.canExecute !== lastCanExecute) {
        lastCanExecute = state.canExecute;
        void getPreviewManager()
          .refreshAllPreviews()
          .catch((error) => {
            log.error('Failed to refresh previews after trust change', error);
          });
      }
    })
  );
}

// activate extension
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  log.debug('Starting extension activation...');

  // handle unhandled promise rejections
  registerUnhandledRejectionHandler(context);

  // register services w/ centralized registry before using service locators
  // order matters: register services w/ no dependencies first, then dependent services
  const registry = ServiceRegistry.getInstance();

  // uniform getInstance() registrations driven from an ordered table
  // (registration order = disposal order reversed)
  const registerServices = (
    entries: readonly [ServiceName, ServiceFactory<IService>][]
  ): void => {
    for (const [name, factory] of entries) {
      registry.register(name, factory);
    }
  };

  registerServices([
    [ServiceNames.CONFIG_MANAGER, () => ConfigManager.getInstance()],
  ]);
  registerServices([
    [ServiceNames.CONFIG_CACHE, () => ConfigCache.getInstance()],
  ]);

  // initialize logging w/ reactive debug setting (after ConfigManager)
  context.subscriptions.push(initLogging());

  // StatusBarManager depends on TrustManager, FrameworkDetector, PreviewManager
  // COMPONENT_DIAGNOSTICS: unknown component warnings; META_RESOLVER: Nextra _meta.json
  registerServices([
    [ServiceNames.TRUST_MANAGER, () => TrustManager.getInstance()],
    [ServiceNames.THEME_MANAGER, () => ThemeManager.getInstance()],
    [ServiceNames.PREVIEW_MANAGER, () => PreviewManager.getInstance()],
    [ServiceNames.FRAMEWORK_DETECTOR, () => FrameworkDetector.getInstance()],
    [ServiceNames.TAILWIND_PROCESSOR, () => TailwindProcessor.getInstance()],
    [ServiceNames.ERROR_REPORTER, () => ErrorReporter.getInstance()],
  ]);

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

  registerServices([
    [ServiceNames.STATUS_BAR_MANAGER, () => StatusBarManager.getInstance()],
    [
      ServiceNames.COMPONENT_DIAGNOSTICS,
      () => ComponentDiagnostics.getInstance(),
    ],
    [ServiceNames.META_RESOLVER, () => MetaResolver.getInstance()],
  ]);
  log.debug('Services registered');

  // register subsystems (AFTER services, so they dispose BEFORE services)
  registerResolverSubsystem();
  registerCacheSubsystem();
  log.debug('Subsystems registered');

  // G.3 optimization: Initialize resources in background (non-blocking)
  // resources will be awaited when first preview panel is created
  log.debug('Starting webview HTML resource initialization (background)...');
  initWebviewAppHTMLResourcesAsync(context);
  log.debug('Webview HTML resource initialization started');

  // G.5 optimization: Initialize prewarm coordinator for improved first-render UX
  log.debug('Initializing prewarm coordinator');
  context.subscriptions.push(initPrewarm());

  initWorkspaceHandlers(context);
  log.debug('Workspace handlers initialized');

  log.info('Extension activated');

  // show output channel if debug output is enabled
  if (isDebugEnabled()) {
    showOutput();
  }

  // show safe mode notification if in untrusted workspace
  void showSafeModeNotificationIfNeeded(context).catch((error) => {
    log.error('Failed to show safe mode notification', error);
  });

  // set up trust event handlers
  setupTrustHandlers(context);

  // register component diagnostics code actions
  registerComponentCodeActions(context);

  // register language feature providers (symbols, completions)
  registerLanguageProviders(context);

  // register all commands (extracted to commands/ directory)
  context.subscriptions.push(...registerAllCommands());

  // initialize status bar manager (manage trust state & framework display)
  const statusBarManager = getStatusBarManager();
  context.subscriptions.push(...statusBarManager.getDisposables());
  statusBarManager.updateVisibility();

  // listen for VS Code color theme changes to auto-switch preview theme
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      themeLog.debug('VS Code color theme changed, refreshing previews');
      void getPreviewManager()
        .refreshAllPreviews()
        .catch((error) => {
          log.error('Failed to refresh previews after theme change', error);
        });
    })
  );

  // start package.json watcher to auto-invalidate resolver & sass caches
  const packageJsonWatcher = new PackageJsonWatcher(() => {
    invalidateResolution();
    clearSassCache();
    watcherLog.debug(
      'Resolver & Sass caches cleared due to package file change'
    );
  });
  void packageJsonWatcher.start().catch((error) => {
    log.error('Failed to start package watcher', error);
  });
  context.subscriptions.push(packageJsonWatcher);

  log.debug('Extension activation complete');
}

// deactivate extension
export function deactivate(): void {
  disposeUnhandledRejectionHandler();

  // single disposal call - handle everything
  // 1. subsystems (resolver, meta) disposed first (reverse registration order)
  // 2. services disposed second (reverse registration order)
  ServiceRegistry.getInstance().dispose();
}
