// packages/extension-host/src/features/themes/IconPackResolver.ts
// read & cache mermaid icon pack JSON from local files for the webview

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import {
  LogTags,
  type MermaidIconPackSetting,
  type ResolvedMermaidIconPack,
} from '@mdx-preview/contracts';

const log = createTaggedLogger(LogTags.PREVIEW);

// cache parsed JSON by absolute path & mtime so repeated theme pushes are cheap
const cache = new Map<string, { mtimeMs: number; icons: unknown }>();

// resolve a configured source path to an absolute path
// absolute paths are used as-is, relative paths resolve against the workspace
// folder (falling back to the document directory)
function resolveSourcePath(source: string, docUri?: vscode.Uri): string {
  if (path.isAbsolute(source)) {
    return source;
  }
  if (docUri) {
    const folder = vscode.workspace.getWorkspaceFolder(docUri);
    const base = folder ? folder.uri.fsPath : path.dirname(docUri.fsPath);
    return path.join(base, source);
  }
  return path.resolve(source);
}

// read & parse a single icon pack file (cached by mtime)
async function readIconPack(absPath: string): Promise<unknown> {
  const stat = await fs.stat(absPath);
  const cached = cache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.icons;
  }
  const raw = await fs.readFile(absPath, 'utf-8');
  const icons = JSON.parse(raw);
  cache.set(absPath, { mtimeMs: stat.mtimeMs, icons });
  return icons;
}

// resolve configured icon packs to JSON payloads for the webview
// invalid or unreadable packs are skipped w/ a warning (never throws)
export async function resolveMermaidIconPacks(
  entries: MermaidIconPackSetting[],
  docUri?: vscode.Uri
): Promise<ResolvedMermaidIconPack[]> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const resolved: ResolvedMermaidIconPack[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry.name !== 'string' || !entry.source) {
      log.warn(`Skipping invalid mermaid icon pack entry: ${JSON.stringify(entry)}`);
      continue;
    }
    try {
      const absPath = resolveSourcePath(entry.source, docUri);
      const icons = await readIconPack(absPath);
      resolved.push({ name: entry.name, icons });
    } catch (error: unknown) {
      log.warn(`Failed to load mermaid icon pack "${entry.name}" from ${entry.source}: ${error}`);
    }
  }
  return resolved;
}
