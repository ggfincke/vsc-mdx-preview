import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const esmDir = process.env.MDX_TOOLS_ESM_DIR
  ? path.resolve(process.env.MDX_TOOLS_ESM_DIR)
  : path.resolve(__dirname, '..', 'dist', 'esm');

const KNOWN_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
];

function hasKnownExtension(specifier) {
  return KNOWN_EXTENSIONS.some((ext) => specifier.endsWith(ext));
}

function resolveSpecifier(filePath, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return specifier;
  }

  if (hasKnownExtension(specifier)) {
    return specifier;
  }

  const basePath = path.resolve(path.dirname(filePath), specifier);
  const fileCandidate = `${basePath}.js`;
  if (fs.existsSync(fileCandidate) && fs.statSync(fileCandidate).isFile()) {
    return `${specifier}.js`;
  }

  const indexCandidate = path.join(basePath, 'index.js');
  if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
    return specifier.endsWith('/') ? `${specifier}index.js` : `${specifier}/index.js`;
  }

  return specifier;
}

function rewriteSpecifiers(filePath, source) {
  let next = source.replace(
    /(from\s+)(['"])(\.{1,2}\/[^'"]+)\2/g,
    (match, prefix, quote, specifier) => {
      const resolved = resolveSpecifier(filePath, specifier);
      return `${prefix}${quote}${resolved}${quote}`;
    }
  );

  next = next.replace(
    /(import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2(\s*\))/g,
    (match, prefix, quote, specifier, suffix) => {
      const resolved = resolveSpecifier(filePath, specifier);
      return `${prefix}${quote}${resolved}${quote}${suffix}`;
    }
  );

  return next;
}

function listJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const checkOnly = process.argv.includes('--check');

if (!fs.existsSync(esmDir)) {
  console.error(`ESM output directory not found: ${esmDir}`);
  process.exit(1);
}

const jsFiles = listJsFiles(esmDir);
let changedFiles = 0;
const wouldChangeFiles = [];

for (const filePath of jsFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  const rewritten = rewriteSpecifiers(filePath, source);
  if (rewritten !== source) {
    changedFiles += 1;
    if (checkOnly) {
      wouldChangeFiles.push(path.relative(esmDir, filePath));
      continue;
    }
    fs.writeFileSync(filePath, rewritten, 'utf8');
  }
}

if (checkOnly) {
  if (wouldChangeFiles.length > 0) {
    console.error(
      `Found ${wouldChangeFiles.length} files with unresolved ESM specifiers.`
    );
    for (const relativePath of wouldChangeFiles) {
      console.error(` - ${relativePath}`);
    }
    process.exit(1);
  }

  console.log(
    `ESM import/export specifiers are valid in ${jsFiles.length} files.`
  );
  process.exit(0);
}

console.log(
  `Fixed ESM import/export specifiers in ${changedFiles}/${jsFiles.length} files.`
);
