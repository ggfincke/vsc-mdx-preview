// scripts/size-report.mjs
// bundle size report for MDX Preview extension

import { statSync, readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { gzipSync } from 'zlib';
import {
  findForbiddenStaticModules,
  parseWebviewManifest,
  parseWebviewModuleProvenance,
  validateWebviewChunkProvenance,
  validateWebviewManifestHash,
} from './lib/webview-module-provenance.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const WEBVIEW_MANIFEST_PATH = join(
  ROOT,
  'build/webview-app/.vite/manifest.json'
);
const WEBVIEW_MODULE_PROVENANCE_PATH = join(
  ROOT,
  'build/webview-app/.vite/module-provenance.json'
);
const WEBVIEW_PUBLIC_TAILWIND_FILE = 'vendor/tailwind-browser.min.js';
const WEBVIEW_PUBLIC_TAILWIND_PATH = join(
  ROOT,
  'packages/webview-client/public',
  WEBVIEW_PUBLIC_TAILWIND_FILE
);
// 160 KiB permits 34% growth over the corrected 122,283-byte static closure
const WEBVIEW_STATIC_JS_GZIP_THRESHOLD = 160 * 1024;
const LOGOS_PAYLOAD_MARKERS = [
  '"100tb":{"body"',
  '"aws-amplify":{"body"',
  '"aws-lambda":{"body"',
];

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getDirectorySize(dir) {
  let size = 0;
  try {
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        try {
          const fullPath = join(entry.parentPath || entry.path, entry.name);
          size += statSync(fullPath).size;
        } catch {
          // skip files that can't be read
        }
      }
    }
  } catch {
    return 0;
  }
  return size;
}

function getFileSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function hasLogosPayload(source) {
  return LOGOS_PAYLOAD_MARKERS.every((marker) => source.includes(marker));
}

function readWebviewModuleProvenance() {
  let provenance;
  try {
    provenance = JSON.parse(
      readFileSync(WEBVIEW_MODULE_PROVENANCE_PATH, 'utf8')
    );
  } catch (error) {
    return {
      error: `Unable to read ${relative(ROOT, WEBVIEW_MODULE_PROVENANCE_PATH)}: ${error.message}`,
    };
  }

  try {
    return parseWebviewModuleProvenance(provenance);
  } catch (error) {
    return { error: error.message };
  }
}

function readEmittedWebviewChunks() {
  const chunks = new Map();
  let sawPublicTailwind = false;
  let entries;
  try {
    entries = readdirSync(webviewDir, { recursive: true, withFileTypes: true });
  } catch (error) {
    throw new Error(
      `Unable to enumerate ${relative(ROOT, webviewDir)}: ${error.message}`
    );
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }
    const filePath = join(entry.parentPath || entry.path, entry.name);
    const fileName = relative(webviewDir, filePath).replaceAll('\\', '/');
    let source;
    try {
      source = readFileSync(filePath);
    } catch (error) {
      throw new Error(
        `Unable to read emitted webview chunk ${relative(ROOT, filePath)}: ${error.message}`
      );
    }

    if (fileName === WEBVIEW_PUBLIC_TAILWIND_FILE) {
      sawPublicTailwind = true;
      let publicSource;
      try {
        publicSource = readFileSync(WEBVIEW_PUBLIC_TAILWIND_PATH);
      } catch (error) {
        throw new Error(
          `Unable to verify copied public JavaScript ${relative(ROOT, WEBVIEW_PUBLIC_TAILWIND_PATH)}: ${error.message}`
        );
      }
      if (!source.equals(publicSource)) {
        throw new Error(
          `Copied public JavaScript ${WEBVIEW_PUBLIC_TAILWIND_FILE} differs from its source`
        );
      }
      continue;
    }

    chunks.set(fileName, source);
  }

  if (!sawPublicTailwind) {
    throw new Error(
      `Webview build is missing required public JavaScript ${WEBVIEW_PUBLIC_TAILWIND_FILE}`
    );
  }
  if (chunks.size === 0) {
    throw new Error('Webview build contains no emitted JavaScript chunks');
  }
  return chunks;
}

