// packages/extension-host/src/features/diagnostics/ComponentDiagnostics.ts
// manage VS Code diagnostics for unknown MDX components

import * as vscode from 'vscode';
import {
  detectComponents,
  getUnknownComponents,
  invalidateComponentCache,
} from './ComponentDetector';
import type {
  DetectedComponent,
  UnknownComponentDiagnosticData,
} from '../types';
import { LogTags } from '@mdx-preview/contracts';
import { resolveConfig } from '../preview/configuration/ConfigResolver';
import { createTaggedLogger } from '../../shared/logging/logger';
import { getErrorReporter } from '../../app/services';
import { ErrorContext } from '../../shared/errors/ErrorReporter';

const log = createTaggedLogger(LogTags.COMPONENT_DIAGNOSTICS);
import { SingletonService } from '../../app/services/SingletonService';

// diagnostic codes for component issues
export const DIAGNOSTIC_CODES = {
  UNKNOWN_COMPONENT: 'mdx-preview/unknown-component',
} as const;

// diagnostic source name
const DIAGNOSTIC_SOURCE = 'MDX Preview';

// * ComponentDiagnostics service
// manage DiagnosticCollection for MDX component issues
export class ComponentDiagnostics extends SingletonService<ComponentDiagnostics> {
  protected static override instance: ComponentDiagnostics | undefined;
  protected readonly logTag = LogTags.COMPONENT_DIAGNOSTICS;

  private diagnosticCollection: vscode.DiagnosticCollection;
  private documentTimers = new Map<string, NodeJS.Timeout>();

  protected constructor() {
    super();

    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection('mdx-components');
    this.addDisposable(this.diagnosticCollection);

    // listen for document changes
    this.addDisposable(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.isMdxDocument(event.document)) {
          this.scheduleUpdate(event.document);
        }
      })
    );

    // listen for document opens
    this.addDisposable(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (this.isMdxDocument(document)) {
          this.scheduleUpdate(document);
        }
      })
    );

    // listen for document closes
    this.addDisposable(
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (this.isMdxDocument(document)) {
          this.clearDiagnostics(document.uri);
          // clear any pending timer
          const timer = this.documentTimers.get(document.uri.toString());
          if (timer) {
            clearTimeout(timer);
            this.documentTimers.delete(document.uri.toString());
          }
          // invalidate component detection cache
          invalidateComponentCache(document.uri.toString());
        }
      })
    );

    // scan already open MDX documents
    for (const document of vscode.workspace.textDocuments) {
      if (this.isMdxDocument(document)) {
        this.scheduleUpdate(document);
      }
    }

    log.info('Service initialized');
  }

  // check if document is MDX
  private isMdxDocument(document: vscode.TextDocument): boolean {
    return document.languageId === 'mdx' || document.fileName.endsWith('.mdx');
  }

  // schedule diagnostic update w/ debounce
  private scheduleUpdate(document: vscode.TextDocument): void {
    const uriString = document.uri.toString();

    // clear existing timer
    const existingTimer = this.documentTimers.get(uriString);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // schedule new update (debounce 500ms)
    const timer = setTimeout(() => {
      this.documentTimers.delete(uriString);
      this.updateDiagnostics(document);
    }, 500);

    this.documentTimers.set(uriString, timer);
  }

  // update diagnostics for a document
  async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    if (!this.isMdxDocument(document)) {
      return;
    }

    log.debug(`Updating diagnostics for ${document.uri}`);

    try {
      // get config components
      const config = resolveConfig(document.uri.fsPath);
      const configComponents = new Set<string>(
        config?.config.components ? Object.keys(config.config.components) : []
      );

      // detect components in the document (pass URI for caching)
      const result = await detectComponents(
        document.getText(),
        { includePositions: true, detectImports: true },
        configComponents,
        document.uri.toString()
      );

      // get unknown components
      const unknownComponents = getUnknownComponents(result);

      // create diagnostics
      const diagnostics = unknownComponents.map((component) =>
        this.createDiagnostic(component)
      );

      // update collection
      this.diagnosticCollection.set(document.uri, diagnostics);

      log.debug(`Set ${diagnostics.length} diagnostics for ${document.uri}`);
    } catch (err) {
      getErrorReporter().reportSilent(err, ErrorContext.Extension, {
        phase: 'diagnostics',
        uri: document.uri.toString(),
      });
    }
  }

  // create a VS Code diagnostic from detected component
  private createDiagnostic(component: DetectedComponent): vscode.Diagnostic {
    const message = `Unknown component "${component.name}". Add to .mdx-previewrc.json or use a built-in shim.`;

    const diagnostic = new vscode.Diagnostic(
      component.range,
      message,
      vscode.DiagnosticSeverity.Warning
    );

    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = DIAGNOSTIC_CODES.UNKNOWN_COMPONENT;

    // carry the component name structurally so code actions need not re-parse the message
    // Diagnostic.data is runtime-supported but absent from @types/vscode 1.90; cast
    const data: UnknownComponentDiagnosticData = {
      componentName: component.name,
    };
    (diagnostic as vscode.Diagnostic & { data?: unknown }).data = data;

    // add related info about available options
    diagnostic.relatedInformation = [
      new vscode.DiagnosticRelatedInformation(
        new vscode.Location(
          vscode.Uri.parse(
            'https://github.com/ggfincke/vsc-mdx-preview/blob/main/docs/configuration.md#components'
          ),
          new vscode.Range(0, 0, 0, 0)
        ),
        'Learn about component mapping'
      ),
    ];

    return diagnostic;
  }

  // clear diagnostics for a document
  clearDiagnostics(uri: vscode.Uri): void {
    this.diagnosticCollection.delete(uri);
  }

  // clear all diagnostics
  clearAll(): void {
    this.diagnosticCollection.clear();
  }

  // get diagnostics for a document
  getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
    return this.diagnosticCollection.get(uri) || [];
  }

  // custom cleanup - clear all timers
  protected override onDispose(): void {
    for (const timer of this.documentTimers.values()) {
      clearTimeout(timer);
    }
    this.documentTimers.clear();
  }
}
