// packages/extension/utils/path/index.ts
// unified path utilities barrel export

export {
  normalizePathSeparators,
  toAbsolutePath,
  toRelativeImportPath,
  resolvePathWithFallbacks,
  isPathInside,
  resolveRealPath,
  normalizePathForComparison,
  isPathInsideAsync,
  joinAsImportPath,
  getDirectory,
  getExtension,
  getBaseName,
  type ResolvePathOptions,
} from '../path-utils';

export {
  validateAndResolveSecurePath,
  reportPathTraversalError,
  reportTrustViolationError,
  requireEntryDirectory,
  type SecurePathResult,
} from '../../../features/security/pathSecurity';

export {
  checkFsPathAsync,
  handleDidChangeWorkspaceFolders,
  clearPathSecurityCaches,
  PathAccessDeniedError,
} from '../../../features/module-runtime/security/checkFsPath';
