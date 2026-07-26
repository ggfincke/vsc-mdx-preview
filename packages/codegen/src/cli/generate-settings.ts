// packages/codegen/src/cli/generate-settings.ts
// sync package.json defaults & ordered enum descriptors

import * as fs from 'fs';
import { SETTINGS_DEFAULTS } from '@mdx-preview/contracts';
import {
  type PackageJson,
  type SettingProperty,
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
  for (const [key, entries] of Object.entries(SETTINGS_ENUM_DESCRIPTORS)) {
    const property = ensureProperty(properties, key);
    property.enum = entries.map(({ value }) => value);
    property.enumDescriptions = entries.map(({ description }) => description);
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
