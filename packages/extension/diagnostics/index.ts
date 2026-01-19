// packages/extension/diagnostics/index.ts
// barrel exports for diagnostics module

export { ComponentDiagnostics, DIAGNOSTIC_CODES } from './ComponentDiagnostics';

export {
  ComponentCodeActionsProvider,
  registerComponentCodeActions,
  addComponentToConfig,
} from './ComponentCodeActions';

export { detectComponents, getUnknownComponents } from './ComponentDetector';

export type {
  ComponentSource,
  DetectedComponent,
  ComponentDiagnostic,
  ComponentDetectionResult,
  ComponentDetectionOptions,
} from './types';
