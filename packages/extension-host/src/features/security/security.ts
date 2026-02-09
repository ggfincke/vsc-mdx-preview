// packages/extension/security/security.ts
// security policy selection for CSP (strict or disabled)

import * as vscode from 'vscode';
import { getConfigManager } from '../../app/services';

export const enum SecurityPolicy {
  Strict = 'strict',
  Disabled = 'disabled',
}

// select security policy via Quick Pick
const selectSecurityPolicy = async () => {
  const configManager = getConfigManager();
  const securityPolicy = configManager.get('preview.security');

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
    await configManager.set(
      'preview.security',
      selectedSecurityPolicyItem.type
    );
  }
};

export { selectSecurityPolicy };
