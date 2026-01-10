// packages/webview-app/src/utils/stackTraceParser.ts
// parse error stack traces to extract file locations for navigation

export interface StackFrame {
  // raw line from stack trace
  raw: string;
  // function or method name (may be undefined for anonymous)
  functionName?: string;
  // file path (may be absolute or relative)
  filePath?: string;
  // line number (1-based)
  line?: number;
  // column number (1-based)
  column?: number;
  // whether this frame looks navigable (has file, line)
  isNavigable: boolean;
}

// patterns for parsing different stack trace formats
// Chrome/V8: "    at functionName (file:line:column)" or "    at file:line:column"
const CHROME_PATTERN = /^\s*at\s+(?:(.+?)\s+\()?([^()]+):(\d+):(\d+)\)?$/;

// Firefox: "functionName@file:line:column"
const FIREFOX_PATTERN = /^(.+?)@(.+):(\d+):(\d+)$/;

// Safari: similar to Firefox
const SAFARI_PATTERN = /^(.+?)@(.+):(\d+):(\d+)$/;

// simple "file:line:column" pattern (for error messages)
const SIMPLE_LOCATION_PATTERN = /^(.+):(\d+):(\d+)$/;

// parse a single stack trace line
function parseStackLine(line: string): StackFrame {
  const trimmed = line.trim();

  // try Chrome/V8 format first (most common in webviews)
  let match = trimmed.match(CHROME_PATTERN);
  if (match) {
    return {
      raw: line,
      functionName: match[1] || undefined,
      filePath: cleanFilePath(match[2]),
      line: parseInt(match[3], 10),
      column: parseInt(match[4], 10),
      isNavigable: true,
    };
  }

  // try Firefox format
  match = trimmed.match(FIREFOX_PATTERN);
  if (match) {
    return {
      raw: line,
      functionName: match[1] || undefined,
      filePath: cleanFilePath(match[2]),
      line: parseInt(match[3], 10),
      column: parseInt(match[4], 10),
      isNavigable: true,
    };
  }

  // try Safari format (same as Firefox)
  match = trimmed.match(SAFARI_PATTERN);
  if (match) {
    return {
      raw: line,
      functionName: match[1] || undefined,
      filePath: cleanFilePath(match[2]),
      line: parseInt(match[3], 10),
      column: parseInt(match[4], 10),
      isNavigable: true,
    };
  }

  // try simple location pattern
  match = trimmed.match(SIMPLE_LOCATION_PATTERN);
  if (match) {
    return {
      raw: line,
      filePath: cleanFilePath(match[1]),
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      isNavigable: true,
    };
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

    // skip the error message line (usually the first line without "at")
    if (!line.includes('at ') && !line.includes('@')) {
      // but still include it as non-navigable context
      frames.push({
        raw: line,
        isNavigable: false,
      });
      continue;
    }

    frames.push(parseStackLine(line));
  }

  return frames;
}

// extract the first navigable location from a stack trace
export function getFirstLocation(
  stack: string
): { filePath: string; line: number; column?: number } | null {
  const frames = parseStackTrace(stack);
  for (const frame of frames) {
    if (frame.isNavigable && frame.filePath && frame.line) {
      return {
        filePath: frame.filePath,
        line: frame.line,
        column: frame.column,
      };
    }
  }
  return null;
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
