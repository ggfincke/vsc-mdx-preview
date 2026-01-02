/**
 * Exposes the Visual Studio Code extension API to the Jest testing environment.
 */
import NodeEnvironment from 'jest-environment-node';
import * as vscode from 'vscode';

import type { JestEnvironmentConfig } from '@jest/environment';

class VsCodeEnvironment extends NodeEnvironment {
  constructor(config: JestEnvironmentConfig) {
    super(config);
  }

  public async setup(): Promise<void> {
    await super.setup();
    this.global.vscode = vscode;
  }

  public async teardown(): Promise<void> {
    this.global.vscode = {};
    await super.teardown();
  }
}

export default VsCodeEnvironment;
