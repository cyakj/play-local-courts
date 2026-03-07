import React from 'react';

const STATUS_COLORS: Record<string, string> = {
  excellent: 'hsl(var(--cm-success))',
  good: 'hsl(var(--cm-cyan))',
  warning: 'hsl(var(--cm-warning))',
  critical: 'hsl(var(--cm-danger))',
};

interface CMHealthBarProps {
  value: number;
  status: string;
}

export const CMHealthBar = ({ value, status }: CMHealthBarProps) => (
  <div className="w-full bg-cm-border rounded-full h-1.5 overflow-hidden">
    <div
      className="h-full rounded-full transition-all"
      style={{ width: `${value}%`, background: STATUS_COLORS[status] || 'hsl(var(--cm-cyan))' }}
    />
  </div>
);
