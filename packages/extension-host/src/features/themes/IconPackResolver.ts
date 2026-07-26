// packages/extension-host/src/features/themes/IconPackResolver.ts
// read, validate & cache mermaid icon pack JSON from local files for the webview

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { LRUCache } from '@mdx-preview/runtime-utils';
import { createTaggedLogger } from '../../shared/logging/logger';
import { isPathWithinAsync } from '../../shared/utils/path-utils';
import {
  LogTags,
  STANDARD_CACHE_TTL_MS,
  type IconifyIconPack,
  type MermaidIconPackSetting,
  type ResolvedMermaidIconPack,
} from '@mdx-preview/contracts';
import { validateIconifyPack } from './iconPackValidation';

const log = createTaggedLogger(LogTags.PREVIEW);

// hard limits — packs come from workspace config & may be attacker-controlled
const MAX_PACK_BYTES = 5 * 1024 * 1024;
const MAX_PACK_ENTRIES = 64;

// reserved for the bundled builtin pack registered in the webview
const RESERVED_PACK_NAMES = new Set(['logos']);
// pack name is used as the icon prefix in diagrams (e.g. aws -> aws:Lambda)
const PACK_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/i;

// bounded cache of validated packs keyed by absolute path (mtime + size gated)
interface CacheEntry {
  mtimeMs: number;
  size: number;
  pack: IconifyIconPack;
}
const cache = new LRUCache<string, CacheEntry>({
  maxEntries: MAX_PACK_ENTRIES,
  ttlMs: STANDARD_CACHE_TTL_MS,
});

// clear validated icon pack entries
export function clearIconPackCache(): void {
  cache.clear();
}

// base directory a relative source resolves against (workspace folder for the
// doc, falling back to the document's own directory)
function baseDirFor(docUri?: vscode.Uri): string | undefined {
  if (!docUri) {
    return undefined;
  }
  const folder = vscode.workspace.getWorkspaceFolder(docUri);
  return folder ? folder.uri.fsPath : path.dirname(docUri.fsPath);
}

// read, validate & cache a single icon pack file (cached by mtime + size)
// rejects non-regular files (FIFO/device) & oversized files before reading
async function readIconPack(absPath: string): Promise<IconifyIconPack> {
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) {
    throw new Error('not a regular file');
  }
  if (stat.size > MAX_PACK_BYTES) {
    throw new Error(`file too large (${stat.size} bytes)`);
  }
  const cached = cache.get(absPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.pack;
  }
  const raw = await fs.readFile(absPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // don't surface the parser error — its message can echo file bytes to logs
    throw new Error('invalid JSON');
  }
  const pack = validateIconifyPack(parsed);
  if (!pack) {
    throw new Error('not a valid Iconify icon pack');
  }
  cache.set(absPath, { mtimeMs: stat.mtimeMs, size: stat.size, pack });
  return pack;
}

// resolve configured icon packs to validated JSON payloads for the webview
// gated on workspace trust; relative paths are confined to the workspace
// invalid/unreadable/untrusted packs are skipped w/ a warning (never throws)
export async function resolveMermaidIconPacks(
  entries: MermaidIconPackSetting[],
  docUri?: vscode.Uri
): Promise<ResolvedMermaidIconPack[]> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  // ! never read workspace-controlled paths in an untrusted workspace
  // mirrors the trust gating around script execution / plantUmlServer
  if (!vscode.workspace.isTrusted) {
    log.warn(
      `Skipping ${entries.length} mermaid icon pack(s): workspace is not trusted`
    );
    return [];
  }

  const base = baseDirFor(docUri);
  const resolved: ResolvedMermaidIconPack[] = [];
  const seen = new Set<string>();

  for (const entry of entries.slice(0, MAX_PACK_ENTRIES)) {
    if (
      !entry ||
      typeof entry.name !== 'string' ||
      typeof entry.source !== 'string' ||
      !entry.source
    ) {
      log.warn(
        `Skipping invalid mermaid icon pack entry: ${JSON.stringify(entry)}`
      );
      continue;
    }
    if (RESERVED_PACK_NAMES.has(entry.name) || !PACK_NAME_RE.test(entry.name)) {
      log.warn(
        `Skipping mermaid icon pack with reserved/invalid name "${entry.name}"`
      );
      continue;
    }
    if (seen.has(entry.name)) {
      log.warn(`Skipping duplicate mermaid icon pack name "${entry.name}"`);
      continue;
    }

    try {
      let absPath: string;
      if (path.isAbsolute(entry.source)) {
        // absolute source allowed only because the workspace is trusted above
        absPath = entry.source;
      } else {
        if (!base) {
          log.warn(
            `Skipping mermaid icon pack "${entry.name}": no workspace base for relative source`
          );
          continue;
        }
        absPath = path.resolve(base, entry.source);
        // confine relative sources to the base dir (realpath defeats ../ & symlink escape)
        if (!(await isPathWithinAsync(absPath, base, false))) {
          log.warn(
            `Skipping mermaid icon pack "${entry.name}": source escapes the workspace folder`
          );
          continue;
        }
      }
      const icons = await readIconPack(absPath);
      resolved.push({ name: entry.name, icons });
      seen.add(entry.name);
    } catch (error: unknown) {
      log.warn(
        `Failed to load mermaid icon pack "${entry.name}" from ${entry.source}: ${error}`
      );
    }
  }
  return resolved;
}
