import React, { useState } from 'react';

const WEEK_DATA = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 3 }, { label: 'Wed', value: 2 },
  { label: 'Thu', value: 5 }, { label: 'Fri', value: 4 }, { label: 'Sat', value: 1 }, { label: 'Sun', value: 2 },
];
const MONTH_DATA: Record<string, { label: string; value: number }[]> = {
  '3M': [{ label: 'Jan', value: 6 }, { label: 'Feb', value: 11 }, { label: 'Mar', value: 8 }],
  '12M': [
    { label: 'Apr', value: 4 }, { label: 'May', value: 7 }, { label: 'Jun', value: 12 },
    { label: 'Jul', value: 15 }, { label: 'Aug', value: 9 }, { label: 'Sep', value: 5 },
    { label: 'Oct', value: 3 }, { label: 'Nov', value: 6 }, { label: 'Dec', value: 8 },
    { label: 'Jan', value: 6 }, { label: 'Feb', value: 11 }, { label: 'Mar', value: 8 },
  ],
  YTD: [{ label: 'Jan', value: 6 }, { label: 'Feb', value: 11 }, { label: 'Mar', value: 8 }],
};

const PERIOD_LABELS: Record<string, string> = {
  Week: 'Issues reported Mon–Sun this week',
  '3M': 'Rolling last 3 months',
  '12M': 'Rolling last 12 months',
  YTD: 'January 1 – today',
};

export const CMIssuesTrendChart = () => {
  const [toggle, setToggle] = useState('Week');
  const data = toggle === 'Week' ? WEEK_DATA : MONTH_DATA[toggle];
  const max = Math.max(...data.map((d) => d.value));
  const avg = Math.round(data.reduce((s, d) => s + d.value, 0) / data.length);
  const latest = data[data.length - 1].value;
  const prev = data[data.length - 2]?.value;
  const arrow = prev ? (latest < prev ? '↓' : latest > prev ? '↑' : '→') : '→';

  const barColor = (v: number) =>
    v <= avg * 0.8
      ? 'hsl(var(--cm-success))'
      : v <= avg * 1.2
        ? 'hsl(var(--cm-warning))'
        : 'hsl(var(--cm-danger))';

  const summaryStats = [
    { label: toggle === 'Week' ? 'Latest Day' : 'Latest Month', value: `${latest} ${arrow}`, color: barColor(latest) },
    { label: 'Period Avg', value: avg, color: 'hsl(var(--cm-text))' },
    { label: 'Period Total', value: data.reduce((s, d) => s + d.value, 0), color: 'hsl(var(--cm-text))' },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 mb-4 border border-cm-border shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="text-sm font-extrabold text-cm-text">Issues Trend</div>
          <div className="text-[10px] text-cm-text-light mt-0.5 italic">{PERIOD_LABELS[toggle]}</div>
        </div>
        <div className="flex bg-cm-app-bg rounded-[10px] p-0.5 gap-0.5">
          {['Week', '3M', '12M', 'YTD'].map((t) => (
            <div
              key={t}
              onClick={() => setToggle(t)}
              className="px-2 py-1 rounded-lg cursor-pointer text-[10px] font-bold transition-colors"
              style={{
                background: toggle === t ? 'hsl(var(--cm-navy))' : 'transparent',
                color: toggle === t ? '#fff' : 'hsl(var(--cm-text-light))',
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex gap-2 mb-3">
        {summaryStats.map((s, i) => (
          <div key={i} className="flex-1 bg-cm-app-bg rounded-[10px] p-2">
            <div className="text-[10px] text-cm-text-light">{s.label}</div>
            <div className="text-[17px] font-black" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="relative pt-2">
        {/* Avg line */}
        <div
          className="absolute left-7 right-0 border-t-[1.5px] border-dashed border-cm-text-light z-[2]"
          style={{ top: `${8 + (1 - avg / (max + 2)) * 88}px` }}
        >
          <span className="absolute -left-7 -top-2 text-[9px] text-cm-text-light font-bold bg-white px-0.5">avg</span>
        </div>

        {/* Bars */}
        <div className="ml-7 flex items-end gap-1" style={{ height: 100 }}>
          {data.map((d, i) => {
            const isLast = i === data.length - 1;
            const bh = Math.max((d.value / (max + 2)) * 88, 4);
            const col = barColor(d.value);
            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                <div className="text-[9px] font-extrabold mb-0.5" style={{ color: col }}>{d.value}</div>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: bh,
                    background: isLast ? col : `${col}77`,
                    border: isLast ? `1.5px solid ${col}` : 'none',
                  }}
                />
                <div
                  className="mt-1"
                  style={{
                    fontSize: data.length > 6 ? 8 : 10,
                    color: isLast ? 'hsl(var(--cm-text))' : 'hsl(var(--cm-text-light))',
                    fontWeight: isLast ? 800 : 500,
                  }}
                >
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-3 justify-center">
        {[
          { label: 'Below avg', color: 'hsl(var(--cm-success))' },
          { label: 'Near avg', color: 'hsl(var(--cm-warning))' },
          { label: 'Above avg', color: 'hsl(var(--cm-danger))' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
            <span className="text-[9px] text-cm-text-light">{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-4 h-0 border-t border-dashed border-cm-text-light" />
          <span className="text-[9px] text-cm-text-light">avg</span>
        </div>
      </div>
    </div>
  );
};
