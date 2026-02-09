// packages/codegen/src/cli/verify-settings.ts
// verify package.json enum settings match canonical sources in contracts
// run in CI to catch enum drift

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import {
  PREVIEW_THEMES,
  CODE_BLOCK_THEMES,
  MERMAID_THEMES,
  FRAMEWORK_SETTINGS,
  TAILWIND_ENABLED_VALUES,
  UNKNOWN_BEHAVIOR_VALUES,
  UPDATE_MODE_VALUES,
  SECURITY_POLICY_VALUES,
  SETTINGS_DEFAULTS,
} from '@mdx-preview/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

interface PackageJson {
  contributes?: {
    configuration?: {
      properties?: Record<
        string,
        {
          enum?: string[];
          enumDescriptions?: string[];
          default?: unknown;
        }
      >;
    };
  };
}

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

  // verify preview theme enum
  verifyEnum(
    'mdx-preview.preview.previewTheme',
    properties['mdx-preview.preview.previewTheme']?.enum,
    PREVIEW_THEMES,
    errors
  );

  // verify code block theme enum
  verifyEnum(
    'mdx-preview.preview.codeBlockTheme',
    properties['mdx-preview.preview.codeBlockTheme']?.enum,
    CODE_BLOCK_THEMES,
    errors
  );

  // verify mermaid theme enum
  verifyEnum(
    'mdx-preview.preview.mermaidTheme',
    properties['mdx-preview.preview.mermaidTheme']?.enum,
    MERMAID_THEMES,
    errors
  );

  // verify framework setting enum
  verifyEnum(
    'mdx-preview.framework',
    properties['mdx-preview.framework']?.enum,
    FRAMEWORK_SETTINGS,
    errors
  );

  // verify tailwind.enabled enum
  verifyEnum(
    'mdx-preview.tailwind.enabled',
    properties['mdx-preview.tailwind.enabled']?.enum,
    TAILWIND_ENABLED_VALUES,
    errors
  );

  // verify unknownBehavior enum
  verifyEnum(
    'mdx-preview.components.unknownBehavior',
    properties['mdx-preview.components.unknownBehavior']?.enum,
    UNKNOWN_BEHAVIOR_VALUES,
    errors
  );

  // verify updateMode enum
  verifyEnum(
    'mdx-preview.preview.updateMode',
    properties['mdx-preview.preview.updateMode']?.enum,
    UPDATE_MODE_VALUES,
    errors
  );

  // verify security policy enum
  verifyEnum(
    'mdx-preview.preview.security',
    properties['mdx-preview.preview.security']?.enum,
    SECURITY_POLICY_VALUES,
    errors
  );

  // verify defaults for all settings
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    const propertyKey = `mdx-preview.${key}`;
    const property = properties[propertyKey];
    verifyDefault(propertyKey, property?.default, value, errors);
  }

  if (errors.length > 0) {
    console.error('Enum verification FAILED:\n');
    errors.forEach((error) => console.error(`  ${error}\n`));
    console.error(
      '\nTo fix: update package.json enums to match the canonical sources in:\n' +
        '  - packages/contracts/src/themes/data.ts (theme arrays)\n' +
        '  - packages/contracts/src/config/enums.ts (config enums)\n'
    );
    process.exit(1);
  }

  console.log('All settings verifications PASSED!\n');
  console.log('Checked:');
  console.log('  - mdx-preview.preview.previewTheme');
  console.log('  - mdx-preview.preview.codeBlockTheme');
  console.log('  - mdx-preview.preview.mermaidTheme');
  console.log('  - mdx-preview.framework');
  console.log('  - mdx-preview.tailwind.enabled');
  console.log('  - mdx-preview.components.unknownBehavior');
  console.log('  - mdx-preview.preview.updateMode');
  console.log('  - mdx-preview.preview.security');
  console.log('  - defaults for all mdx-preview.* settings');
}

main();
