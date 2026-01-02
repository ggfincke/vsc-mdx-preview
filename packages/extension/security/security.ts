// packages/extension/security/security.ts
// security policy selection for CSP (strict or disabled)

import * as vscode from 'vscode';

export const enum SecurityPolicy {
  Strict = 'strict',
  Disabled = 'disabled',
}

// select security policy via Quick Pick
const selectSecurityPolicy = async () => {
  const extensionConfig = vscode.workspace.getConfiguration('mdx-preview');
  const securityPolicy = extensionConfig.get<SecurityPolicy>(
    'preview.security',
    SecurityPolicy.Strict
  );

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
    extensionConfig.update('preview.security', selectedSecurityPolicyItem.type);
  }
};

export { selectSecurityPolicy };
