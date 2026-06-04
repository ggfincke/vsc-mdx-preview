// packages/extension-host/src/features/tailwind/types/scanning.ts
// type definitions for the Tailwind scanning subsystem

// callback function type for extracting text from content
export type TextExtractor = (text: string, classSet: Set<string>) => void;