function analyzeWebviewEntry() {
  let manifestSource;
  try {
    manifestSource = readFileSync(WEBVIEW_MANIFEST_PATH);
  } catch (error) {
    return {
      error: `Unable to read ${relative(ROOT, WEBVIEW_MANIFEST_PATH)}: ${error.message}`,
    };
  }

  const provenance = readWebviewModuleProvenance();
  if (provenance.error) {
    return provenance;
  }

  let manifest;
  try {
    validateWebviewManifestHash(provenance.manifestSha256, manifestSource);
    manifest = JSON.parse(manifestSource.toString('utf8'));
  } catch (error) {
    return { error: error.message };
  }

  let emittedChunks;
  let entryFile;
  let staticJsFiles;
  try {
    emittedChunks = readEmittedWebviewChunks();
    const manifestChunks = parseWebviewManifest(manifest);
    ({ entryFile, staticFiles: staticJsFiles } = validateWebviewChunkProvenance(
      provenance.chunks,
      manifestChunks,
      emittedChunks
    ));
  } catch (error) {
    return { error: error.message };
  }

  const logosPayloadFiles = [];
  let staticJsSize = 0;
  let staticJsGzipSize = 0;

  for (const fileName of staticJsFiles) {
    const source = emittedChunks.get(fileName);
    staticJsSize += source.byteLength;
    staticJsGzipSize += gzipSync(source).byteLength;
    if (hasLogosPayload(source.toString('utf8'))) {
      logosPayloadFiles.push(fileName);
    }
  }

  let forbiddenStaticModules;
  try {
    forbiddenStaticModules = findForbiddenStaticModules(
      provenance.chunks,
      staticJsFiles
    );
  } catch (error) {
    return { error: error.message };
  }

  const entrySource = emittedChunks.get(entryFile);

  return {
    entryFile,
    entrySize: entrySource.byteLength,
    entryGzipSize: gzipSync(entrySource).byteLength,
    staticJsSize,
    staticJsGzipSize,
    forbiddenStaticModules,
    logosPayloadFiles,
  };
}

