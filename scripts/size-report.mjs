// scripts/size-report.mjs
// bundle size report for MDX Preview extension

import { statSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

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
          // Skip files that can't be read
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
    // Directory doesn't exist
  }
  return files.sort((a, b) => b.size - a.size);
}

// Calculate sizes
const extensionJsPath = join(ROOT, 'build/extension/extension.js');
const sourceMapPath = join(ROOT, 'build/extension/extension.js.map');
const webviewDir = join(ROOT, 'build/webview-app');
const buildDir = join(ROOT, 'build');

const extensionSize = getFileSize(extensionJsPath);
const sourceMapSize = getFileSize(sourceMapPath);
const webviewSize = getDirectorySize(webviewDir);
const totalBuildSize = getDirectorySize(buildDir);

// Header
console.log('');
console.log('======================================================================');
console.log('              MDX Preview Bundle Size Report                          ');
console.log('======================================================================');
console.log('');

// Main metrics
console.log('Build Summary');
console.log('---------------------------------------------');
console.log(`  Extension JS:      ${formatSize(extensionSize).padStart(12)}`);
if (sourceMapSize > 0) {
  console.log(`  Source Map:        ${formatSize(sourceMapSize).padStart(12)}  (dev only)`);
}
console.log(`  Webview App:       ${formatSize(webviewSize).padStart(12)}`);
console.log('---------------------------------------------');
console.log(`  Total Build:       ${formatSize(totalBuildSize).padStart(12)}`);
console.log('');

// Webview breakdown
const webviewFiles = getFilesInDirectory(webviewDir, (f) => f.endsWith('.js') || f.endsWith('.css'));
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

// Thresholds and warnings
console.log('Status');
console.log('---------------------------------------------');

const extensionThreshold = 20 * 1024 * 1024; // 20MB
const totalThreshold = 100 * 1024 * 1024; // 100MB

if (extensionSize > extensionThreshold) {
  console.log(`  [!] Extension bundle exceeds ${formatSize(extensionThreshold)} threshold`);
} else {
  const margin = ((extensionThreshold - extensionSize) / extensionThreshold * 100).toFixed(1);
  console.log(`  [ok] Extension: ${margin}% under ${formatSize(extensionThreshold)} threshold`);
}

if (totalBuildSize > totalThreshold) {
  console.log(`  [!] Total build exceeds ${formatSize(totalThreshold)} threshold`);
} else {
  const margin = ((totalThreshold - totalBuildSize) / totalThreshold * 100).toFixed(1);
  console.log(`  [ok] Total: ${margin}% under ${formatSize(totalThreshold)} threshold`);
}

console.log('');

// Exit with error code if thresholds exceeded
if (extensionSize > extensionThreshold || totalBuildSize > totalThreshold) {
  process.exit(1);
}
