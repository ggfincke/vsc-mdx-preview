// packages/extension/commands/authoring-guide.ts
// copy MDX authoring guide to clipboard

import * as vscode from 'vscode';
import { createTaggedLogger } from '../../shared/logging/logger';
import { LogTags } from '@mdx-preview/shared';
import { CommandNames } from './command-names';
import { MDX_AUTHORING_GUIDE_TEXT } from './authoring-guide-text';
import type { CommandDefinition } from '../types';

const log = createTaggedLogger(LogTags.CMD);

// copy the full MDX authoring guide to the system clipboard
const copyAuthoringGuide = async (): Promise<void> => {
  log.debug('copyAuthoringGuide command triggered');

  await vscode.env.clipboard.writeText(MDX_AUTHORING_GUIDE_TEXT);

  vscode.window.showInformationMessage(
    'MDX Preview: Authoring guide copied to clipboard.'
  );
};

export const commands: CommandDefinition[] = [
  { id: CommandNames.COPY_AUTHORING_GUIDE, handler: copyAuthoringGuide },
];
