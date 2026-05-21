import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMChips } from '@/components/condo-manager/CMChips';
import { useCondoManagerCommunities, useCondoManagerAlerts } from '@/hooks/useCondoManagerData';
import { UserCheck, Wrench, CalendarDays, TrendingUp, Bell } from 'lucide-react';

const ALERT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  approval: { icon: UserCheck, color: '#00D4FF' },
  issue:    { icon: Wrench,     color: '#EF4444' },
  booking:  { icon: CalendarDays, color: '#8892A4' },
  health:   { icon: TrendingUp, color: '#F97066' },
};

const CMAlerts = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const { communities } = useCondoManagerCommunities();
  const { alerts, loading } = useCondoManagerAlerts(communities);

  const filtered = alerts.filter(
    (a) =>
      filter === 'All' ||
      (filter === 'Urgent' && a.urgent) ||
      (filter === 'Approvals' && a.type === 'approval') ||
      (filter === 'Issues' && a.type === 'issue') ||
      (filter === 'Bookings' && a.type === 'booking')
  );

  const urgentCount = alerts.filter((a) => a.urgent).length;

  const handleTakeAction = (alert: any) => {
    if (alert.type === 'approval') {
      navigate(`/cm/community/${alert.communityId}?tab=members`);
    } else if (alert.type === 'issue') {
      navigate(alert.reportId ? '/cm/reports?reportId=' + alert.reportId : '/cm/reports');
    } else if (alert.type === 'health') {
      navigate(`/cm/community/${alert.communityId}`);
    }
  };

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex justify-between">
          <div>
            <div className="text-xl font-extrabold">Alerts</div>
            <div className="text-xs opacity-65">Pending actions</div>
          </div>
          <div className="rounded-full px-3.5 py-1.5 text-[13px] font-extrabold" style={{ backgroundColor: urgentCount > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.12)' }}>
            {urgentCount} Urgent
          </div>
        </div>
      </CMHeader>

      <div className="bg-white border-b border-cm-border px-4 py-2.5 flex-shrink-0">
        <CMChips options={['All', 'Urgent', 'Approvals', 'Issues', 'Bookings']} value={filter} onChange={setFilter} light />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }} />
          </div>
        ) : (
          <>
            {filtered.map((a, i) => {
              const cfg = ALERT_CONFIG[a.type] || { icon: Bell, color: '#8892A4' };
              const Icon = cfg.icon;
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-4 mb-3 border"
                  style={{ borderColor: a.urgent ? `${cfg.color}44` : 'rgba(15,31,61,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                >
                  <div className="flex gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${cfg.color}18` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="text-[11px] font-bold uppercase" style={{ color: '#00D4FF', letterSpacing: '0.08em' }}>{a.community}</div>
                        <div className="text-[10px]" style={{ color: '#8892A4' }}>{a.time}</div>
                      </div>
                      <div className="text-[13px] font-semibold mt-1" style={{ color: '#0F1F3D' }}>{a.text}</div>
                      {(a.urgent || a.type === 'issue') && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleTakeAction(a)}
                            className="flex-1 rounded-xl py-2 text-[12px] font-bold text-white text-center cursor-pointer min-h-[44px]"
                            style={{ backgroundColor: '#0F1F3D' }}
                          >
                            Take Action
                          </button>
                          <button className="flex-1 rounded-xl py-2 text-[12px] font-bold text-center cursor-pointer min-h-[44px] border"
                            style={{ backgroundColor: '#F9FAFB', color: '#8892A4', borderColor: 'rgba(15,31,61,0.08)' }}>
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-10" style={{ color: '#8892A4' }}>No alerts — everything looks good!</div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CMAlerts;
