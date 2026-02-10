type LogFn = (message: string) => void;

export interface TaggedLogger {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

const noop: LogFn = () => {};

export function createTaggedLogger(_tag: string): TaggedLogger {
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
}
