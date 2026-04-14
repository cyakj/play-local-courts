import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Menu, Wrench, CalendarDays, ChevronRight, Plus, TrendingUp } from 'lucide-react';
import CMNotificationCenter from '@/components/condo-manager/CMNotificationCenter';
import CMProfileSheet from '@/components/condo-manager/CMProfileSheet';
import { useCondoManagerCommunities, useCondoManagerNotifications, useCondoManagerAlerts } from '@/hooks/useCondoManagerData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CMStatusBadge } from '@/components/condo-manager/CMStatusBadge';
import AddCommunityModal from '@/components/condo-manager/AddCommunityModal';

const CMPortfolio = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddCommunity, setShowAddCommunity] = useState(false);
  const { communities, loading, refetch } = useCondoManagerCommunities();
  const { unreadCount } = useCondoManagerNotifications();
  const { alerts } = useCondoManagerAlerts(communities);
  const alertCount = alerts.length;

  const totalUnits = communities.reduce((s, c) => s + c.totalUnits, 0);
  const totalIssues = communities.reduce((s, c) => s + c.openIssues, 0);
  const totalBookings = communities.reduce((s, c) => s + c.todayBookings, 0);
  const totalPending = communities.reduce((s, c) => s + c.pendingApprovals, 0);
  const avgHealth = communities.length > 0 ? Math.round(communities.reduce((s, c) => s + c.health, 0) / communities.length) : 0;

  const firstName = currentUser?.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Find community needing most attention
  const needsAttention = communities.find(c => c.status === 'warning' || c.status === 'critical');

  if (showNotifs) {
    return <CMNotificationCenter onClose={() => setShowNotifs(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
            <span className="text-white text-xs font-black">TX</span>
          </div>
          <div>
            <div className="text-sm font-extrabold text-foreground tracking-tight">TenisX</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Portfolio Management</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            onClick={() => setShowNotifs(true)}
            className="relative w-10 h-10 flex items-center justify-center cursor-pointer"
          >
            <Bell className="h-5 w-5 text-foreground" />
            {alertCount > 0 && (
              <div className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                {alertCount}
              </div>
            )}
          </div>
          <div
            onClick={() => navigate('/cm/settings')}
            className="w-10 h-10 flex items-center justify-center cursor-pointer"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="px-5 pt-4 pb-6">
        <div className="text-[11px] text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-1">Welcome back</div>
        <h1 className="text-[32px] font-black text-foreground leading-[1.1] tracking-tight">
          {greeting},<br />{firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Your architectural portfolio is currently being monitored for performance and occupancy efficiency.
        </p>
      </div>

      {/* Portfolio Health Card */}
      <div className="mx-5 mb-6 border border-border rounded-2xl p-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-semibold mb-2">Portfolio Health</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[40px] font-black text-foreground leading-none">{avgHealth}</span>
              <span className="text-lg text-muted-foreground font-medium">/100</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl border border-border flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${avgHealth}%`,
              backgroundColor: avgHealth >= 80 ? 'hsl(var(--cm-success))' : avgHealth >= 50 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-danger))',
            }}
          />
        </div>
        {needsAttention && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-xs text-amber-600 font-medium">Needs attention at {needsAttention.name}</span>
          </div>
        )}
      </div>

      {/* Stats Grid 2x2 */}
      <div className="mx-5 mb-8">
        <div className="grid grid-cols-2">
          {[
            { icon: '🏠', value: totalUnits, label: 'Total Units' },
            { icon: '⚠️', value: totalIssues, label: 'Open Issues' },
            { icon: '📅', value: totalBookings, label: 'Bookings' },
            { icon: '⏳', value: totalPending, label: 'Pending' },
          ].map((stat, i) => (
            <div
              key={i}
              className="py-5 px-4"
              style={{
                borderBottom: i < 2 ? '1px solid hsl(var(--border))' : 'none',
                borderRight: i % 2 === 0 ? '1px solid hsl(var(--border))' : 'none',
              }}
            >
              <div className="text-base mb-1">{stat.icon}</div>
              <div className="text-[28px] font-black text-foreground leading-none">{stat.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1.5 uppercase tracking-wide font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My Communities */}
      <div className="px-5">
        <div className="flex justify-between items-baseline mb-4">
          <h2 className="text-xl font-black text-foreground">My Communities</h2>
        </div>

        {communities.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No communities found. Add one to get started.
          </div>
        )}

        {communities.map((c) => {
          const isWarning = c.status === 'warning' || c.status === 'critical';
          const barColor = isWarning ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))';

          return (
            <div
              key={c.id}
              onClick={() => navigate(`/cm/community/${c.id}`)}
              className="border-b border-border pb-5 mb-5 cursor-pointer last:border-b-0"
            >
              {/* Name + Badge */}
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-extrabold text-foreground">{c.name}</h3>
                <CMStatusBadge status={c.status} />
              </div>

              {/* Health Score */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Health Score</span>
                <span className="text-sm font-extrabold text-foreground">{c.health}/100</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${c.health}%`, backgroundColor: barColor }}
                />
              </div>

              {/* Mini stats 2x2 */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[
                  { label: 'Units', value: c.totalUnits },
                  { label: 'Amenities', value: c.amenities.length },
                  { label: 'Members', value: c.activeMembers },
                  { label: 'Alerts', value: c.openIssues + c.pendingApprovals },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{item.label}</div>
                    <div className="text-lg font-extrabold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          );
        })}

        {/* Add Community */}
        <div
          onClick={() => setShowAddCommunity(true)}
          className="flex flex-col items-center py-8 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center mb-2 hover:border-emerald-500 transition-colors">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Add Community</span>
        </div>
      </div>

      {showAddCommunity && (
        <AddCommunityModal
          communities={communities}
          currentUserId={currentUser?.id}
          onClose={() => setShowAddCommunity(false)}
          onCreated={refetch}
        />
      )}

      <CMProfileSheet
        open={showProfile}
        onOpenChange={setShowProfile}
        communities={communities}
      />
    </div>
  );
};

export default CMPortfolio;
