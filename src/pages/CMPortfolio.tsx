import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Bell, Menu, TrendingUp, Plus, Building2, AlertTriangle, Calendar, Clock } from 'lucide-react';
import CMNotificationCenter from '@/components/condo-manager/CMNotificationCenter';
import CMProfileSheet from '@/components/condo-manager/CMProfileSheet';
import { useCondoManagerCommunities, useCondoManagerNotifications, useCondoManagerAlerts } from '@/hooks/useCondoManagerData';
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

  const needsAttention = communities.find(c => c.status === 'warning' || c.status === 'critical');

  const getHealthColor = (score: number) => {
    if (score >= 70) return '#00D4FF';
    if (score >= 40) return '#F97066';
    return '#EF4444';
  };

  const getStatusPill = (score: number) => {
    if (score >= 70) return { label: 'Optimal', bg: '#E0F9FF', text: '#0369A1', border: '#00D4FF' };
    if (score >= 40) return { label: 'Needs Attention', bg: '#FFF5F5', text: '#C0392B', border: '#F97066' };
    return { label: 'Critical', bg: '#FEF2F2', text: '#991B1B', border: '#EF4444' };
  };

  if (showNotifs) {
    return <CMNotificationCenter onClose={() => setShowNotifs(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-cyan-100 border-t-[#00D4FF] rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { icon: <Building2 className="h-5 w-5" />, value: totalUnits, label: 'Total Units' },
    { icon: <AlertTriangle className="h-5 w-5" />, value: totalIssues, label: 'Open Issues' },
    { icon: <Calendar className="h-5 w-5" />, value: totalBookings, label: "Today's Bookings" },
    { icon: <Clock className="h-5 w-5" />, value: totalPending, label: 'Pending' },
  ];

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">

      {/* Header */}
      <div style={{ backgroundColor: '#0F1F3D' }} className="px-5 pt-12 pb-8 relative overflow-visible">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <img
            src="/images/TenisX_logo-removebg-preview.png"
            style={{ height: '88px', width: 'auto', maxWidth: '220px', display: 'block' }}
            alt="TenisX"
          />
          <div className="flex items-center gap-3">
            <div
              onClick={() => setShowNotifs(true)}
              className="relative w-10 h-10 flex items-center justify-center cursor-pointer"
            >
              <Bell className="h-5 w-5 text-white" />
              {alertCount > 0 && (
                <div className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  {alertCount}
                </div>
              )}
            </div>
            <div
              onClick={() => navigate('/cm/settings')}
              className="w-10 h-10 flex items-center justify-center cursor-pointer"
            >
              <Menu className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {/* Greeting */}
        <div className="text-[13px] uppercase font-semibold mb-1" style={{ color: '#00D4FF', letterSpacing: '0.15em' }}>
          Welcome back
        </div>
        <h1 className="text-[32px] font-black text-white leading-[1.1] tracking-tight">
          {greeting},<br />{firstName}
        </h1>
        <p className="text-cyan-200 mt-3 leading-relaxed" style={{ fontSize: '15px', opacity: 0.9 }}>
          Your portfolio is currently being monitored for performance and occupancy efficiency.
        </p>

        {/* Bottom fade */}
        <div
          className="absolute -bottom-6 left-0 right-0 h-8 pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, #0F1F3D, transparent)' }}
        />
      </div>

      {/* Page content */}
      <div className="px-5 pt-8 space-y-4">

        {/* Stats — 2×2 white card grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((stat, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 border border-gray-100 h-28 flex flex-col justify-between"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <div style={{ color: '#00D4FF' }}>{stat.icon}</div>
              <div>
                <div
                  className="font-bold text-2xl leading-none"
                  style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-[11px] uppercase font-semibold mt-1"
                  style={{ color: '#4B5563', letterSpacing: '0.08em' }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Portfolio Health Card */}
        <div
          className="bg-white rounded-2xl p-5 border border-gray-100"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <div
                className="text-[11px] uppercase font-semibold mb-2"
                style={{ color: '#4B5563', letterSpacing: '0.08em' }}
              >
                Portfolio Health
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className="text-[40px] font-black leading-none"
                  style={{ color: getHealthColor(avgHealth), fontFamily: 'Manrope, sans-serif' }}
                >
                  {avgHealth}
                </span>
                <span className="text-lg font-medium" style={{ color: '#4B5563' }}>/100</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" style={{ color: '#9CA3AF' }} />
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1 mb-3">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${avgHealth}%`, backgroundColor: getHealthColor(avgHealth) }}
            />
          </div>
          {needsAttention && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F97066' }} />
              <span className="text-[13px] font-medium" style={{ color: '#4B5563' }}>
                Needs attention at {needsAttention.name}
              </span>
            </div>
          )}
        </div>

        {/* My Communities */}
        <div>
          <h2
            className="text-[18px] font-bold mb-4"
            style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}
          >
            My Communities
          </h2>

          {communities.length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: '#4B5563' }}>
              No communities found. Add one to get started.
            </div>
          )}

          {communities.map((c) => {
            const pill = getStatusPill(c.health);
            const healthColor = getHealthColor(c.health);

            return (
              <div
                key={c.id}
                onClick={() => navigate(`/cm/community/${c.id}`)}
                className="bg-white rounded-2xl mb-3 p-5 cursor-pointer border border-gray-100"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                {/* Name + Status pill */}
                <div className="flex justify-between items-center mb-3">
                  <h3
                    className="text-[18px] font-extrabold"
                    style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}
                  >
                    {c.name}
                  </h3>
                  <span
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ml-2"
                    style={{
                      backgroundColor: pill.bg,
                      color: pill.text,
                      border: `1px solid ${pill.border}`,
                    }}
                  >
                    {pill.label}
                  </span>
                </div>

                {/* Health Score */}
                <div className="flex justify-between items-center mb-2">
                  <span
                    className="text-[11px] uppercase font-semibold"
                    style={{ color: '#4B5563', letterSpacing: '0.08em' }}
                  >
                    Health Score
                  </span>
                  <span className="text-[14px] font-extrabold" style={{ color: healthColor }}>
                    {c.health}/100
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1 mb-4">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${c.health}%`, backgroundColor: healthColor }}
                  />
                </div>

                {/* 4-column stats */}
                <div className="grid grid-cols-4 mb-3">
                  {[
                    { label: 'Units', value: c.totalUnits },
                    { label: 'Amenities', value: c.amenities.length },
                    { label: 'Members', value: c.activeMembers },
                    { label: 'Alerts', value: c.openIssues + c.pendingApprovals },
                  ].map((item, i) => (
                    <div key={i} className="text-center">
                      <div
                        className="text-[20px] font-extrabold leading-none"
                        style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}
                      >
                        {item.value}
                      </div>
                      <div
                        className="text-[11px] uppercase font-medium mt-1"
                        style={{ color: '#4B5563', letterSpacing: '0.08em' }}
                      >
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Manage link */}
                <div className="flex justify-end pt-1 border-t border-gray-100">
                  <span className="text-[14px] font-extrabold mt-2" style={{ color: '#00D4FF' }}>
                    Manage →
                  </span>
                </div>
              </div>
            );
          })}

          {/* Add Community */}
          <div
            onClick={() => setShowAddCommunity(true)}
            className="flex flex-col items-center py-8 cursor-pointer border-2 border-dashed border-gray-200 rounded-2xl"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2">
              <Plus className="h-5 w-5" style={{ color: '#9CA3AF' }} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#4B5563' }}>
              Add Community
            </span>
          </div>
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
