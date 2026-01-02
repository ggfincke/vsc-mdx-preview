/**
 * Takes the Visual Studio Code extension API which was exposed on the sandbox's
 * global object and uses it to create a virtual mock. This replaces vscode
 * module imports with the vscode extension instance from the test runner's
 * environment.
 *
 * @see jest-vscode-environment.ts
 *
 * Note: This file is used for VS Code integration tests and may still
 * reference Jest APIs. Integration tests run in VS Code's extension host.
 */
import { vi } from 'vitest';

vi.mock('vscode', () => (global as Record<string, unknown>).vscode);
