// packages/extension/eslint-rules/no-raw-log-tag.js
// disallow raw log tag literals in log calls & logTag configs

const LOG_FN_NAMES = new Set([
  'debug',
  'info',
  'warn',
  'error',
  'log',
  'logDebug',
  'logInfo',
  'logWarn',
  'logError',
]);

const RAW_TAG_RE = /^\[[A-Za-z][A-Za-z0-9-]*(?:\/[A-Za-z0-9-]+)*\]/;

function isLogTagsMember(expr) {
  return (
    expr &&
    expr.type === 'MemberExpression' &&
    expr.object &&
    expr.object.type === 'Identifier' &&
    expr.object.name === 'LogTags'
  );
}

function isLogTagRef(expr) {
  if (!expr) {
    return false;
  }
  if (expr.type === 'Identifier') {
    return expr.name === 'logTag';
  }
  if (expr.type === 'MemberExpression' && expr.property) {
    return (
      expr.property.type === 'Identifier' && expr.property.name === 'logTag'
    );
  }
  return false;
}

function isLogCall(callee) {
  if (!callee) {
    return false;
  }
  if (callee.type === 'Identifier') {
    return LOG_FN_NAMES.has(callee.name);
  }
  if (callee.type === 'MemberExpression' && callee.property) {
    if (callee.property.type === 'Identifier') {
      return LOG_FN_NAMES.has(callee.property.name);
    }
  }
  return false;
}

function isRawTagLiteral(node) {
  if (!node) {
    return false;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return RAW_TAG_RE.test(node.value);
  }
  if (node.type === 'TemplateLiteral' && node.quasis?.length) {
    const rawStart = node.quasis[0].value.raw;
    if (!rawStart.startsWith('[')) {
      return false;
    }
    return !node.expressions.some(
      (expr) => isLogTagsMember(expr) || isLogTagRef(expr)
    );
  }
  return false;
}

function getPropertyName(node) {
  if (!node) {
    return null;
  }
  if (node.type === 'Identifier') {
    return node.name;
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow raw log tag literals in log calls',
      recommended: true,
    },
    messages: {
      noRawLogTag:
        'Raw log tag literal detected. Use LogTags or createTaggedLogger for log prefixes.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isLogCall(node.callee)) {
          return;
        }
        const firstArg = node.arguments[0];
        if (isRawTagLiteral(firstArg)) {
          context.report({
            node: firstArg,
            messageId: 'noRawLogTag',
          });
        }
      },
      Property(node) {
        const keyName = getPropertyName(node.key);
        if (keyName !== 'logTag') {
          return;
        }
        if (isRawTagLiteral(node.value)) {
          context.report({
            node: node.value,
            messageId: 'noRawLogTag',
          });
        }
      },
    };
  },
};
