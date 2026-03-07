import React, { useState } from 'react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { MOCK_ALERTS, ALERT_ICON, ALERT_COLOR } from '@/components/condo-manager/mockData';

const CMAlerts = () => {
  const [filter, setFilter] = useState('All');

  const filtered = MOCK_ALERTS.filter(
    (a) =>
      filter === 'All' ||
      (filter === 'Urgent' && a.urgent) ||
      (filter === 'Approvals' && a.type === 'approval') ||
      (filter === 'Issues' && a.type === 'issue') ||
      (filter === 'Bookings' && a.type === 'booking')
  );

  const urgentCount = MOCK_ALERTS.filter((a) => a.urgent).length;

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex justify-between">
          <div>
            <div className="text-xl font-extrabold">Alerts</div>
            <div className="text-xs opacity-65">Pending actions</div>
          </div>
          <div className="bg-cm-danger rounded-full px-3.5 py-1.5 text-[13px] font-extrabold">
            {urgentCount} Urgent
          </div>
        </div>
      </CMHeader>

      <div className="bg-white border-b border-cm-border px-4 py-2.5 flex-shrink-0">
        <CMChips options={['All', 'Urgent', 'Approvals', 'Issues', 'Bookings']} value={filter} onChange={setFilter} light />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {filtered.map((a, i) => {
          const color = ALERT_COLOR[a.type] || '#9CA3AF';
          const icon = ALERT_ICON[a.type] || '📋';
          return (
            <div
              key={i}
              className="bg-white rounded-[14px] p-3.5 mb-2.5 border"
              style={{ borderColor: a.urgent ? `${color}44` : 'hsl(var(--cm-border))' }}
            >
              <div className="flex gap-3">
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `${color}18` }}
                >
                  {icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <div className="text-[11px] text-cm-cyan font-bold">{a.community}</div>
                    <div className="text-[10px] text-cm-text-light">{a.time}</div>
                  </div>
                  <div className="text-[13px] font-semibold text-cm-text mt-1">{a.text}</div>
                  {a.urgent && (
                    <div className="mt-2 flex gap-2">
                      <div className="flex-1 bg-cm-navy text-white rounded-lg py-1.5 px-3 text-[11px] font-bold text-center cursor-pointer min-h-[44px] flex items-center justify-center">
                        Take Action
                      </div>
                      <div className="flex-1 bg-cm-app-bg text-cm-text-mid rounded-lg py-1.5 px-3 text-[11px] font-bold text-center cursor-pointer border border-cm-border min-h-[44px] flex items-center justify-center">
                        Dismiss
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CMAlerts;
