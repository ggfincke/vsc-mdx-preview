// packages/extension/tailwind/scanning/types.ts
// type definitions for the Tailwind scanning subsystem

// Options for scanning Tailwind classes.
export interface ScannerOptions {
  // Maximum file size in bytes to scan
  maxFileSizeBytes?: number;
}

// Result of pattern-based scanning.
export interface PatternScanResult {
  // Set of extracted class names
  classes: Set<string>;
}

// Result of content-based scanning.
export interface ContentScanResult {
  // Set of extracted class names
  classes: Set<string>;
}

// Result of dependency scanning.
export interface DependencyScanResult {
  // Set of extracted class names
  classes: Set<string>;
  // List of successfully scanned file paths
  scannedFiles: string[];
}

// Callback function type for extracting text from content.
export type TextExtractor = (text: string, classSet: Set<string>) => void;
