// packages/webview-client/src/shared/utils/stackTraceParser.ts
// parse error stack traces to extract file locations for navigation

export interface StackFrame {
  // original line
  raw: string;
  // function name
  functionName?: string;
  // file path
  filePath?: string;
  // line number
  line?: number;
  // column
  column?: number;
  // navigable flag
  isNavigable: boolean;
}

// frame pattern descriptor for table-driven parsing
interface FramePatternDescriptor {
  // regex to match against trimmed line
  pattern: RegExp;
  // capture group index for function name (null if pattern has no fn group)
  fnGroup: number | null;
  // capture group index for file path
  fileGroup: number;
  // capture group index for line number
  lineGroup: number;
  // capture group index for column number
  colGroup: number;
  // require a path-shaped capture when no stack syntax surrounds it
  bareLocation?: boolean;
}

// frame patterns in priority order (Chrome first, then Firefox/Safari, then simple)
const FRAME_PATTERNS: readonly FramePatternDescriptor[] = [
  // Chrome/V8: "    at functionName (file:line:column)" or "    at file:line:column"
  {
    pattern: /^\s*at\s+(?:(.+?)\s+\()?([^()]+):(\d+):(\d+)\)?$/,
    fnGroup: 1,
    fileGroup: 2,
    lineGroup: 3,
    colGroup: 4,
  },
  // Firefox & Safari: "functionName@file:line:column"
  {
    pattern: /^(.+?)@(.+):(\d+):(\d+)$/,
    fnGroup: 1,
    fileGroup: 2,
    lineGroup: 3,
    colGroup: 4,
  },
  // simple "file:line:column" pattern for error messages
  {
    pattern: /^(.+):(\d+):(\d+)$/,
    fnGroup: null,
    fileGroup: 1,
    lineGroup: 2,
    colGroup: 3,
    bareLocation: true,
  },
];

const ABSOLUTE_PATH_PATTERN = /^(?:[a-zA-Z]:[\\/]|\/|\.{1,2}[\\/])/;
const URL_PATH_PATTERN = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//;
const FILE_NAME_PATTERN = /(?:^|[\\/])[^\\/\s]+\.[a-zA-Z][a-zA-Z\d]*$/;

function isBareFilePath(filePath: string): boolean {
  const pathWithoutSuffix = filePath.split(/[?#]/, 1)[0];
  if (
    ABSOLUTE_PATH_PATTERN.test(pathWithoutSuffix) ||
    URL_PATH_PATTERN.test(pathWithoutSuffix)
  ) {
    return true;
  }

  if (/\s/.test(pathWithoutSuffix)) {
    return false;
  }

  return (
    pathWithoutSuffix.includes('/') ||
    pathWithoutSuffix.includes('\\') ||
    FILE_NAME_PATTERN.test(pathWithoutSuffix)
  );
}

// parse a single stack trace line
function parseStackLine(line: string): StackFrame {
  const trimmed = line.trim();

  for (const {
    pattern,
    fnGroup,
    fileGroup,
    lineGroup,
    colGroup,
    bareLocation,
  } of FRAME_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && (!bareLocation || isBareFilePath(match[fileGroup]))) {
      return {
        raw: line,
        functionName:
          fnGroup !== null ? match[fnGroup] || undefined : undefined,
        filePath: cleanFilePath(match[fileGroup]),
        line: parseInt(match[lineGroup], 10),
        column: parseInt(match[colGroup], 10),
        isNavigable: true,
      };
    }
  }

  // no match - return as non-navigable
  return {
    raw: line,
    isNavigable: false,
  };
}

// clean up file path (remove file:// prefix, query strings, etc.)
function cleanFilePath(filePath: string): string {
  let cleaned = filePath;

  // remove file:// prefix
  if (cleaned.startsWith('file://')) {
    cleaned = cleaned.slice(7);
  }

  // remove query string
  const queryIndex = cleaned.indexOf('?');
  if (queryIndex !== -1) {
    cleaned = cleaned.slice(0, queryIndex);
  }

  // remove hash
  const hashIndex = cleaned.indexOf('#');
  if (hashIndex !== -1) {
    cleaned = cleaned.slice(0, hashIndex);
  }

  return cleaned;
}

// parse a full stack trace string into frames
export function parseStackTrace(stack: string): StackFrame[] {
  if (!stack) {
    return [];
  }

  const lines = stack.split('\n');
  const frames: StackFrame[] = [];

  for (const line of lines) {
    // skip empty lines
    if (!line.trim()) {
      continue;
    }

    frames.push(parseStackLine(line));
  }

  return frames;
}

// check if a file path looks like it's from the user's code (not internal/library)
export function isUserCode(filePath: string): boolean {
  // skip node_modules
  if (filePath.includes('node_modules')) {
    return false;
  }

  // skip internal browser/extension paths
  if (
    filePath.includes('extensions/') ||
    filePath.includes('chrome-extension://') ||
    filePath.includes('vscode-webview://')
  ) {
    return false;
  }

  // skip webpack/vite internal paths
  if (filePath.includes('webpack://') || filePath.includes('__vite_')) {
    return false;
  }

  return true;
}

// get a display-friendly version of a file path
export function getDisplayPath(filePath: string): string {
  // get just the filename & parent directory
  const parts = filePath.split(/[/\\]/);
  if (parts.length >= 2) {
    return parts.slice(-2).join('/');
  }
  return parts[parts.length - 1] || filePath;
}
