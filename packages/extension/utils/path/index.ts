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
} from '../pathSecurity';

export {
  checkFsPathAsync,
  handleDidChangeWorkspaceFolders,
  clearPathSecurityCaches,
  PathAccessDeniedError,
} from '../../module-system/security/checkFsPath';
