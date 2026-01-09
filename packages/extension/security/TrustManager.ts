// packages/extension/security/TrustManager.ts
// * manage trust state for MDX preview (Safe Mode: static HTML | Trusted Mode: full MDX w/ React)

import * as vscode from 'vscode';
import { error as logError } from '../logging';
import type { TrustState } from '@mdx-preview/shared-types';

export type { TrustState } from '@mdx-preview/shared-types';

// security mode enum for explicit type safety
export enum SecurityMode {
  Safe = 'safe',
  Trusted = 'trusted',
}

// derive SecurityMode from TrustState
export function getSecurityMode(state: TrustState): SecurityMode {
  return state.canExecute ? SecurityMode.Trusted : SecurityMode.Safe;
}

// result of checking Trusted Mode availability for document
export interface TrustedModeCheck {
  allowed: boolean;
  reason?: string;
}

// * manage trust state for MDX preview
export class TrustManager {
  private static instance: TrustManager;
  private listeners: Set<(state: TrustState) => void> = new Set();
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    const workspaceWithTrust = vscode.workspace as typeof vscode.workspace & {
      onDidChangeWorkspaceTrust?: vscode.Event<boolean>;
    };

    if (workspaceWithTrust.onDidChangeWorkspaceTrust) {
      // listen for workspace trust changes (grant & revoke)
      this.disposables.push(
        workspaceWithTrust.onDidChangeWorkspaceTrust(() => {
          this.notifyListeners();
        })
      );
    } else {
      // fallback for older VS Code versions (grant only)
      this.disposables.push(
        vscode.workspace.onDidGrantWorkspaceTrust(() => {
          this.notifyListeners();
        })
      );
    }

    // listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('mdx-preview.preview.enableScripts')) {
          this.notifyListeners();
        }
      })
    );
  }

  // get singleton instance
  static getInstance(): TrustManager {
    if (!TrustManager.instance) {
      TrustManager.instance = new TrustManager();
    }
    return TrustManager.instance;
  }

  // get current trust state (always reads fresh values, don't cache)
  getState(): TrustState {
    // fresh read every time (don't rely on cached values)
    const workspaceTrusted = vscode.workspace.isTrusted;
    const config = vscode.workspace.getConfiguration('mdx-preview');
    const scriptsEnabled = config.get<boolean>('preview.enableScripts', false);

    return {
      workspaceTrusted,
      scriptsEnabled,
      canExecute: workspaceTrusted && scriptsEnabled,
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

  // ! check if Trusted Mode can be used for specific document (validates 4 security rules)
  canUseTrustedMode(docUri: vscode.Uri): TrustedModeCheck {
    // rule 1: workspace must be trusted
    if (!vscode.workspace.isTrusted) {
      return {
        allowed: false,
        reason:
          'Workspace is not trusted. Trust this workspace to enable Trusted Mode.',
      };
    }

    // rule 2: scripts must be enabled
    const config = vscode.workspace.getConfiguration('mdx-preview');
    const scriptsEnabled = config.get<boolean>('preview.enableScripts', false);
    if (!scriptsEnabled) {
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

  // subscribe to trust state changes
  subscribe(listener: (state: TrustState) => void): vscode.Disposable {
    this.listeners.add(listener);

    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  // notify all listeners of state change
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        logError('Error in TrustManager listener', err);
      }
    });
  }

  // dispose all resources
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.listeners.clear();
  }

  // static dispose for singleton cleanup
  static dispose(): void {
    if (TrustManager.instance) {
      TrustManager.instance.dispose();
      // @ts-expect-error reset singleton for dispose
      TrustManager.instance = undefined;
    }
  }
}
