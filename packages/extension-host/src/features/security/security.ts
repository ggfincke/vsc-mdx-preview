// packages/extension/security/security.ts
// security policy selection for CSP (strict or disabled)

import * as vscode from 'vscode';
import { getConfigManager } from '../../app/services';
import { SETTINGS } from '../../shared/config/ConfigManager';
import { SecurityPolicy } from './SecurityPolicy';

export { SecurityPolicy } from './SecurityPolicy';

// select security policy via Quick Pick
const selectSecurityPolicy = async () => {
  const configManager = getConfigManager();
  const securityPolicy = configManager.get(SETTINGS.SECURITY);

  const pickItems = [
    {
      type: SecurityPolicy.Strict,
      label: 'strict',
      description: 'Do not allow insecure content or eval',
    },
    {
      type: SecurityPolicy.Disabled,
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
