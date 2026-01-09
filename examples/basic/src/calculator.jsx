// examples/basic/src/calculator.jsx
// Calculator component demonstrating React capabilities in MDX Preview

import React, { useState, useCallback } from 'react';

const BUTTONS = [
  ['C', '+/-', '%', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = useCallback((digit) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  }, [display, waitingForOperand]);

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  }, [display, waitingForOperand]);

  const clear = useCallback(() => {
    setDisplay('0');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  }, []);

  const toggleSign = useCallback(() => {
    setDisplay(String(-parseFloat(display)));
  }, [display]);

  const inputPercent = useCallback(() => {
    setDisplay(String(parseFloat(display) / 100));
  }, [display]);

  const performOperation = useCallback((nextOperator) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const currentValue = previousValue;
      let result;

      switch (operator) {
        case '+':
          result = currentValue + inputValue;
          break;
        case '-':
          result = currentValue - inputValue;
          break;
        case '*':
          result = currentValue * inputValue;
          break;
        case '/':
          result = inputValue !== 0 ? currentValue / inputValue : 'Error';
          break;
        default:
          result = inputValue;
      }

      setDisplay(String(result));
      setPreviousValue(result);
    }

    setWaitingForOperand(true);
    setOperator(nextOperator === '=' ? null : nextOperator);
    if (nextOperator === '=') {
      setPreviousValue(null);
    }
  }, [display, operator, previousValue]);

  const handleButton = useCallback((value) => {
    switch (value) {
      case 'C':
        clear();
        break;
      case '+/-':
        toggleSign();
        break;
      case '%':
        inputPercent();
        break;
      case '.':
        inputDecimal();
        break;
      case '+':
      case '-':
      case '*':
      case '/':
      case '=':
        performOperation(value);
        break;
      default:
        inputDigit(value);
    }
  }, [clear, toggleSign, inputPercent, inputDecimal, performOperation, inputDigit]);

  const isOperator = (value) => ['+', '-', '*', '/'].includes(value);
  const isActiveOperator = (value) => operator === value && waitingForOperand;

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        width: '100%',
        maxWidth: '500px',
        background: 'var(--vscode-editor-background, #fafafa)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid var(--vscode-widget-border, #e0e0e0)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        boxSizing: 'border-box',
      }}
    >
      {/* Display */}
      <div
        style={{
          background: 'var(--vscode-input-background, #fff)',
          border: '1px solid var(--vscode-input-border, #ddd)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            color: 'var(--vscode-editor-foreground, #333)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: display.length > 12 ? '20px' : display.length > 8 ? '28px' : '32px',
            fontWeight: 500,
            textAlign: 'right',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minHeight: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          {display}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {BUTTONS.map((row, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            {row.map((btn) => {
              const isOp = isOperator(btn);
              const isEquals = btn === '=';
              const isZero = btn === '0';
              const isTopRow = ['C', '+/-', '%'].includes(btn);
              const isActive = isActiveOperator(btn);

              let background;
              let color;
              let borderColor;

              if (isActive) {
                background = 'var(--vscode-button-background, #0066cc)';
                color = 'var(--vscode-button-foreground, #fff)';
                borderColor = 'transparent';
              } else if (isOp || isEquals) {
                background = 'var(--vscode-button-secondaryBackground, #e8e8e8)';
                color = 'var(--vscode-button-secondaryForeground, #333)';
                borderColor = 'var(--vscode-button-border, #ccc)';
              } else if (isTopRow) {
                background = 'var(--vscode-badge-background, #f0f0f0)';
                color = 'var(--vscode-badge-foreground, #555)';
                borderColor = 'var(--vscode-widget-border, #ddd)';
              } else {
                background = 'var(--vscode-input-background, #fff)';
                color = 'var(--vscode-input-foreground, #333)';
                borderColor = 'var(--vscode-input-border, #ddd)';
              }

              return (
                <button
                  key={btn}
                  onClick={() => handleButton(btn)}
                  style={{
                    flex: isZero ? 2.1 : 1,
                    height: '48px',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    background,
                    color,
                    fontSize: btn === '+/-' ? '14px' : '18px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(0.95)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'brightness(1)';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.97)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {btn}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
