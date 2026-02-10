const NPM_MODULE_PREFIX = 'npm://';

export function isBareImport(specifier: string): boolean {
  return (
    !specifier.startsWith('/') &&
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith(NPM_MODULE_PREFIX)
  );
}
