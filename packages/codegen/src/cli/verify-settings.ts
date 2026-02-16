// packages/codegen/src/cli/verify-settings.ts
// verify package.json enum settings match canonical sources in contracts
// run in CI to catch enum drift

import * as fs from 'fs';
import * as path from 'path';
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
  SETTINGS_ENUM_MAP,
} from '../lib/codegen-utils';
import { getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

function verifyEnum(
  settingKey: string,
  packageEnum: string[] | undefined,
  canonicalArray: readonly string[],
  errors: string[]
): void {
  if (!packageEnum) {
    errors.push(`Missing enum for setting: ${settingKey}`);
    return;
  }

  if (!arraysEqual(packageEnum, canonicalArray)) {
    errors.push(
      `Enum mismatch for ${settingKey}:\n` +
        `  package.json: [${packageEnum.join(', ')}]\n` +
        `  canonical:    [${canonicalArray.join(', ')}]`
    );
  }
}

function verifyEnumDescriptions(
  settingKey: string,
  property: SettingProperty | undefined,
  errors: string[]
): void {
  if (!property?.enum) {
    return;
  }
  // only check settings that have enumDescriptions defined
  // (not all enum settings use descriptions)
  if (!property.enumDescriptions) {
    return;
  }
  if (property.enum.length !== property.enumDescriptions.length) {
    errors.push(
      `enumDescriptions length mismatch for ${settingKey}:\n` +
        `  enum has ${property.enum.length} values\n` +
        `  enumDescriptions has ${property.enumDescriptions.length} descriptions`
    );
  }
}

// verify all enum settings in SETTINGS_ENUM_MAP have enumDescriptions
function verifyEnumDescriptionsExist(
  properties: Record<string, SettingProperty>,
  errors: string[]
): void {
  for (const settingKey of Object.keys(SETTINGS_ENUM_MAP)) {
    const property = properties[settingKey];
    if (property?.enum && !property.enumDescriptions) {
      errors.push(
        `Missing enumDescriptions for enum setting: ${settingKey}\n` +
          `  enum has ${property.enum.length} values but no descriptions`
      );
    }
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

  if (packageDefault !== canonicalDefault) {
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

  // verify all enum settings match canonical sources
  for (const [settingKey, canonicalArray] of Object.entries(
    SETTINGS_ENUM_MAP
  )) {
    verifyEnum(
      settingKey,
      properties[settingKey]?.enum,
      canonicalArray,
      errors
    );
  }

  // verify enumDescriptions parity (count must match enum array)
  for (const settingKey of Object.keys(SETTINGS_ENUM_MAP)) {
    verifyEnumDescriptions(settingKey, properties[settingKey], errors);
  }

  // verify all enum settings have enumDescriptions defined
  verifyEnumDescriptionsExist(properties, errors);

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

  if (errors.length > 0) {
    console.error('Settings verification FAILED:\n');
    errors.forEach((error) => console.error(`  ${error}\n`));
    console.error(
      '\nTo fix: update package.json enums to match the canonical sources in:\n' +
        '  - packages/contracts/src/themes/data.ts (theme arrays & labels)\n' +
        '  - packages/contracts/src/config/enums.ts (config enums)\n'
    );
    process.exit(1);
  }

  console.log('All settings verifications PASSED!\n');
  console.log('Checked:');
  for (const key of Object.keys(SETTINGS_ENUM_MAP)) {
    console.log(`  - ${key}`);
  }
  console.log('  - defaults for all mdx-preview.* settings');
  console.log('  - enumDescriptions parity for all enum settings');
  console.log('  - enumDescriptions required for all enum settings');
  console.log('  - theme label keys match theme arrays');
}

main();
