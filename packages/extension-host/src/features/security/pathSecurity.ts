// packages/extension/utils/pathSecurity.ts
// centralized path validation utilities for security-sensitive operations

import * as path from 'path';
import { checkFsPathAsync } from '../module-runtime/security/checkFsPath';
import { SecurityError, ErrorContext, ErrorSeverity } from '../../shared/errors';
import { getErrorReporter } from '../../app/services';
import { warn as logWarn } from '../../shared/logging/logger';
import type { Preview } from '../preview/preview-manager';

// result of validating a secure path
export interface SecurePathResult {
  // resolved path
  resolvedPath: string;
  // entry directory
  entryDir: string;
}

// validate & resolve a relative path securely within a preview's context
// performs entry directory validation & path traversal checks
export async function validateAndResolveSecurePath(
  preview: Preview,
  relativePath: string,
  context: string
): Promise<SecurePathResult | undefined> {
  // check entry directory exists
  const entryDir = preview.entryFsDirectory;
  if (!entryDir) {
    logWarn(`${context}: no entry directory`);
    return undefined;
  }

  // resolve relative path to absolute
  const resolvedPath = path.resolve(entryDir, relativePath);

  // security check - ensure path is within workspace
  if (!(await checkFsPathAsync(entryDir, resolvedPath))) {
    reportPathTraversalError(resolvedPath, context);
    return undefined;
  }

  return { resolvedPath, entryDir };
}

// report a path traversal security error
// centralizes the error reporting pattern used across RPC methods
export function reportPathTraversalError(
  resolvedPath: string,
  _context: string = 'path-validation'
): void {
  getErrorReporter().report(
    new SecurityError(
      'Cannot open file outside workspace folder',
      'PATH_TRAVERSAL',
      resolvedPath
    ),
    { context: ErrorContext.Security, severity: ErrorSeverity.Warning }
  );
}

// report a trust violation security error
// centralizes the error reporting pattern for trust-gated operations
export function reportTrustViolationError(
  filePath: string,
  reason: string,
  _context: string = 'trust-validation'
): void {
  getErrorReporter().report(
    new SecurityError(
      `Cannot open preview: ${reason}`,
      'TRUST_VIOLATION',
      filePath
    ),
    { context: ErrorContext.Security, severity: ErrorSeverity.Warning }
  );
}

// get & validate entry directory from preview w/ standardized logging
export function requireEntryDirectory(
  preview: Preview,
  context: string
): string | undefined {
  const entryDir = preview.entryFsDirectory;
  if (!entryDir) {
    logWarn(`${context}: no entry directory`);
    return undefined;
  }
  return entryDir;
}
