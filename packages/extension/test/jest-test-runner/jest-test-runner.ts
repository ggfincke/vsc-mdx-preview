// Jest test runner is adapted from https://github.com/Unibeautify/vscode/blob/master/test/jest-test-runner.ts
// Copyright (c) 2017 Unibeautify

import { runCLI } from 'jest';
import type { AggregatedResult } from '@jest/test-result';
import * as path from 'path';

interface JestConfig {
  rootDir: string;
  roots: string[];
  verbose: boolean;
  colors: boolean;
  transform: string;
  runInBand: boolean;
  testRegex: string;
  testEnvironment: string;
  setupFilesAfterEnv: string[];
  moduleFileExtensions: string[];
  updateSnapshot?: boolean;
}

const jestConfig: JestConfig = {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  verbose: true,
  colors: true,
  transform: JSON.stringify({
    '^.+\\.ts$': ['ts-jest', { tsconfig: '' }],
  }),
  runInBand: true,
  testRegex: '\\.test\\.ts$',
  testEnvironment: path.join(__dirname, './jest-vscode-environment.js'),
  setupFilesAfterEnv: [
    path.join(__dirname, './jest-vscode-framework-setup.js'),
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
};

interface JestTestRunnerConfig {
  rootDir: string;
  roots: string[];
  tsConfig: string;
  updateSnapshot?: boolean;
}

export function configure(options: JestTestRunnerConfig): void {
  const { rootDir, roots, tsConfig, updateSnapshot } = options;
  Object.assign(jestConfig, {
    rootDir,
    roots,
    transform: JSON.stringify({
      '^.+\\.ts$': ['ts-jest', { tsconfig: tsConfig }],
    }),
    updateSnapshot,
  });
}

export type TestRunnerCallback = (
  error: Error | null,
  failures?: string[]
) => void;

export async function run(
  _testRoot: string,
  callback: TestRunnerCallback
): Promise<void> {
  forwardStdoutStderrStreams();

  try {
    const { results } = (await runCLI(
      jestConfig as Parameters<typeof runCLI>[0],
      [jestConfig.rootDir]
    )) as unknown as { results: AggregatedResult };
    const failures = collectTestFailureMessages(results);

    if (failures.length > 0) {
      callback(null, failures);
      return;
    }

    callback(null);
  } catch (e) {
    callback(e instanceof Error ? e : new Error(String(e)));
  }
}

function collectTestFailureMessages(results: AggregatedResult): string[] {
  return results.testResults.reduce<string[]>((acc, testResult) => {
    if (testResult.failureMessage) {
      acc.push(testResult.failureMessage);
    }
    return acc;
  }, []);
}

function forwardStdoutStderrStreams(): void {
  const logger = (line: string): boolean => {
    console.log(line);
    return true;
  };

  process.stdout.write = logger as typeof process.stdout.write;
  process.stderr.write = logger as typeof process.stderr.write;
}
