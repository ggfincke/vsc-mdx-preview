// packages/extension-host/src/features/security/security.ts
// security policy selection for CSP (strict or disabled)

import * as vscode from 'vscode';
import type { SecurityPolicyValue } from '@mdx-preview/contracts';
import { getConfigManager } from '../../app/services';
import { SETTINGS } from '../../shared/config/ConfigManager';

// select security policy via Quick Pick
const selectSecurityPolicy = async () => {
  const configManager = getConfigManager();
  const securityPolicy = configManager.get(SETTINGS.SECURITY);

  const pickItems: Array<{
    type: SecurityPolicyValue;
    label: string;
    description: string;
  }> = [
    {
      type: 'strict',
      label: 'strict',
      description: 'Do not allow insecure content or eval',
    },
    {
      type: 'disabled',
      label: 'disabled',
      description: 'Allow insecure content (not recommended)',
    },
  ];

  const currentPolicyItem = pickItems.find((pickItem) => {
    return pickItem.type === securityPolicy;
  });
  if (currentPolicyItem) {
    currentPolicyItem.label = `• ${currentPolicyItem.label}`;
  }

  const selectedSecurityPolicyItem =
    await vscode.window.showQuickPick(pickItems);
  if (selectedSecurityPolicyItem) {
    await configManager.set(SETTINGS.SECURITY, selectedSecurityPolicyItem.type);
  }
};

export { selectSecurityPolicy };
