declare module 'jest' {
  export function runCLI(
    jestConfig: object,
    projects: string[]
  ): Promise<{ globalConfig: object; results: ResultsObject }>;

  export interface ResultsObject {
    testResults: {
      failureMessage?: string;
    }[];
  }
}

declare module 'jest-environment-node' {
  import type { JestEnvironmentConfig } from '@jest/environment';

  export default class NodeEnvironment {
    public global: Record<string, unknown>;

    constructor(config: JestEnvironmentConfig);

    public setup(): Promise<void>;
    public teardown(): Promise<void>;
    public runScript(script: unknown): unknown;
  }
}

declare namespace NodeJS {
  interface Global {
    vscode: typeof import('vscode');
  }
}
