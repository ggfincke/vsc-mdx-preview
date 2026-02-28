// packages/extension-host/src/features/tailwind/types/scanning.ts
// type definitions for the Tailwind scanning subsystem

// options for scanning Tailwind classes
export interface ScannerOptions {
  // max file size bytes
  maxFileSizeBytes?: number;
}

// result of pattern-based scanning
export interface PatternScanResult {
  // class names
  classes: Set<string>;
}

// result of content-based scanning
export interface ContentScanResult {
  // class names
  classes: Set<string>;
}

// result of dependency scanning
export interface DependencyScanResult {
  // class names
  classes: Set<string>;
  // scanned file paths
  scannedFiles: string[];
}

// callback function type for extracting text from content
export type TextExtractor = (text: string, classSet: Set<string>) => void;
