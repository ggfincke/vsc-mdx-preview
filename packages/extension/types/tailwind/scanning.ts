// packages/extension/types/tailwind/scanning.ts
// type definitions for the Tailwind scanning subsystem

// options for scanning Tailwind classes
export interface ScannerOptions {
  // maximum file size in bytes to scan
  maxFileSizeBytes?: number;
}

// result of pattern-based scanning
export interface PatternScanResult {
  // set of extracted class names
  classes: Set<string>;
}

// result of content-based scanning
export interface ContentScanResult {
  // set of extracted class names
  classes: Set<string>;
}

// result of dependency scanning
export interface DependencyScanResult {
  // set of extracted class names
  classes: Set<string>;
  // list of successfully scanned file paths
  scannedFiles: string[];
}

// callback function type for extracting text from content
export type TextExtractor = (text: string, classSet: Set<string>) => void;
