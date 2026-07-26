// packages/extension-host/src/features/diagnostics/ComponentDiagnostics.ts
// thin adapter: mdx-forge analyze rules -> vscode diagnostics for MDX components

import * as vscode from 'vscode';
import {
  detectComponents,
  invalidateComponentCache,
} from './ComponentDetector';
import {
  DiagnosticPublisher,
  fromVsRange,
  toVsDiagnostic,
} from './diagnostic-adapter';
import { LogTags } from '@mdx-preview/contracts';
import {
  analyzeUnknownComponents,
  type ClassifyContext,
} from 'mdx-forge/diagnostics/analyze';
import type { FrameworkId } from 'mdx-forge/components/registry';
import { resolveConfig } from '../preview/configuration/ConfigResolver';
import { createTaggedLogger } from '../../shared/logging/logger';
import { getErrorReporter, getFrameworkDetector } from '../../app/services';
import { ErrorContext } from '../../shared/errors/ErrorReporter';
import { SingletonService } from '../../app/services/SingletonService';

const log = createTaggedLogger(LogTags.COMPONENT_DIAGNOSTICS);

// re-export the code table & normalizer so the barrel & code actions stay stable
export { DIAGNOSTIC_CODES, readDiagnosticCode } from './diagnostic-adapter';

// * ComponentDiagnostics service
// manage DiagnosticCollection for MDX component issues
export class ComponentDiagnostics extends SingletonService<ComponentDiagnostics> {
  protected static override instance: ComponentDiagnostics | undefined;
  protected readonly logTag = LogTags.COMPONENT_DIAGNOSTICS;

  private publisher: DiagnosticPublisher;
  private documentTimers = new Map<string, NodeJS.Timeout>();

  protected constructor() {
    super();

    const diagnosticCollection =
      vscode.languages.createDiagnosticCollection('mdx-components');
    this.addDisposable(diagnosticCollection);
    this.publisher = new DiagnosticPublisher(diagnosticCollection);

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

    this.addDisposable(
      getFrameworkDetector().subscribe(() => {
        this.scheduleOpenDocumentUpdates();
      })
    );

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

  private scheduleOpenDocumentUpdates(): void {
    for (const document of vscode.workspace.textDocuments) {
      if (this.isMdxDocument(document)) {
        this.scheduleUpdate(document);
      }
    }
  }

  // update diagnostics for a document
  async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
    if (!this.isMdxDocument(document)) {
      return;
    }

    log.debug(`Updating diagnostics for ${document.uri}`);

    try {
      const documentIdentity = {
        uri: document.uri.toString(),
        version: document.version,
      };
      const text = document.getText();

      // get config components
      const config = resolveConfig(document.uri.fsPath);
      const configComponents = new Set<string>(
        config?.config.components ? Object.keys(config.config.components) : []
      );

      // resolve framework so classification is shim-accurate
      const framework = this.resolveFramework(document.uri);

      // detect components in the document (pass URI for caching)
      const result = await detectComponents(
        text,
        { includePositions: true, detectImports: true, framework },
        configComponents,
        documentIdentity
      );

      const ctx: ClassifyContext = {
        imports: new Set(result.imports.keys()),
        configComponents,
        framework,
      };

      // build diagnostics per unknown tag-name token w/o spanning children
      const diagnostics = result.components.flatMap((component) => {
        if (component.source !== 'unknown') {
          return [];
        }

        const [root = component.name, ...members] = component.name.split('.');
        return component.tagNameRanges.flatMap((range) =>
          analyzeUnknownComponents(
            [
              {
                name: component.name,
                root,
                members,
                attributes: [],
                range: fromVsRange(range),
              },
            ],
            ctx
          ).map((diagnostic) => {
            const vsDiagnostic = toVsDiagnostic(diagnostic);
            const diagnosticWithData = vsDiagnostic as vscode.Diagnostic & {
              data?: Record<string, unknown>;
            };
            diagnosticWithData.data = {
              ...diagnosticWithData.data,
              tagNameRanges: component.tagNameRanges,
            };
            return vsDiagnostic;
          })
        );
      });

      // publish via the single collection owner (producer = analysis)
      this.publisher.set(document.uri, 'analysis', diagnostics);

      log.debug(`Set ${diagnostics.length} diagnostics for ${document.uri}`);
    } catch (err) {
      getErrorReporter().reportSilent(err, ErrorContext.Extension, {
        phase: 'diagnostics',
        uri: document.uri.toString(),
      });
    }
  }

  // resolve the document framework, falling back to generic
  private resolveFramework(uri: vscode.Uri): FrameworkId {
    try {
      return getFrameworkDetector().getFramework(uri).framework;
    } catch {
      return 'generic';
    }
  }

  // clear diagnostics for a document
  clearDiagnostics(uri: vscode.Uri): void {
    this.publisher.delete(uri);
  }

  // clear all diagnostics
  clearAll(): void {
    this.publisher.clear();
  }

  // get diagnostics for a document
  getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
    return this.publisher.get(uri);
  }

  // custom cleanup - clear all timers
  protected override onDispose(): void {
    for (const timer of this.documentTimers.values()) {
      clearTimeout(timer);
    }
    this.documentTimers.clear();
  }
}
