import React from 'react';

interface CalloutProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  children: React.ReactNode;
}

export default function Callout({ type = 'info', children }: CalloutProps) {
  const colors = {
    info: { bg: '#e3f2fd', border: '#2196f3' },
    warning: { bg: '#fff3e0', border: '#ff9800' },
    error: { bg: '#ffebee', border: '#f44336' },
    success: { bg: '#e8f5e9', border: '#4caf50' },
  };

  const style = {
    padding: '1rem',
    borderLeft: `4px solid ${colors[type].border}`,
    backgroundColor: colors[type].bg,
    borderRadius: '4px',
    margin: '1rem 0',
  };

  return <div style={style}>{children}</div>;
}
