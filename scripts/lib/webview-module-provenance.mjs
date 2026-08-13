// scripts/lib/webview-module-provenance.mjs
// validate byte-bound webview chunk provenance & forbidden static modules

import { createHash } from 'node:crypto';

const FORBIDDEN_STATIC_MODULE_MARKERS = [
  'src/features/diagrams/ui/mermaidrenderer/',
  'src/features/diagrams/ui/plantumlrenderer/',
  'src/features/diagrams/ui/graphvizrenderer/',
  '/node_modules/mermaid/',
  '/node_modules/@mermaid-js/',
  '/node_modules/@viz-js/viz/',
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isForbiddenStaticModule(moduleId) {
  const normalizedId = moduleId.replaceAll('\\', '/').toLowerCase();
  return FORBIDDEN_STATIC_MODULE_MARKERS.some((marker) =>
    normalizedId.includes(marker)
  );
}

function isStringArray(value, { allowEmpty = true } = {}) {
  return (
    Array.isArray(value) &&
    (allowEmpty || value.length > 0) &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  );
}

function getSetDifference(left, right) {
  return [...left].filter((entry) => !right.has(entry)).sort();
}

function assertMatchingFileSets(leftName, left, rightName, right) {
  const missingFromRight = getSetDifference(left, right);
  const missingFromLeft = getSetDifference(right, left);
  if (missingFromRight.length === 0 && missingFromLeft.length === 0) {
    return;
  }

  const details = [];
  if (missingFromRight.length > 0) {
    details.push(`missing from ${rightName}: ${missingFromRight.join(', ')}`);
  }
  if (missingFromLeft.length > 0) {
    details.push(`missing from ${leftName}: ${missingFromLeft.join(', ')}`);
  }
  throw new Error(
    `Webview ${leftName}/${rightName} chunk filenames differ (${details.join('; ')})`
  );
}

function hashChunk(source) {
  return createHash('sha256').update(source).digest('hex');
}

export function parseWebviewModuleProvenance(provenance) {
  if (
    !isRecord(provenance) ||
    provenance.version !== 2 ||
    !/^[a-f0-9]{64}$/.test(provenance.manifestSha256) ||
    !isRecord(provenance.chunks)
  ) {
    throw new Error(
      'Webview module provenance must contain version 2 chunk records'
    );
  }

  const chunks = new Map();
  for (const [fileName, record] of Object.entries(provenance.chunks)) {
    if (
      !fileName.endsWith('.js') ||
      !isRecord(record) ||
      !/^[a-f0-9]{64}$/.test(record.sha256) ||
      !isStringArray(record.modules, { allowEmpty: false })
    ) {
      throw new Error(
        `Webview module provenance contains an invalid chunk record for ${fileName}`
      );
    }
    chunks.set(fileName, record);
  }

  if (chunks.size === 0) {
    throw new Error('Webview module provenance contains no chunk records');
  }

  return { manifestSha256: provenance.manifestSha256, chunks };
}

export function validateWebviewManifestHash(expectedHash, manifestSource) {
  if (hashChunk(manifestSource) !== expectedHash) {
    throw new Error('Webview module provenance manifest hash mismatch');
  }
}

export function parseWebviewManifest(manifest) {
  if (!isRecord(manifest)) {
    throw new Error('Vite manifest must contain chunk records');
  }

  const chunks = new Map();
  for (const [key, record] of Object.entries(manifest)) {
    if (!isRecord(record) || typeof record.file !== 'string') {
      throw new Error(`Vite manifest contains an invalid record for ${key}`);
    }
    if (!record.file.endsWith('.js')) {
      continue;
    }
    if (chunks.has(record.file)) {
      throw new Error(
        `Vite manifest contains duplicate chunk file ${record.file}`
      );
    }
    if (
      (record.imports !== undefined && !isStringArray(record.imports)) ||
      (record.isEntry !== undefined && typeof record.isEntry !== 'boolean')
    ) {
      throw new Error(`Vite manifest contains an invalid record for ${key}`);
    }

    const resolveImports = (importKeys, field) =>
      (importKeys ?? []).map((importKey) => {
        const importedRecord = manifest[importKey];
        if (
          !isRecord(importedRecord) ||
          typeof importedRecord.file !== 'string' ||
          !importedRecord.file.endsWith('.js')
        ) {
          throw new Error(
            `Vite manifest ${key} references invalid ${field} ${importKey}`
          );
        }
        return importedRecord.file;
      });

    chunks.set(record.file, {
      isEntry: record.isEntry === true,
      imports: resolveImports(record.imports, 'import'),
    });
  }

  if (chunks.size === 0) {
    throw new Error('Vite manifest contains no JavaScript chunk records');
  }

  return chunks;
}

export function validateWebviewChunkProvenance(
  provenanceChunks,
  manifestChunks,
  emittedChunks
) {
  const provenanceFiles = new Set(provenanceChunks.keys());
  const emittedFiles = new Set(emittedChunks.keys());
  assertMatchingFileSets(
    'provenance',
    provenanceFiles,
    'emitted',
    emittedFiles
  );

  for (const [fileName, record] of provenanceChunks) {
    const actualHash = hashChunk(emittedChunks.get(fileName));
    if (actualHash !== record.sha256) {
      throw new Error(
        `Webview module provenance hash mismatch for ${fileName}`
      );
    }
  }

  const manifestFiles = new Set(manifestChunks.keys());
  assertMatchingFileSets(
    'provenance',
    provenanceFiles,
    'manifest',
    manifestFiles
  );

  const entryFiles = [...manifestChunks]
    .filter(([, record]) => record.isEntry)
    .map(([fileName]) => fileName);
  if (entryFiles.length !== 1) {
    throw new Error(
      `Expected one webview entry in the Vite manifest, found ${entryFiles.length}`
    );
  }

  const pending = [...entryFiles];
  const staticFiles = new Set();
  while (pending.length > 0) {
    const fileName = pending.pop();
    if (staticFiles.has(fileName)) {
      continue;
    }
    const record = manifestChunks.get(fileName);
    if (!record) {
      throw new Error(
        `Vite manifest references missing static chunk ${fileName}`
      );
    }
    staticFiles.add(fileName);
    pending.push(...record.imports);
  }

  return { entryFile: entryFiles[0], staticFiles };
}

export function findForbiddenStaticModules(chunks, staticJsFiles) {
  const forbiddenModules = new Set();
  for (const fileName of staticJsFiles) {
    const record = chunks.get(fileName);
    if (!record) {
      throw new Error(
        `Webview module provenance is missing static chunk ${fileName}`
      );
    }
    for (const moduleId of record.modules) {
      if (isForbiddenStaticModule(moduleId)) {
        forbiddenModules.add(`${fileName}: ${moduleId}`);
      }
    }
  }
  return [...forbiddenModules];
}
