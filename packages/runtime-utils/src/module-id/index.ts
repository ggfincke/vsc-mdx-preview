// packages/runtime-utils/src/module-id/index.ts
// module ID utility exports

export {
  NPM_MODULE_PREFIX,
  isNpmModuleId,
  isBareImport,
  parseNpmModuleId,
  createNpmModuleId,
  hasUrlScheme,
  isValidModuleRequest,
  URL_SCHEME_PATTERN,
  type ParsedNpmModuleId,
} from './module-id';
