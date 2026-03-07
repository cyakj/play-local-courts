import React from 'react';

interface CMKpiCardProps {
  label: string;
  value: string | number;
  period?: string;
  sub?: string;
  subColor?: string;
  color?: string;
}

export const CMKpiCard = ({ label, value, period, sub, subColor, color }: CMKpiCardProps) => (
  <div className="bg-white rounded-[14px] p-3 flex-1 min-w-0 shadow-sm border border-cm-border">
    <div className="text-[22px] font-extrabold leading-none" style={{ color: color || 'hsl(var(--cm-text))' }}>
      {value}
    </div>
    <div className="text-[11px] text-cm-text-mid mt-1 font-semibold">{label}</div>
    {period && <div className="text-[10px] text-cm-text-light mt-0.5 italic">{period}</div>}
    {sub && (
      <div className="text-[10px] mt-1 font-bold" style={{ color: subColor || color || 'hsl(var(--cm-text-light))' }}>
        {sub}
      </div>
    )}
  </div>
);
