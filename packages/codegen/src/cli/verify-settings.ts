// packages/codegen/src/cli/verify-settings.ts
// verify package.json settings match canonical values & descriptions
// run in CI to catch enum drift

import * as fs from 'fs';
import {
  SETTINGS_DEFAULTS,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
  PREVIEW_THEME_LABELS,
  CODE_BLOCK_THEME_LABELS,
  MERMAID_THEME_LABELS,
} from '@mdx-preview/contracts';
import {
  type PackageJson,
  type SettingProperty,
  type SettingEnumEntry,
  SETTINGS_ENUM_DESCRIPTORS,
} from '../lib/codegen-utils';
import {
  getGeneratedOutput,
  loadGeneratedOutputManifest,
  resolveGeneratedOutputPath,
} from '../lib/generated-output-manifest';
import { getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const OUTPUT_MANIFEST = loadGeneratedOutputManifest(ROOT_DIR);
const PACKAGE_JSON_PATH = resolveGeneratedOutputPath(
  ROOT_DIR,
  getGeneratedOutput(OUTPUT_MANIFEST, 'settings.packageManifest')
);

function verifyEnumEntries(
  settingKey: string,
  property: SettingProperty | undefined,
  canonicalEntries: readonly SettingEnumEntry[],
  errors: string[]
): void {
  if (!property?.enum) {
    errors.push(`Missing enum for setting: ${settingKey}`);
    return;
  }

  if (!property.enumDescriptions) {
    errors.push(`Missing enumDescriptions for enum setting: ${settingKey}`);
    return;
  }

  const enumDescriptions = property.enumDescriptions;
  const packageEntries = property.enum.map((value, index) => ({
    value,
    description: enumDescriptions[index],
  }));
  if (
    packageEntries.length !== canonicalEntries.length ||
    enumDescriptions.length !== canonicalEntries.length ||
    packageEntries.some(
      (entry, index) =>
        entry.value !== canonicalEntries[index]?.value ||
        entry.description !== canonicalEntries[index]?.description
    )
  ) {
    errors.push(
      `Ordered enum entry mismatch for ${settingKey}:\n` +
        `  package.json: ${JSON.stringify(packageEntries)}\n` +
        `  canonical:    ${JSON.stringify(canonicalEntries)}`
    );
  }
}

// verify theme label record keys match the corresponding theme array
function verifyThemeLabelKeys(
  labelName: string,
  labels: Record<string, string>,
  themeArray: readonly string[],
  errors: string[]
): void {
  const labelKeys = Object.keys(labels);
  const arraySet = new Set(themeArray);
  const labelSet = new Set(labelKeys);

  for (const theme of themeArray) {
    if (!labelSet.has(theme)) {
      errors.push(`${labelName} missing key for theme: "${theme}"`);
    }
  }

  for (const key of labelKeys) {
    if (!arraySet.has(key)) {
      errors.push(`${labelName} has extra key not in theme array: "${key}"`);
    }
  }
}

function verifyDefault(
  settingKey: string,
  packageDefault: unknown,
  canonicalDefault: unknown,
  errors: string[]
): void {
  if (packageDefault === undefined) {
    errors.push(`Missing default for setting: ${settingKey}`);
    return;
  }

  // compare by value so array/object defaults (e.g. []) aren't flagged as
  // mismatched on reference inequality
  if (JSON.stringify(packageDefault) !== JSON.stringify(canonicalDefault)) {
    errors.push(
      `Default mismatch for ${settingKey}:\n` +
        `  package.json: ${JSON.stringify(packageDefault)}\n` +
        `  canonical:    ${JSON.stringify(canonicalDefault)}`
    );
  }
}

function main(): void {
  console.log('Verifying package.json settings enums...\n');

  const packageJson: PackageJson = JSON.parse(
    fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8')
  );

  const properties = packageJson.contributes?.configuration?.properties ?? {};
  const errors: string[] = [];

  // verify ordered setting values & descriptions as pairs
  for (const [settingKey, canonicalEntries] of Object.entries(
    SETTINGS_ENUM_DESCRIPTORS
  )) {
    verifyEnumEntries(
      settingKey,
      properties[settingKey],
      canonicalEntries,
      errors
    );
  }

  // verify theme label keys match theme arrays
  verifyThemeLabelKeys(
    'PREVIEW_THEME_LABELS',
    PREVIEW_THEME_LABELS,
    PREVIEW_THEMES,
    errors
  );
  verifyThemeLabelKeys(
    'CODE_BLOCK_THEME_LABELS',
    CODE_BLOCK_THEME_LABELS,
    CODE_BLOCK_THEMES,
    errors
  );
  verifyThemeLabelKeys(
    'MERMAID_THEME_LABELS',
    MERMAID_THEME_LABELS,
    MERMAID_THEMES,
    errors
  );

  // verify defaults for all settings
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    const propertyKey = `mdx-preview.${key}`;
    const property = properties[propertyKey];
    verifyDefault(propertyKey, property?.default, value, errors);
  }

  // reverse check: verify no orphaned settings in package.json
  for (const key of Object.keys(properties)) {
    if (!key.startsWith('mdx-preview.')) {
      continue;
    }
    const settingsKey = key.replace('mdx-preview.', '');
    if (!(settingsKey in SETTINGS_DEFAULTS)) {
      errors.push(
        `Orphaned setting in package.json: ${key} (not in SETTINGS_DEFAULTS)`
      );
    }
  }

  if (errors.length > 0) {
    console.error('Settings verification FAILED:\n');
    errors.forEach((error) => console.error(`  ${error}\n`));
    console.error(
      '\nTo fix: run "npm run generate:settings". Canonical ordered descriptors live in:\n' +
        '  - packages/codegen/src/lib/codegen-utils.ts\n' +
        '  - packages/contracts/src (validated value order)\n'
    );
    process.exit(1);
  }

  console.log('All settings verifications PASSED!\n');
  console.log('Checked:');
  for (const key of Object.keys(SETTINGS_ENUM_DESCRIPTORS)) {
    console.log(`  - ${key}`);
  }
  console.log('  - defaults for all mdx-preview.* settings');
  console.log('  - no orphaned settings in package.json');
  console.log('  - ordered enum value/description pairs');
  console.log('  - theme label keys match theme arrays');
}

main();
