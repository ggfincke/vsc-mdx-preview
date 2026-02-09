// packages/extension/eslint-rules/prefer-tagged-logger.js
// detect manual LogTags interpolation in log calls & suggest createTaggedLogger

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

function isLogCall(callee) {
  if (!callee) {
    return false;
  }
  if (callee.type === 'Identifier') {
    return LOG_FN_NAMES.has(callee.name);
  }
  return false;
}

function isLogTagsMember(expr) {
  return (
    expr &&
    expr.type === 'MemberExpression' &&
    expr.object &&
    expr.object.type === 'Identifier' &&
    expr.object.name === 'LogTags'
  );
}

function getLogTagName(expr) {
  if (
    isLogTagsMember(expr) &&
    expr.property &&
    expr.property.type === 'Identifier'
  ) {
    return expr.property.name;
  }
  return null;
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer createTaggedLogger over manual tag interpolation in log calls',
      recommended: true,
    },
    messages: {
      preferTaggedLogger:
        'Use createTaggedLogger(LogTags.{{tag}}) instead of manual tag interpolation in {{fn}}() calls.',
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
        if (!firstArg || firstArg.type !== 'TemplateLiteral') {
          return;
        }

        // check if template literal contains LogTags member expression
        for (const expr of firstArg.expressions) {
          const tagName = getLogTagName(expr);
          if (tagName) {
            context.report({
              node: firstArg,
              messageId: 'preferTaggedLogger',
              data: {
                tag: tagName,
                fn: node.callee.name,
              },
            });
            return;
          }
        }
      },
    };
  },
};
