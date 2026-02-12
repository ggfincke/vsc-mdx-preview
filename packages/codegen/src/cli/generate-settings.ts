// packages/codegen/src/cli/generate-settings.ts
// sync package.json setting defaults & enums from contracts sources

import * as fs from 'fs';
import * as path from 'path';
import { SETTINGS_DEFAULTS } from '@mdx-preview/contracts';
import {
  type PackageJson,
  type SettingProperty,
  SETTINGS_ENUM_MAP,
} from '../lib/codegen-utils';
import { getRootDir } from './cli-utils';

const ROOT_DIR = getRootDir(import.meta.url);
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

function loadPackageJson(): PackageJson {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as PackageJson;
}

function writePackageJson(packageJson: PackageJson): void {
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );
}

function ensureProperty(
  properties: Record<string, SettingProperty>,
  key: string
): SettingProperty {
  if (!properties[key]) {
    properties[key] = {};
  }
  return properties[key];
}

function syncDefaults(properties: Record<string, SettingProperty>): void {
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    const propertyKey = `mdx-preview.${key}`;
    const property = ensureProperty(properties, propertyKey);
    property.default = value;
  }
}

function syncEnums(properties: Record<string, SettingProperty>): void {
  for (const [key, values] of Object.entries(SETTINGS_ENUM_MAP)) {
    const property = ensureProperty(properties, key);
    property.enum = [...values];
  }
}

function main(): void {
  console.log('Syncing package.json settings from contracts config...');

  const packageJson = loadPackageJson();
  const properties =
    packageJson.contributes?.configuration?.properties ??
    ({} as Record<string, SettingProperty>);

  syncDefaults(properties);
  syncEnums(properties);

  if (packageJson.contributes?.configuration) {
    packageJson.contributes.configuration.properties = properties;
  }

  writePackageJson(packageJson);

  console.log(`  OK ${PACKAGE_JSON_PATH}`);
  console.log('Done.');
}

main();
