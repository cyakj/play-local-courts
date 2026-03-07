import React from 'react';

interface CMChipsProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  light?: boolean;
}

export const CMChips = ({ options, value, onChange, light }: CMChipsProps) => (
  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
    {options.map((opt) => (
      <div
        key={opt}
        onClick={() => onChange(opt)}
        className="cursor-pointer whitespace-nowrap flex-shrink-0 text-xs font-bold rounded-full px-3.5 py-1.5 transition-colors"
        style={
          light
            ? {
                background: value === opt ? 'hsl(var(--cm-navy))' : 'white',
                color: value === opt ? '#fff' : 'hsl(var(--cm-text-light))',
                border: `1px solid ${value === opt ? 'hsl(var(--cm-navy))' : 'hsl(var(--cm-border))'}`,
              }
            : {
                background: value === opt ? 'rgba(0,180,216,0.25)' : 'rgba(255,255,255,0.1)',
                color: value === opt ? '#fff' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${value === opt ? 'rgba(0,180,216,0.6)' : 'rgba(255,255,255,0.15)'}`,
              }
        }
      >
        {opt}
      </div>
    ))}
  </div>
);
