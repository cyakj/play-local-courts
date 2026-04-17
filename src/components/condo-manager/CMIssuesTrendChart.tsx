import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PERIOD_LABELS: Record<string, string> = {
  Week: 'Issues reported Mon–Sun this week',
  '3M': 'Rolling last 3 months',
  '12M': 'Rolling last 12 months',
  YTD: 'Rolling last 12 months',
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
          background: value === t ? 'rgba(5,150,105,0.35)' : 'transparent',
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

// 0 = Resolved (gray), above avg = Critical (red), otherwise = Moderate (coral)
const barColor = (v: number, avg: number) => {
  if (v === 0) return '#E5E7EB';
  if (v > avg * 1.2) return '#EF4444';
  return '#F97066';
};

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
        // YTD: full 12 months back from today
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12);
        startDate.setDate(1);
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
          if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1);
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
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-emerald-100 border-t-[#059669] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <div className="text-[18px] font-bold mb-1" style={{ color: '#064E3B', fontFamily: 'Manrope, sans-serif' }}>Issues Trend</div>
        <div className="text-center py-6 text-sm" style={{ color: '#4B5563' }}>No data for this period</div>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const avg = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.value, 0) / data.length) : 0;
  const latest = data[data.length - 1].value;
  const prev = data.length > 1 ? data[data.length - 2].value : null;
  const arrow = prev !== null ? (latest < prev ? '↓' : latest > prev ? '↑' : '→') : '→';
  const total = data.reduce((s, d) => s + d.value, 0);

  const summaryStats = [
    { label: period === 'Week' ? 'Latest Day' : 'Latest Month', value: `${latest}`, suffix: arrow, color: barColor(latest, avg) },
    { label: 'Period Avg', value: `${avg}`, color: '#064E3B' },
    { label: 'Period Total', value: `${total}`, color: '#064E3B' },
  ];

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <div className="text-[18px] font-bold" style={{ color: '#064E3B', fontFamily: 'Manrope, sans-serif' }}>
          Issues Trend
        </div>
        <div className="text-[13px] mt-0.5" style={{ color: '#4B5563' }}>
          {PERIOD_LABELS[period]}
        </div>
      </div>

      {/* Summary stat boxes */}
      <div className="flex gap-2 mb-4">
        {summaryStats.map((s, i) => (
          <div key={i} className="flex-1 rounded-lg p-2.5" style={{ backgroundColor: '#F9FAFB' }}>
            <div className="text-[11px] font-medium mb-1" style={{ color: '#4B5563' }}>{s.label}</div>
            <div className="text-[17px] font-bold leading-none" style={{ color: s.color, fontFamily: 'Manrope, sans-serif' }}>
              {s.value}
              {s.suffix && <span className="text-sm ml-0.5">{s.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="relative pt-2">
        {avg > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed z-[2]"
            style={{ borderColor: '#9CA3AF', top: `${8 + (1 - avg / (max + 2)) * 88}px` }}
          >
            <span
              className="absolute right-0 bg-white pl-1"
              style={{ fontSize: 12, fontWeight: 600, color: '#4B5563', top: -10 }}
            >
              avg
            </span>
          </div>
        )}

        <div className="flex items-end gap-1" style={{ height: 100 }}>
          {data.map((d, i) => {
            const isLast = i === data.length - 1;
            const bh = d.value === 0 ? 0 : Math.max((d.value / (max + 2)) * 88, 4);
            const col = barColor(d.value, avg);
            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end">
                {d.value > 0 && (
                  <div
                    className="mb-0.5"
                    style={{ fontSize: 12, fontWeight: 600, color: '#064E3B' }}
                  >
                    {d.value}
                  </div>
                )}
                <div
                  className="w-full rounded-t"
                  style={{
                    height: bh,
                    backgroundColor: isLast && col === '#E5E7EB' ? '#D1D5DB' : col,
                    opacity: isLast ? 1 : 0.75,
                  }}
                />
                <div
                  className="mt-1 text-center"
                  style={{
                    fontSize: data.length > 6 ? 8 : 10,
                    color: isLast ? '#064E3B' : '#6B7280',
                    fontWeight: isLast ? 700 : 500,
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
      <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100">
        {[
          { label: 'Critical', color: '#EF4444' },
          { label: 'Moderate', color: '#F97066' },
          { label: 'Resolved', color: '#E5E7EB' },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full block" style={{ backgroundColor: l.color }} />
            <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#4B5563' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