function getFilesInDirectory(dir, filter = () => true) {
  const files = [];
  try {
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const fullPath = join(entry.parentPath || entry.path, entry.name);
        if (filter(fullPath)) {
          files.push({
            path: relative(ROOT, fullPath),
            size: statSync(fullPath).size,
          });
        }
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files.sort((a, b) => b.size - a.size);
}

// calculate sizes
const extensionJsPath = join(ROOT, 'build/extension/extension.js');
const sourceMapPath = join(ROOT, 'build/extension/extension.js.map');
const webviewDir = join(ROOT, 'build/webview-app');
const buildDir = join(ROOT, 'build');

const extensionSize = getFileSize(extensionJsPath);
const sourceMapSize = getFileSize(sourceMapPath);
const webviewSize = getDirectorySize(webviewDir);
const totalBuildSize = getDirectorySize(buildDir);
const webviewEntry = analyzeWebviewEntry();

// header
console.log('');
console.log(
  '======================================================================'
);
console.log(
  '              MDX Preview Bundle Size Report                          '
);
console.log(
  '======================================================================'
);
console.log('');

// main metrics
console.log('Build Summary');
console.log('---------------------------------------------');
console.log(`  Extension JS:      ${formatSize(extensionSize).padStart(12)}`);
if (sourceMapSize > 0) {
  console.log(
    `  Source Map:        ${formatSize(sourceMapSize).padStart(12)}  (dev only)`
  );
}
console.log(`  Webview App:       ${formatSize(webviewSize).padStart(12)}`);
if (!webviewEntry.error) {
  console.log(
    `  Webview Entry:     ${formatSize(webviewEntry.entrySize).padStart(12)}`
  );
  console.log(
    `  Entry Gzip:        ${formatSize(webviewEntry.entryGzipSize).padStart(12)}`
  );
  console.log(
    `  Static JS:         ${formatSize(webviewEntry.staticJsSize).padStart(12)}`
  );
  console.log(
    `  Static JS Gzip:    ${formatSize(webviewEntry.staticJsGzipSize).padStart(12)}`
  );
}
console.log('---------------------------------------------');
console.log(`  Total Build:       ${formatSize(totalBuildSize).padStart(12)}`);
console.log('');

// webview breakdown
const webviewFiles = getFilesInDirectory(
  webviewDir,
  (f) => f.endsWith('.js') || f.endsWith('.css')
);
if (webviewFiles.length > 0) {
  console.log('Webview Chunks (JS/CSS)');
  console.log('---------------------------------------------');
  for (const file of webviewFiles.slice(0, 10)) {
    const name = file.path.replace('build/webview-app/', '');
    console.log(`  ${name.padEnd(35)} ${formatSize(file.size).padStart(8)}`);
  }
  if (webviewFiles.length > 10) {
    console.log(`  ... and ${webviewFiles.length - 10} more files`);
  }
  console.log('');
}

// thresholds & warnings
console.log('Status');
console.log('---------------------------------------------');

// set extension bundle threshold (25MB)
const extensionThreshold = 25 * 1024 * 1024;
// set total build threshold (100MB)
const totalThreshold = 100 * 1024 * 1024;
const failures = [];

if (extensionSize > extensionThreshold) {
  console.log(
    `  [!] Extension bundle exceeds ${formatSize(extensionThreshold)} threshold`
  );
  failures.push('extension bundle threshold');
} else {
  const margin = (
    ((extensionThreshold - extensionSize) / extensionThreshold) *
    100
  ).toFixed(1);
  console.log(
    `  [ok] Extension: ${margin}% under ${formatSize(extensionThreshold)} threshold`
  );
}

if (totalBuildSize > totalThreshold) {
  console.log(
    `  [!] Total build exceeds ${formatSize(totalThreshold)} threshold`
  );
  failures.push('total build threshold');
} else {
  const margin = (
    ((totalThreshold - totalBuildSize) / totalThreshold) *
    100
  ).toFixed(1);
  console.log(
    `  [ok] Total: ${margin}% under ${formatSize(totalThreshold)} threshold`
  );
}

if (webviewEntry.error) {
  console.log(`  [!] ${webviewEntry.error}`);
  failures.push('webview entry analysis');
} else {
  if (webviewEntry.staticJsGzipSize > WEBVIEW_STATIC_JS_GZIP_THRESHOLD) {
    console.log(
      `  [!] Webview static JS gzip exceeds ${formatSize(WEBVIEW_STATIC_JS_GZIP_THRESHOLD)} threshold`
    );
    failures.push('webview static JS gzip threshold');
  } else {
    const margin = (
      ((WEBVIEW_STATIC_JS_GZIP_THRESHOLD - webviewEntry.staticJsGzipSize) /
        WEBVIEW_STATIC_JS_GZIP_THRESHOLD) *
      100
    ).toFixed(1);
    console.log(
      `  [ok] Static JS gzip: ${margin}% under ${formatSize(WEBVIEW_STATIC_JS_GZIP_THRESHOLD)} threshold`
    );
  }

  if (webviewEntry.forbiddenStaticModules.length > 0) {
    console.log(
      `  [!] Webview entry statically reaches diagram renderer/core modules: ${webviewEntry.forbiddenStaticModules.join(', ')}`
    );
    failures.push('static diagram renderer/core dependency');
  } else {
    console.log('  [ok] Entry static graph excludes diagram renderers & cores');
  }

  if (webviewEntry.logosPayloadFiles.length > 0) {
    console.log(
      `  [!] Webview entry statically reaches bundled logos: ${webviewEntry.logosPayloadFiles.join(', ')}`
    );
    failures.push('static logos entry payload');
  } else {
    console.log('  [ok] Entry static graph excludes bundled logos');
  }
}

console.log('');

// exit w/ error code if thresholds exceeded
if (failures.length > 0) {
  process.exit(1);
}
