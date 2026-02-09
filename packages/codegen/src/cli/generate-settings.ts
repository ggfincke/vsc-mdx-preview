// packages/codegen/src/cli/generate-settings.ts
// sync package.json setting defaults & enums from contracts sources

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import {
  SETTINGS_DEFAULTS,
  FRAMEWORK_SETTINGS,
  TAILWIND_ENABLED_VALUES,
  UNKNOWN_BEHAVIOR_VALUES,
  UPDATE_MODE_VALUES,
  SECURITY_POLICY_VALUES,
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
} from '@mdx-preview/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

interface SettingProperty {
  default?: unknown;
  enum?: string[];
}

interface PackageJson {
  contributes?: {
    configuration?: {
      properties?: Record<string, SettingProperty>;
    };
  };
}

const ENUM_MAP: Record<string, readonly string[]> = {
  'mdx-preview.preview.previewTheme': PREVIEW_THEMES,
  'mdx-preview.preview.codeBlockTheme': CODE_BLOCK_THEMES,
  'mdx-preview.preview.mermaidTheme': MERMAID_THEMES,
  'mdx-preview.framework': FRAMEWORK_SETTINGS,
  'mdx-preview.tailwind.enabled': TAILWIND_ENABLED_VALUES,
  'mdx-preview.components.unknownBehavior': UNKNOWN_BEHAVIOR_VALUES,
  'mdx-preview.preview.updateMode': UPDATE_MODE_VALUES,
  'mdx-preview.preview.security': SECURITY_POLICY_VALUES,
};

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
  for (const [key, values] of Object.entries(ENUM_MAP)) {
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
