import React from 'react';

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  excellent: { color: 'hsl(var(--cm-success))', bg: 'hsl(var(--cm-success-bg))', label: 'Excellent' },
  good: { color: 'hsl(var(--cm-cyan))', bg: 'hsl(var(--cm-cyan-light))', label: 'Good' },
  warning: { color: 'hsl(var(--cm-warning))', bg: 'hsl(var(--cm-warning-bg))', label: 'Needs Attention' },
  critical: { color: 'hsl(var(--cm-danger))', bg: 'hsl(var(--cm-danger-bg))', label: 'Critical' },
};

export const CMStatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_CFG[status] || STATUS_CFG.good;
  return (
    <span
      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
};

export const CMPriorityBadge = ({ priority }: { priority: string }) => {
  const cfg: Record<string, { color: string; bg: string }> = {
    Urgent: { color: 'hsl(var(--cm-danger))', bg: 'hsl(var(--cm-danger-bg))' },
    High: { color: 'hsl(var(--cm-warning))', bg: 'hsl(var(--cm-warning-bg))' },
    Medium: { color: '#1D4ED8', bg: '#EFF6FF' },
    Low: { color: 'hsl(var(--cm-text-light))', bg: 'hsl(var(--cm-app-bg))' },
  };
  const p = cfg[priority] || { color: 'hsl(var(--cm-text-light))', bg: 'hsl(var(--cm-app-bg))' };
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: p.bg, color: p.color }}>
      {priority}
    </span>
  );
};

export const CMStatusPill = ({ status }: { status: string }) => {
  const cfg: Record<string, { color: string; bg: string }> = {
    Open: { color: 'hsl(var(--cm-danger))', bg: 'hsl(var(--cm-danger-bg))' },
    'In Progress': { color: 'hsl(var(--cm-warning))', bg: 'hsl(var(--cm-warning-bg))' },
    Resolved: { color: 'hsl(var(--cm-success))', bg: 'hsl(var(--cm-success-bg))' },
    Assigned: { color: '#1D4ED8', bg: '#EFF6FF' },
  };
  const s = cfg[status] || { color: 'hsl(var(--cm-text-light))', bg: 'hsl(var(--cm-app-bg))' };
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
      {status}
    </span>
  );
};
