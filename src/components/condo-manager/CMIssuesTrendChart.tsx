import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PERIOD_LABELS: Record<string, string> = {
  Week: 'Issues reported Mon–Sun this week',
  '3M': 'Rolling last 3 months',
  '12M': 'Rolling last 12 months',
  YTD: 'January 1 – today',
};

interface Props {
  hoaIds: string[];
  period: string;
}

interface DataPoint {
  label: string;
  value: number;
}

export const CMPeriodToggle = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex bg-white/[0.1] rounded-[10px] p-0.5 gap-0.5">
    {['Week', '3M', '12M', 'YTD'].map((t) => (
      <div
        key={t}
        onClick={() => onChange(t)}
        className="px-2 py-1 rounded-lg cursor-pointer text-[10px] font-bold transition-colors"
        style={{
          background: value === t ? 'rgba(0,180,216,0.35)' : 'transparent',
          color: value === t ? '#fff' : 'rgba(255,255,255,0.6)',
        }}
      >
        {t}
      </div>
    ))}
  </div>
);

const getDayLabel = (d: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
const getMonthLabel = (d: Date) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];

export const CMIssuesTrendChart = ({ hoaIds, period }: Props) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hoaIds.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const now = new Date();
      let startDate: Date;

      if (period === 'Week') {
        const day = now.getDay();
        const diff = day === 0 ? 6 : day - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);
      } else if (period === '3M') {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        startDate.setDate(1);
      } else if (period === '12M') {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 11);
        startDate.setDate(1);
      } else {
        // YTD
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      const { data: reports, error } = await supabase
        .from('maintenance_reports')
        .select('created_at')
        .in('hoa_id', hoaIds)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Issues trend fetch error:', error);
        setData([]);
        setLoading(false);
        return;
      }

      const rows = reports || [];

      if (period === 'Week') {
        // Group by day of week Mon-Sun
        const buckets: DataPoint[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const dayStr = d.toISOString().slice(0, 10);
          const count = rows.filter((r) => r.created_at.slice(0, 10) === dayStr).length;
          const isToday = dayStr === now.toISOString().slice(0, 10);
          buckets.push({ label: isToday ? 'Today' : getDayLabel(d), value: count });
        }
        setData(buckets);
      } else {
        // Group by month
        const monthMap = new Map<string, number>();
        const monthLabels: string[] = [];

        const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        while (cursor <= endMonth) {
          const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
          monthMap.set(key, 0);
          monthLabels.push(key);
          cursor.setMonth(cursor.getMonth() + 1);
        }

        for (const r of rows) {
          const d = new Date(r.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (monthMap.has(key)) {
            monthMap.set(key, (monthMap.get(key) || 0) + 1);
          }
        }

        setData(
          monthLabels.map((key) => {
            const [y, m] = key.split('-');
            const d = new Date(parseInt(y), parseInt(m) - 1, 1);
            return { label: getMonthLabel(d), value: monthMap.get(key) || 0 };
          })
        );
      }

      setLoading(false);
    };

    fetchData();
  }, [hoaIds, period]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 mb-4 border border-cm-border shadow-sm">
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-cm-cyan/20 border-t-cm-cyan rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-4 mb-4 border border-cm-border shadow-sm">
        <div className="text-sm font-extrabold text-cm-text mb-1">Issues Trend</div>
        <div className="text-center py-6 text-cm-text-light text-xs">No data for this period</div>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const avg = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.value, 0) / data.length) : 0;
  const latest = data[data.length - 1].value;
  const prev = data.length > 1 ? data[data.length - 2].value : null;
  const arrow = prev !== null ? (latest < prev ? '↓' : latest > prev ? '↑' : '→') : '→';

  const barColor = (v: number) =>
    avg === 0
      ? 'hsl(var(--cm-success))'
      : v <= avg * 0.8
        ? 'hsl(var(--cm-success))'
        : v <= avg * 1.2
          ? 'hsl(var(--cm-warning))'
          : 'hsl(var(--cm-danger))';

  const summaryStats = [
    { label: period === 'Week' ? 'Latest Day' : 'Latest Month', value: `${latest} ${arrow}`, color: barColor(latest) },
    { label: 'Period Avg', value: avg, color: 'hsl(var(--cm-text))' },
    { label: 'Period Total', value: data.reduce((s, d) => s + d.value, 0), color: 'hsl(var(--cm-text))' },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 mb-4 border border-cm-border shadow-sm">
      {/* Header */}
      <div className="mb-3">
        <div className="text-sm font-extrabold text-cm-text">Issues Trend</div>
        <div className="text-[10px] text-cm-text-light mt-0.5 italic">{PERIOD_LABELS[period]}</div>
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
        {avg > 0 && (
          <div
            className="absolute left-7 right-0 border-t-[1.5px] border-dashed border-cm-text-light z-[2]"
            style={{ top: `${8 + (1 - avg / (max + 2)) * 88}px` }}
          >
            <span className="absolute -left-7 -top-2 text-[9px] text-cm-text-light font-bold bg-white px-0.5">avg</span>
          </div>
        )}

        {/* Bars */}
        <div className="ml-7 flex items-end gap-1" style={{ height: 100 }}>
          {data.map((d, i) => {
            const isLast = i === data.length - 1;
            const bh = d.value === 0 ? 0 : Math.max((d.value / (max + 2)) * 88, 4);
            const col = barColor(d.value);
            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                {d.value > 0 && <div className="text-[9px] font-extrabold mb-0.5" style={{ color: col }}>{d.value}</div>}
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
