// packages/extension/test/extension.integration.test.ts
// integration tests for extension activation, commands, & lifecycle

import { describe, test, expect, beforeAll } from 'vitest';
import * as vscode from 'vscode';

// extension ID for this extension
const EXTENSION_ID = 'xyc.vscode-mdx-preview';

// list of expected commands
const EXPECTED_COMMANDS = [
  'mdx-preview.commands.openPreview',
  'mdx-preview.commands.refreshPreview',
  'mdx-preview.commands.toggleUseVscodeMarkdownStyles',
  'mdx-preview.commands.toggleUseWhiteBackground',
  'mdx-preview.commands.changeSecuritySettings',
  'mdx-preview.commands.toggleScripts',
  'mdx-preview.commands.selectPreviewTheme',
  'mdx-preview.commands.selectCodeBlockTheme',
  'mdx-preview.commands.zoomIn',
  'mdx-preview.commands.zoomOut',
  'mdx-preview.commands.resetZoom',
  'mdx-preview.commands.selectFramework',
  'mdx-preview.commands.refreshModuleCache',
];

// extension reference at module scope (used by multiple describe blocks)
let extension: vscode.Extension<unknown> | undefined;

describe('Extension Integration', function () {
  beforeAll(async function () {
    // Get the extension
    extension = vscode.extensions.getExtension(EXTENSION_ID);

    // Ensure extension is activated
    if (extension && !extension.isActive) {
      await extension.activate();
    }
  });

  describe('activation', function () {
    test('extension is present', function () {
      expect(extension).toBeDefined();
    });

    test('extension activates without errors', function () {
      expect(extension?.isActive).toBe(true);
    });

    test('extension has correct ID', function () {
      expect(extension?.id).toBe(EXTENSION_ID);
    });
  });

  describe('commands', function () {
    test('all expected commands are registered', async function () {
      const allCommands = await vscode.commands.getCommands(true);

      for (const expectedCommand of EXPECTED_COMMANDS) {
        expect(allCommands).toContain(expectedCommand);
      }
    });

    test('openPreview command is available', async function () {
      const allCommands = await vscode.commands.getCommands(true);
      expect(allCommands).toContain('mdx-preview.commands.openPreview');
    });

    test('refreshPreview command is available', async function () {
      const allCommands = await vscode.commands.getCommands(true);
      expect(allCommands).toContain('mdx-preview.commands.refreshPreview');
    });

    test('zoom commands are available', async function () {
      const allCommands = await vscode.commands.getCommands(true);
      expect(allCommands).toContain('mdx-preview.commands.zoomIn');
      expect(allCommands).toContain('mdx-preview.commands.zoomOut');
      expect(allCommands).toContain('mdx-preview.commands.resetZoom');
    });

    test('theme selection commands are available', async function () {
      const allCommands = await vscode.commands.getCommands(true);
      expect(allCommands).toContain('mdx-preview.commands.selectPreviewTheme');
      expect(allCommands).toContain('mdx-preview.commands.selectCodeBlockTheme');
    });

    test('framework selection command is available', async function () {
      const allCommands = await vscode.commands.getCommands(true);
      expect(allCommands).toContain('mdx-preview.commands.selectFramework');
    });

    test('refreshModuleCache command executes without error', async function () {
      // This command should execute without throwing
      await expect(
        vscode.commands.executeCommand('mdx-preview.commands.refreshModuleCache')
      ).resolves.not.toThrow();
    });

    test('refreshPreview command executes without error when no preview open', async function () {
      // Should not throw even when no preview is open
      await expect(
        vscode.commands.executeCommand('mdx-preview.commands.refreshPreview')
      ).resolves.not.toThrow();
    });

    test('zoom commands execute without error when no preview open', async function () {
      // Should not throw even when no preview is open
      await expect(
        vscode.commands.executeCommand('mdx-preview.commands.zoomIn')
      ).resolves.not.toThrow();
      await expect(
        vscode.commands.executeCommand('mdx-preview.commands.zoomOut')
      ).resolves.not.toThrow();
      await expect(
        vscode.commands.executeCommand('mdx-preview.commands.resetZoom')
      ).resolves.not.toThrow();
    });
  });

  describe('configuration', function () {
    test('extension has configuration section', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      expect(config).toBeDefined();
    });

    test('preview.enableScripts setting exists', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const enableScripts = config.get<boolean>('preview.enableScripts');
      // Should be defined (either true or false)
      expect(typeof enableScripts).toBe('boolean');
    });

    test('preview.previewTheme setting exists', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const previewTheme = config.get<string>('preview.previewTheme');
      expect(previewTheme).toBeDefined();
    });

    test('preview.codeBlockTheme setting exists', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const codeBlockTheme = config.get<string>('preview.codeBlockTheme');
      expect(codeBlockTheme).toBeDefined();
    });

    test('preview.security setting exists', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const security = config.get<string>('preview.security');
      expect(security).toBeDefined();
    });

    test('framework setting exists', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const framework = config.get<string>('framework');
      expect(framework).toBeDefined();
    });

    test('tailwind.enabled setting exists', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const tailwindEnabled = config.get<string>('tailwind.enabled');
      expect(tailwindEnabled).toBeDefined();
    });

    test('preview.updateMode has valid value', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const updateMode = config.get<string>('preview.updateMode');
      expect(['onType', 'onSave', 'manual']).toContain(updateMode);
    });

    test('preview.debounceDelay is a number', function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const debounceDelay = config.get<number>('preview.debounceDelay');
      expect(typeof debounceDelay).toBe('number');
      expect(debounceDelay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('workspace trust', function () {
    test('workspace trust state is accessible', function () {
      // Should not throw when accessing trust state
      expect(() => vscode.workspace.isTrusted).not.toThrow();
      expect(typeof vscode.workspace.isTrusted).toBe('boolean');
    });
  });

  describe('toggle commands', function () {
    test('toggleUseVscodeMarkdownStyles command executes', async function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const initialValue = config.get<boolean>(
        'preview.useVscodeMarkdownStyles'
      );

      // Execute toggle command
      await vscode.commands.executeCommand(
        'mdx-preview.commands.toggleUseVscodeMarkdownStyles'
      );

      // Check value changed
      const newValue = config.get<boolean>('preview.useVscodeMarkdownStyles');
      expect(newValue).toBe(!initialValue);

      // Toggle back to restore original state
      await vscode.commands.executeCommand(
        'mdx-preview.commands.toggleUseVscodeMarkdownStyles'
      );
    });

    test('toggleUseWhiteBackground command executes', async function () {
      const config = vscode.workspace.getConfiguration('mdx-preview');
      const initialValue = config.get<boolean>('preview.useWhiteBackground');

      // Execute toggle command
      await vscode.commands.executeCommand(
        'mdx-preview.commands.toggleUseWhiteBackground'
      );

      // Check value changed
      const newValue = config.get<boolean>('preview.useWhiteBackground');
      expect(newValue).toBe(!initialValue);

      // Toggle back to restore original state
      await vscode.commands.executeCommand(
        'mdx-preview.commands.toggleUseWhiteBackground'
      );
    });
  });

  describe('workspace folders', function () {
    test('workspace folders are accessible', function () {
      // Should be able to access workspace folders
      expect(() => vscode.workspace.workspaceFolders).not.toThrow();
    });
  });

  describe('output channel', function () {
    test('extension creates output channel', async function () {
      // After activation, the extension should have created an output channel
      // We can't directly check this, but the extension should activate without errors
      expect(extension?.isActive).toBe(true);
    });
  });
});

