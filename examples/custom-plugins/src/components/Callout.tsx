// examples/custom-plugins/src/components/Callout.tsx
// Custom Callout component for MDX preview demo

import React from 'react';

interface CalloutProps {
  type?: 'info' | 'warning' | 'error' | 'success';
  children: React.ReactNode;
}

export default function Callout({ type = 'info', children }: CalloutProps) {
  const colors = {
    info: { bg: '#e3f2fd', border: '#2196f3', text: '#0d47a1' },
    warning: { bg: '#ffebee', border: '#ef5350', text: '#c62828' },
    error: { bg: '#fce4ec', border: '#d32f2f', text: '#b71c1c' },
    success: { bg: '#e8f5e9', border: '#4caf50', text: '#1b5e20' },
  };

  const style: React.CSSProperties = {
    padding: '0.75rem 1rem',
    borderLeft: `4px solid ${colors[type].border}`,
    backgroundColor: colors[type].bg,
    borderRadius: '4px',
    margin: '1rem 0',
    color: colors[type].text,
    fontWeight: 500,
  };

  return (
    <div style={style} className="callout-content">
      <style>{`.callout-content p { margin: 0; }`}</style>
      {children}
    </div>
  );
}
