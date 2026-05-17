import React from 'react';

interface CMChipsProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  light?: boolean;
}

export const CMChips = ({ options, value, onChange, light }: CMChipsProps) => (
  <div
    className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
    style={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' } as React.CSSProperties}
  >
    {options.map((opt) => (
      <div
        key={opt}
        onClick={() => onChange(opt)}
        className="cursor-pointer whitespace-nowrap flex-shrink-0 rounded-full px-3.5 py-1.5 transition-colors"
        style={
          light
            ? {
                fontSize: 14,
                fontWeight: 600,
                background: value === opt ? '#0F1F3D' : '#F9FAFB',
                color: value === opt ? '#FFFFFF' : '#4B5563',
                border: `1px solid ${value === opt ? '#0F1F3D' : '#E5E7EB'}`,
                scrollSnapAlign: 'start',
              }
            : {
                fontSize: 14,
                fontWeight: 600,
                background: value === opt ? 'rgba(0,180,216,0.25)' : 'rgba(255,255,255,0.1)',
                color: value === opt ? '#fff' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${value === opt ? 'rgba(0,180,216,0.6)' : 'rgba(255,255,255,0.15)'}`,
                scrollSnapAlign: 'start',
              }
        }
      >
        {opt}
      </div>
    ))}
  </div>
);
