import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Bell } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMHealthBar } from '@/components/condo-manager/CMHealthBar';
import { CMStatusBadge } from '@/components/condo-manager/CMStatusBadge';
import CMNotificationCenter from '@/components/condo-manager/CMNotificationCenter';
import { useCondoManagerCommunities, useCondoManagerNotifications } from '@/hooks/useCondoManagerData';

const CMPortfolio = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const { communities, loading } = useCondoManagerCommunities();
  const { unreadCount } = useCondoManagerNotifications();

  const totalUnits = communities.reduce((s, c) => s + c.totalUnits, 0);
  const totalIssues = communities.reduce((s, c) => s + c.openIssues, 0);
  const totalBookings = communities.reduce((s, c) => s + c.todayBookings, 0);
  const totalPending = communities.reduce((s, c) => s + c.pendingApprovals, 0);
  const avgHealth = communities.length > 0 ? Math.round(communities.reduce((s, c) => s + c.health, 0) / communities.length) : 0;

  const firstName = currentUser?.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (showNotifs) {
    return <CMNotificationCenter onClose={() => setShowNotifs(false)} />;
  }

  const kpis = [
    { label: 'Total Units', value: totalUnits, icon: '🏠', period: 'all communities', alert: false },
    { label: 'Open Issues', value: totalIssues, icon: '🔧', period: 'right now', alert: totalIssues > 5 },
    { label: 'Bookings', value: totalBookings, icon: '📅', period: 'today', alert: false },
    { label: 'Pending', value: totalPending, icon: '⏳', period: 'awaiting review', alert: totalPending > 2 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-cm-app-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cm-cyan/20 border-t-cm-cyan rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cm-app-bg pb-24">
      <CMHeader>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[13px] opacity-75">{greeting},</div>
            <div className="text-[22px] font-extrabold mt-0.5">{firstName}</div>
            <div className="text-xs opacity-60 mt-1">Property Manager · {communities.length} Communities</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div
              onClick={() => setShowNotifs(true)}
              className="relative bg-white/[0.12] rounded-[10px] w-10 h-10 flex items-center justify-center cursor-pointer min-h-[44px]"
            >
              <Bell className="h-5 w-5 text-white" />
              {unreadCount > 0 && (
                <div className="absolute -top-1 -right-1 bg-cm-danger text-white rounded-full w-[18px] h-[18px] flex items-center justify-center text-[10px] font-extrabold">
                  {unreadCount}
                </div>
              )}
            </div>
            <div className="bg-[rgba(0,180,216,0.18)] border border-[rgba(0,180,216,0.4)] rounded-[14px] px-3 py-2 text-center">
              <div className="text-2xl font-black text-cm-cyan">{avgHealth}</div>
              <div className="text-[10px] opacity-80">Portfolio Health</div>
              <div className="text-[9px] opacity-55 italic">updated daily</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          {kpis.map((k, i) => (
            <div
              key={i}
              className="flex-1 rounded-xl py-2.5 px-1.5 text-center"
              style={{
                background: k.alert ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)',
                border: k.alert ? '1px solid rgba(245,158,11,0.45)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="text-sm">{k.icon}</div>
              <div className="text-lg font-extrabold leading-tight" style={{ color: k.alert ? 'hsl(var(--cm-warning))' : '#fff' }}>
                {k.value}
              </div>
              <div className="text-[9px] opacity-75 mt-0.5">{k.label}</div>
              <div className="text-[8px] opacity-50 italic">{k.period}</div>
            </div>
          ))}
        </div>
      </CMHeader>

      <div className="px-4 pt-4">
        <div className="text-xs font-bold text-cm-text-light mb-3 tracking-wider uppercase">My Communities</div>

        {communities.length === 0 && (
          <div className="text-center py-10 text-cm-text-light">
            No communities found. Add a community to get started.
          </div>
        )}

        {communities.map((c) => (
          <div
            key={c.id}
            onClick={() => navigate(`/cm/community/${c.id}`)}
            className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-cm-border cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="text-[17px] font-extrabold text-cm-text">{c.name}</div>
                <div className="text-xs text-cm-text-light mt-0.5">{c.totalUnits} units · {c.amenities.length} amenities</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <CMStatusBadge status={c.status} />
                <div className="text-xs text-cm-text-light font-semibold">{c.health}/100</div>
              </div>
            </div>

            <CMHealthBar value={c.health} status={c.status} />

            <div className="flex gap-2 mt-3">
              {[
                { label: 'Issues', value: c.openIssues, period: 'right now', alert: c.openIssues > 3 },
                { label: 'Bookings', value: c.todayBookings, period: 'today', alert: false },
                { label: 'Pending', value: c.pendingApprovals, period: 'awaiting', alert: c.pendingApprovals > 0 },
                { label: 'Members', value: `${c.activeMembers}/${c.totalUnits}`, period: 'last 30d', alert: false },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-[10px] py-2 px-1 text-center"
                  style={{
                    background: item.alert ? 'hsl(var(--cm-warning-bg))' : 'hsl(var(--cm-app-bg))',
                  }}
                >
                  <div
                    className="text-[13px] font-extrabold"
                    style={{ color: item.alert ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-text))' }}
                  >
                    {item.value}
                  </div>
                  <div className="text-[10px] text-cm-text-light mt-0.5">{item.label}</div>
                  <div className="text-[9px] text-cm-text-light italic">{item.period}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-cm-border flex justify-between">
              <div className="text-[11px] text-cm-text-light flex-1 pr-2 truncate">
                {c.openIssues > 0 ? `${c.openIssues} open issues` : 'All clear'}
              </div>
              <div className="text-[11px] text-cm-cyan font-bold">Manage →</div>
            </div>
          </div>
        ))}

        <div className="border-2 border-dashed border-cm-border rounded-2xl p-5 text-center cursor-pointer hover:border-cm-cyan transition-colors mb-3">
          <div className="text-2xl text-cm-cyan">＋</div>
          <div className="text-sm font-bold text-cm-text-mid mt-1">Add Community</div>
        </div>
      </div>
    </div>
  );
};

export default CMPortfolio;
