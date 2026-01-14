// packages/extension/extension.ts
// extension activation & deactivation w/ trust management & command registration

'use strict';

import * as vscode from 'vscode';

import {
  openPreview,
  refreshPreview,
  PreviewManager,
} from './preview/preview-manager';
import { selectSecurityPolicy } from './security/security';
import { TrustManager } from './security/TrustManager';
import { initWebviewAppHTMLResources } from './preview/webview-manager';
import { initWorkspaceHandlers } from './workspace-manager';
import { info, debug, showOutput, getOutputChannel } from './logging';
import { StatusBarManager } from './preview/StatusBarManager';
import {
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  ThemeManager,
  type PreviewTheme,
  type CodeBlockTheme,
} from './themes';
import { FrameworkDetector, type Framework } from './framework';
import {
  ServiceRegistry,
  ServiceNames,
  getPreviewManager,
  getTrustManager,
  getStatusBarManager,
  getFrameworkDetector,
} from './services';
import { TailwindProcessor } from './tailwind/TailwindProcessor';
import { ErrorReporter } from './errors';
import { PackageJsonWatcher } from './module-fetcher/PackageJsonWatcher';
import { clearResolverCache } from './module-fetcher/resolver-factory';
import { ConfigManager, ConfigCache } from './config';

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

// set up workspace trust event handlers (uses onDidChangeWorkspaceTrust for grant & revoke)
function setupTrustHandlers(context: vscode.ExtensionContext): void {
  const workspaceWithTrust = vscode.workspace as typeof vscode.workspace & {
    onDidChangeWorkspaceTrust?: vscode.Event<boolean>;
  };

  const handleTrustChange = async (trusted: boolean): Promise<void> => {
    const previewManager = getPreviewManager();

    // refresh all previews to reflect new trust state
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
    // when workspace trust changes (grant or revoke)
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

  // FIRST: register services w/ the registry for centralized lifecycle management
  // This MUST happen before any code that uses service locators (getPreviewManager, etc.)
  // order matters: services w/ no dependencies first, then dependent services
  const registry = ServiceRegistry.getInstance();
  registry.register(ServiceNames.CONFIG_MANAGER, () => ConfigManager.getInstance());
  registry.register(ServiceNames.CONFIG_CACHE, () => ConfigCache.getInstance());
  registry.register(ServiceNames.TRUST_MANAGER, () => TrustManager.getInstance());
  registry.register(ServiceNames.THEME_MANAGER, () => ThemeManager.getInstance());
  registry.register(
    ServiceNames.PREVIEW_MANAGER,
    () => PreviewManager.getInstance()
  );
  registry.register(
    ServiceNames.FRAMEWORK_DETECTOR,
    () => FrameworkDetector.getInstance()
  );
  registry.register(
    ServiceNames.TAILWIND_PROCESSOR,
    () => TailwindProcessor.getInstance()
  );
  registry.register(
    ServiceNames.ERROR_REPORTER,
    () => ErrorReporter.getInstance()
  );
  // OutputChannel wrapped for IService compatibility (uses shared channel from logging.ts)
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
  registry.register(
    ServiceNames.STATUS_BAR_MANAGER,
    () => StatusBarManager.getInstance()
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

  // register commands
  const openPreviewCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.openPreview',
    () => {
      debug('[CMD] openPreview command triggered');
      openPreview();
    }
  );

  const refreshPreviewCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.refreshPreview',
    () => {
      debug('[CMD] refreshPreview command triggered');
      refreshPreview();
    }
  );

  const toggleUseVscodeMarkdownStylesCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.toggleUseVscodeMarkdownStyles',
    () => {
      const extensionConfig = vscode.workspace.getConfiguration('mdx-preview');
      const useVscodeMarkdownStyles = extensionConfig.get<boolean>(
        'preview.useVscodeMarkdownStyles',
        false
      );
      extensionConfig.update(
        'preview.useVscodeMarkdownStyles',
        !useVscodeMarkdownStyles
      );
    }
  );

  const toggleUseWhiteBackgroundCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.toggleUseWhiteBackground',
    () => {
      const extensionConfig = vscode.workspace.getConfiguration('mdx-preview');
      const useWhiteBackground = extensionConfig.get<boolean>(
        'preview.useWhiteBackground',
        false
      );
      extensionConfig.update('preview.useWhiteBackground', !useWhiteBackground);
    }
  );

  const toggleChangeSecuritySettings = vscode.commands.registerCommand(
    'mdx-preview.commands.changeSecuritySettings',
    () => {
      selectSecurityPolicy();
    }
  );

  // command to toggle scripts setting (only in trusted workspaces)
  const toggleScriptsCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.toggleScripts',
    async () => {
      debug('[CMD] toggleScripts command triggered');

      const trustState = getTrustManager().getState();

      if (!trustState.workspaceTrusted) {
        // workspace not trusted - offer to manage trust
        const selection = await vscode.window.showWarningMessage(
          'To enable scripts, you must first trust this workspace.',
          'Manage Trust',
          'Cancel'
        );
        if (selection === 'Manage Trust') {
          await vscode.commands.executeCommand('workbench.trust.manage');
        }
        return;
      }

      // workspace is trusted - toggle scripts setting
      const extensionConfig = vscode.workspace.getConfiguration('mdx-preview');
      const scriptsEnabled = extensionConfig.get<boolean>(
        'preview.enableScripts',
        false
      );

      await extensionConfig.update(
        'preview.enableScripts',
        !scriptsEnabled,
        vscode.ConfigurationTarget.Workspace
      );

      const newState = scriptsEnabled ? 'disabled' : 'enabled';
      vscode.window.showInformationMessage(`MDX Preview scripts ${newState}.`);
    }
  );

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

  // command to select preview theme
  const selectPreviewThemeCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.selectPreviewTheme',
    async () => {
      debug('[CMD] selectPreviewTheme command triggered');

      const config = vscode.workspace.getConfiguration('mdx-preview');
      const currentTheme = config.get<PreviewTheme>(
        'preview.previewTheme',
        'none'
      );

      const items = PREVIEW_THEMES.map((theme) => ({
        label: PREVIEW_THEME_LABELS[theme],
        description: theme === currentTheme ? '(current)' : undefined,
        theme,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select preview theme',
        matchOnDescription: true,
      });

      if (selected) {
        await config.update(
          'preview.previewTheme',
          selected.theme,
          vscode.ConfigurationTarget.Global
        );
        // refresh previews to apply theme
        getPreviewManager().refreshAllPreviews();
      }
    }
  );

  // command to select code block theme
  const selectCodeBlockThemeCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.selectCodeBlockTheme',
    async () => {
      debug('[CMD] selectCodeBlockTheme command triggered');

      const config = vscode.workspace.getConfiguration('mdx-preview');
      const currentTheme = config.get<CodeBlockTheme>(
        'preview.codeBlockTheme',
        'auto'
      );

      const items = CODE_BLOCK_THEMES.map((theme) => ({
        label: CODE_BLOCK_THEME_LABELS[theme],
        description: theme === currentTheme ? '(current)' : undefined,
        theme,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select code block theme',
        matchOnDescription: true,
      });

      if (selected) {
        await config.update(
          'preview.codeBlockTheme',
          selected.theme,
          vscode.ConfigurationTarget.Global
        );
        // refresh previews to apply theme
        getPreviewManager().refreshAllPreviews();
      }
    }
  );

  // zoom commands
  const zoomInCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.zoomIn',
    async () => {
      debug('[CMD] zoomIn command triggered');
      const preview = getPreviewManager().getCurrentPreview();
      if (preview?.webviewHandle) {
        await preview.webviewHandle.zoomIn();
      }
    }
  );

  const zoomOutCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.zoomOut',
    async () => {
      debug('[CMD] zoomOut command triggered');
      const preview = getPreviewManager().getCurrentPreview();
      if (preview?.webviewHandle) {
        await preview.webviewHandle.zoomOut();
      }
    }
  );

  const resetZoomCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.resetZoom',
    async () => {
      debug('[CMD] resetZoom command triggered');
      const preview = getPreviewManager().getCurrentPreview();
      if (preview?.webviewHandle) {
        await preview.webviewHandle.resetZoom();
      }
    }
  );

  // command to select framework
  const selectFrameworkCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.selectFramework',
    async () => {
      debug('[CMD] selectFramework command triggered');

      const config = vscode.workspace.getConfiguration('mdx-preview');
      const currentSetting = config.get<string>('framework', 'auto');
      const frameworkDetector = getFrameworkDetector();

      // get detected framework for display
      const editor = vscode.window.activeTextEditor;
      let detectedFramework: Framework = 'generic';
      if (editor) {
        const info = frameworkDetector.getFramework(editor.document.uri);
        if (info.detected) {
          detectedFramework = info.framework;
        }
      }

      const frameworks: Array<{
        label: string;
        description?: string;
        value: string;
      }> = [
        {
          label: 'Auto-detect',
          description:
            currentSetting === 'auto'
              ? `(current - detected: ${frameworkDetector.getFrameworkDisplayName(detectedFramework)})`
              : `(detected: ${frameworkDetector.getFrameworkDisplayName(detectedFramework)})`,
          value: 'auto',
        },
        {
          label: 'Generic',
          description: currentSetting === 'generic' ? '(current)' : undefined,
          value: 'generic',
        },
        {
          label: 'Docusaurus',
          description:
            currentSetting === 'docusaurus' ? '(current)' : undefined,
          value: 'docusaurus',
        },
        {
          label: 'Next.js',
          description: currentSetting === 'nextjs' ? '(current)' : undefined,
          value: 'nextjs',
        },
        {
          label: 'Astro Starlight',
          description:
            currentSetting === 'astro-starlight' ? '(current)' : undefined,
          value: 'astro-starlight',
        },
      ];

      const selected = await vscode.window.showQuickPick(frameworks, {
        placeHolder: 'Select MDX framework',
        matchOnDescription: true,
      });

      if (selected) {
        await config.update(
          'framework',
          selected.value,
          vscode.ConfigurationTarget.Workspace
        );

        // refresh previews to apply framework changes
        getPreviewManager().refreshAllPreviews();

        vscode.window.showInformationMessage(
          `MDX framework set to ${selected.label}.`
        );
      }
    }
  );

  // command to manually refresh module cache (clears resolver cache)
  const refreshModuleCacheCommand = vscode.commands.registerCommand(
    'mdx-preview.commands.refreshModuleCache',
    () => {
      debug('[CMD] refreshModuleCache command triggered');
      clearResolverCache();
      vscode.window.showInformationMessage('MDX Preview module cache cleared.');
    }
  );

  // start package.json watcher to auto-invalidate resolver cache
  const packageJsonWatcher = new PackageJsonWatcher();
  packageJsonWatcher.start(() => {
    clearResolverCache();
    debug('[WATCHER] Resolver cache cleared due to package file change');
  });
  context.subscriptions.push(packageJsonWatcher);

  context.subscriptions.push(
    openPreviewCommand,
    refreshPreviewCommand,
    toggleUseVscodeMarkdownStylesCommand,
    toggleUseWhiteBackgroundCommand,
    toggleChangeSecuritySettings,
    toggleScriptsCommand,
    selectPreviewThemeCommand,
    selectCodeBlockThemeCommand,
    zoomInCommand,
    zoomOutCommand,
    resetZoomCommand,
    selectFrameworkCommand,
    refreshModuleCacheCommand
  );

  debug('[ACTIVATE] Extension activation complete');
}

// deactivate extension
export function deactivate(): void {
  // clear resolver cache to prevent stale data on reload
  clearResolverCache();

  // dispose all registered services in reverse registration order
  // (dependent services like StatusBarManager disposed before their dependencies)
  // ConfigCache & OutputChannel are now managed by ServiceRegistry
  ServiceRegistry.getInstance().dispose();
}
