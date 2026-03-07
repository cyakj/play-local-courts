import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { MOCK_NOTIFICATIONS, NOTIF_ICON, NOTIF_COLOR } from '@/components/condo-manager/mockData';

interface CMNotificationCenterProps {
  onClose: () => void;
}

const CMNotificationCenter = ({ onClose }: CMNotificationCenterProps) => {
  const [filter, setFilter] = useState('All');
  const unread = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  const filtered = MOCK_NOTIFICATIONS.filter(
    (n) =>
      filter === 'All' ||
      (!n.read && filter === 'Unread') ||
      (n.type === 'issue' && filter === 'Reports') ||
      (n.type === 'approval' && filter === 'Members') ||
      (n.type === 'booking' && filter === 'Bookings')
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cm-app-bg">
      <CMHeader compact>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div
              onClick={onClose}
              className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xl font-extrabold">Notifications</div>
              <div className="text-xs opacity-65">{unread} unread</div>
            </div>
          </div>
          <div className="text-xs text-cm-cyan font-bold cursor-pointer">Mark all read</div>
        </div>
      </CMHeader>

      <div className="bg-white border-b border-cm-border px-4 py-2.5 flex-shrink-0">
        <CMChips
          options={['All', 'Unread', 'Reports', 'Members', 'Bookings']}
          value={filter}
          onChange={setFilter}
          light
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-5">
        {filtered.map((n, i) => {
          const color = NOTIF_COLOR[n.type] || '#9CA3AF';
          const icon = NOTIF_ICON[n.type] || '📋';
          return (
            <div
              key={i}
              className="bg-white rounded-[14px] p-3.5 mb-2.5"
              style={{ border: `1px solid ${n.read ? 'hsl(var(--cm-border))' : `${color}44`}` }}
            >
              <div className="flex gap-2.5">
                <div
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: `${color}18` }}
                >
                  {icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <div
                      className="text-[13px] flex-1 pr-2"
                      style={{ fontWeight: n.read ? 600 : 800, color: 'hsl(var(--cm-text))' }}
                    >
                      {n.title}
                    </div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-cm-cyan mt-1" />}
                  </div>
                  <div className="text-[11px] text-cm-cyan font-semibold mt-0.5">{n.community}</div>
                  <div className="text-xs text-cm-text-mid mt-1">{n.body}</div>
                  <div className="text-[11px] text-cm-text-light mt-1">{n.time}</div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="text-center mt-2">
          <div className="text-xs text-cm-cyan font-bold cursor-pointer">⚙ Manage Notification Preferences</div>
        </div>
      </div>
    </div>
  );
};

export default CMNotificationCenter;
