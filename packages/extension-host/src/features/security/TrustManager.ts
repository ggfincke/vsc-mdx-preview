// packages/extension-host/src/features/security/TrustManager.ts
// * manage trust state for MDX preview (Safe Mode: static HTML | Trusted Mode: full MDX w/ React)

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { WithSubscribers } from '../../app/services/SingletonService';
import { getConfigManager } from '../../app/services';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { type TrustState, LogTags } from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.TRUST_MANAGER);

export type { TrustState } from '@mdx-preview/contracts';

// re-export canonical type definitions from security/types
export { SecurityMode, getSecurityMode } from './types';
export type { TrustedModeCheck } from './types';

import { SecurityMode, getSecurityMode } from './types';
import type { TrustedModeCheck } from './types';

// manage trust state for MDX preview
export class TrustManager extends WithSubscribers<TrustManager, TrustState> {
  protected static override instance: TrustManager | undefined;
  protected readonly logTag = LogTags.TRUST_MANAGER;

  protected constructor() {
    super(LogTags.TRUST_MANAGER, (error) =>
      log.error('Error in TrustManager listener', error)
    );
    const workspaceWithTrust = vscode.workspace as typeof vscode.workspace & {
      onDidChangeWorkspaceTrust?: vscode.Event<boolean>;
    };

    if (workspaceWithTrust.onDidChangeWorkspaceTrust) {
      // listen for workspace trust changes (grant & revoke)
      this.addDisposable(
        workspaceWithTrust.onDidChangeWorkspaceTrust(() => {
          this.notifyTrustStateChange();
        })
      );
    } else {
      // fallback for older VS Code versions (grant only)
      this.addDisposable(
        vscode.workspace.onDidGrantWorkspaceTrust(() => {
          this.notifyTrustStateChange();
        })
      );
    }

    // listen for configuration changes via centralized dispatcher
    this.addDisposable(
      getConfigManager().onDidChangeKey(SETTINGS.ENABLE_SCRIPTS, () => {
        this.notifyTrustStateChange();
      })
    );
  }

  // get current trust state (always reads fresh values, don't cache)
  getState(): TrustState {
    // fresh read every time (don't rely on cached values)
    const workspaceTrusted = vscode.workspace.isTrusted;
    const scriptsEnabled = getConfigManager().get(SETTINGS.ENABLE_SCRIPTS);
    const openMdxLinksInPreview = getConfigManager().get(
      SETTINGS.OPEN_MDX_LINKS_IN_PREVIEW
    );

    return {
      workspaceTrusted,
      scriptsEnabled,
      canExecute: workspaceTrusted && scriptsEnabled,
      openMdxLinksInPreview,
    };
  }

  // check if code execution allowed (convenience for getState().canExecute)
  canExecute(): boolean {
    return this.getState().canExecute;
  }

  // get current security mode
  getMode(): SecurityMode {
    return getSecurityMode(this.getState());
  }

  // check if Trusted Mode can be used for specific document (validates 4 security rules)
  canUseTrustedMode(docUri: vscode.Uri): TrustedModeCheck {
    const state = this.getState();

    // rule 1: workspace must be trusted
    if (!state.workspaceTrusted) {
      return {
        allowed: false,
        reason:
          'Workspace is not trusted. Trust this workspace to enable Trusted Mode.',
      };
    }

    // rule 2: scripts must be enabled
    if (!state.scriptsEnabled) {
      return {
        allowed: false,
        reason:
          'Scripts are not enabled. Enable "mdx-preview.preview.enableScripts" in settings.',
      };
    }

    // rule 3: must not be in remote environment
    if (vscode.env.remoteName) {
      return {
        allowed: false,
        reason: `Remote environment detected (${vscode.env.remoteName}). Trusted Mode is only available for local workspaces.`,
      };
    }

    // rule 4: document must be on local filesystem (file: scheme)
    if (docUri.scheme !== 'file') {
      // allow untitled scheme for new unsaved files in local workspaces
      if (docUri.scheme === 'untitled') {
        // untitled files in local workspaces are OK
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Unsupported document scheme: ${docUri.scheme}. Trusted Mode requires local files (file: scheme).`,
      };
    }

    return { allowed: true };
  }

  // get full trust state for specific document (includes document-specific checks)
  getStateForDocument(docUri: vscode.Uri): TrustState {
    const baseState = this.getState();
    const modeCheck = this.canUseTrustedMode(docUri);

    if (!modeCheck.allowed) {
      return {
        ...baseState,
        canExecute: false,
        reason: modeCheck.reason,
      };
    }

    return baseState;
  }

  // notify subscribers of trust state change
  private notifyTrustStateChange(): void {
    this.notifySubscribers(this.getState());
  }
}