describe('MDX Document Handling', function () {
  test('MDX language is recognized', async function () {
    // Create a temporary MDX file content
    const mdxContent = '# Hello World\n\nexport const name = "test";';

    // create untitled document w/ MDX content
    const doc = await vscode.workspace.openTextDocument({
      language: 'mdx',
      content: mdxContent,
    });

    expect(doc.languageId).toBe('mdx');
    expect(doc.getText()).toContain('# Hello World');
  });

  test('MDX documents can be opened', async function () {
    const mdxContent = '# Test MDX\n\nThis is a test.';

    const doc = await vscode.workspace.openTextDocument({
      language: 'mdx',
      content: mdxContent,
    });

    expect(doc).toBeDefined();
    expect(doc.getText()).toBe(mdxContent);
  });
});

describe('Extension Package Manifest', function () {
  test('extension has display name', function () {
    expect(extension?.packageJSON.displayName).toBeDefined();
  });

  test('extension has description', function () {
    expect(extension?.packageJSON.description).toBeDefined();
  });

  test('extension has version', function () {
    expect(extension?.packageJSON.version).toBeDefined();
    // Version should be in semver format
    expect(extension?.packageJSON.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('extension has activation events', function () {
    expect(extension?.packageJSON.activationEvents).toBeDefined();
  });

  test('extension contributes commands', function () {
    expect(extension?.packageJSON.contributes?.commands).toBeDefined();
    expect(Array.isArray(extension?.packageJSON.contributes?.commands)).toBe(
      true
    );
  });

  test('extension contributes configuration', function () {
    expect(extension?.packageJSON.contributes?.configuration).toBeDefined();
  });

  test('extension contributes keybindings', function () {
    expect(extension?.packageJSON.contributes?.keybindings).toBeDefined();
  });
});
