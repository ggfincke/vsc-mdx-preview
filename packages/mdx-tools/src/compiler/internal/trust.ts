import type { CompilerConfig } from '../types';

export function requireTrustedMode(
  config: CompilerConfig,
  operation: string,
  onDenied?: (error: Error) => void
): boolean {
  if (!config.trustValidator) {
    return true;
  }

  const decision = config.trustValidator.isTrusted({
    operation,
    documentPath: config.documentPath ?? config.docFsPath ?? '',
    documentUri: config.documentUri ?? config.docUri,
  });

  if (decision.canExecute) {
    return true;
  }

  onDenied?.(
    new Error(
      decision.reason ??
        `Operation "${operation}" requires a trusted document context.`
    )
  );
  return false;
}
