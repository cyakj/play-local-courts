import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Settings, Wrench, X,
  Users, AlertTriangle, Calendar, UserCheck, Megaphone, FileText, BarChart2,
} from 'lucide-react';
import { CMIssuesTrendChart } from '@/components/condo-manager/CMIssuesTrendChart';
import SetMaintenanceSheet from '@/components/condo-manager/SetMaintenanceSheet';
import InviteLinkSheet from '@/components/condo-manager/InviteLinkSheet';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const AMENITY_TYPES = [
  { value: 'tennis', label: 'Tennis Court' },
  { value: 'pickleball', label: 'Pickleball Court' },
  { value: 'pool', label: 'Pool' },
  { value: 'gym', label: 'Gym' },
  { value: 'clubhouse', label: 'Clubhouse' },
  { value: 'barbecue', label: 'Barbecue' },
  { value: 'jacuzzi', label: 'Jacuzzi' },
] as const;

const getHealthColor = (score: number) => {
  if (score >= 70) return '#00D4FF';
  if (score >= 40) return '#F97066';
  return '#EF4444';
};

type StatCardProps = {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  badge?: React.ReactNode;
};
const StatCard = ({ icon, value, label, badge }: StatCardProps) => (
  <div className="bg-white rounded-2xl p-5 pb-6 border border-gray-100 flex flex-col justify-between h-32"
    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
    <div className="flex justify-between items-start">
      <div style={{ color: '#00D4FF' }}>{icon}</div>
      {badge}
    </div>
    <div>
      <div className="font-bold text-2xl" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>{value}</div>
      <div className="text-[11px] uppercase font-semibold mt-1" style={{ color: '#4B5563', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  </div>
);

const GreenBadge = ({ label }: { label: string }) => (
  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
    style={{ backgroundColor: '#E0F9FF', color: '#0369A1', border: '1px solid #00D4FF' }}>
    {label}
  </span>
);

const CMCommunityDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const [tab, setTab] = useState(searchParams.get('tab') || 'overview');
  const [trendPeriod, setTrendPeriod] = useState('Week');
  const { communities, refetch } = useCondoManagerCommunities();
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showAddAmenityModal, setShowAddAmenityModal] = useState(false);
  const [maintenanceAmenity, setMaintenanceAmenity] = useState<{ id: string; name: string; type: string; hoaId: string } | null>(null);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [newAmenityName, setNewAmenityName] = useState('');
  const [newAmenityType, setNewAmenityType] = useState<string>('tennis');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState('all_residents');
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);

  const c = communities.find((x) => x.id === id) || communities[0];

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    if (tab !== 'members' || !c) return;
    const fetchPending = async () => {
      const { data } = await supabase
        .from('hoa_memberships')
        .select('id, user_id, created_at')
        .eq('hoa_id', c.id)
        .eq('status', 'pending');
      if (data && data.length > 0) {
        const userIds = data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles').select('id, full_name').in('id', userIds);
        const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
        setPendingMembers(data.map(m => ({ ...m, name: nameMap.get(m.user_id) || 'Unknown' })));
      } else {
        setPendingMembers([]);
      }
    };
    fetchPending();
  }, [tab, c]);

  const handleApproveMember = async (membershipId: string) => {
    const { error } = await supabase.rpc('approve_hoa_membership', { membership_id: membershipId });
    if (error) toast.error('Failed to approve member');
    else { toast.success('Member approved'); setPendingMembers(prev => prev.filter(m => m.id !== membershipId)); }
  };

  const handleRejectMember = async (membershipId: string) => {
    const { error } = await supabase.rpc('reject_hoa_membership', { membership_id: membershipId });
    if (error) toast.error('Failed to reject member');
    else { toast.success('Member rejected'); setPendingMembers(prev => prev.filter(m => m.id !== membershipId)); }
  };

  const handlePostAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim() || !c || !currentUser?.id) return;
    const { error } = await supabase.from('hoa_announcements').insert({
      hoa_id: c.id, created_by: currentUser.id,
      title: announcementTitle.trim(), body: announcementBody.trim(), audience: announcementAudience,
    });
    if (error) { toast.error('Failed to post announcement'); return; }
    const { data: members } = await supabase
      .from('hoa_memberships').select('user_id').eq('hoa_id', c.id).eq('status', 'approved');
    if (members) {
      const notifs = members
        .filter(m => announcementAudience === 'all_residents' || m.user_id === currentUser.id)
        .map(m => ({ user_id: m.user_id, hoa_id: c.id, type: 'announcement' as const, title: announcementTitle.trim(), body: announcementBody.trim() }));
      if (notifs.length > 0) await supabase.from('hoa_notifications').insert(notifs);
    }
    toast.success('Announcement posted');
    setShowAnnouncementModal(false);
    setAnnouncementTitle('');
    setAnnouncementBody('');
  };

  const handleQuickAction = (label: string) => {
    if (!c) return;
    switch (label) {
      case 'Manage Documents': navigate(`/cm/community/${c.id}/documents`); break;
      case 'Manage Surveys': navigate(`/cm/community/${c.id}/surveys`); break;
      case 'Approve Members': setTab('members'); break;
      case 'Announce': setShowAnnouncementModal(true); break;
    }
  };

  if (!c) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4FF]" />
      </div>
    );
  }

  const healthColor = getHealthColor(c.health);
  const statusPill = c.status === 'critical'
    ? { label: 'Critical', bg: '#EF4444', text: '#fff' }
    : c.status === 'warning'
    ? { label: 'Needs Attention', bg: '#823f3a', text: '#fff' }
    : { label: 'Optimal', bg: '#0F1F3D', text: '#fff' };

  const tabs = ['overview', 'reports', 'amenities', 'members'];

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">

      {/* Header — no floating card, clean height */}
      <header
        className="sticky top-0 z-50 px-5 pt-10 pb-6 shadow-md"
        style={{ background: 'linear-gradient(135deg, #0F1F3D 0%, #0F1F3D 100%)' }}
      >
        <div className="flex items-center w-full mt-2">
          <button onClick={() => navigate('/cm')} className="mr-4 text-white active:scale-95 transition-transform">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {c.name}
              </h1>
              <span
                className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: statusPill.bg, color: statusPill.text }}
              >
                {statusPill.label}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(0,212,255,0.7)' }}>{c.totalUnits} units</p>
          </div>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="overflow-y-auto px-5 pt-5 space-y-4 max-w-2xl mx-auto">

        {/* Health Score card — first item in scroll flow */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="flex justify-between items-end mb-3">
            <div>
              <p className="text-[11px] uppercase font-semibold mb-1" style={{ color: '#4B5563', letterSpacing: '0.08em' }}>
                Community Health Score
              </p>
              <div className="flex items-baseline gap-1">
                <span className="font-black text-[40px] leading-none" style={{ color: healthColor, fontFamily: 'Manrope, sans-serif' }}>
                  {c.health}
                </span>
                <span className="text-lg font-medium" style={{ color: '#4B5563' }}>/100</span>
              </div>
            </div>
            <p className="text-xs italic" style={{ color: '#9CA3AF' }}>updated daily</p>
          </div>
          <div className="w-full h-1 rounded-full overflow-hidden bg-gray-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${c.health}%`, backgroundColor: healthColor }} />
          </div>
        </div>

        {/* Tab bar — scrollable so "Members" never clips */}
        <div className="flex gap-6 border-b border-gray-200 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="text-[13px] font-semibold pb-2 whitespace-nowrap capitalize transition-colors shrink-0"
              style={{
                color: tab === t ? '#00D4FF' : '#71717A',
                borderBottom: tab === t ? '2px solid #00D4FF' : '2px solid transparent',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Timeframe pill tabs */}
        {(tab === 'overview' || tab === 'reports') && (
          <div className="flex gap-2 p-1 rounded-full w-fit" style={{ backgroundColor: '#F3F4F6' }}>
            {['Week', '3M', '12M', 'YTD'].map((p) => (
              <button
                key={p}
                onClick={() => setTrendPeriod(p)}
                className="text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
                style={{
                  backgroundColor: trendPeriod === p ? '#fff' : 'transparent',
                  color: trendPeriod === p ? '#0F1F3D' : '#6B7280',
                  boxShadow: trendPeriod === p ? '0 1px 4px rgba(25,28,29,0.08)' : 'none',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Users className="h-5 w-5" />}
                value={<>{c.activeMembers}<span className="text-base font-normal" style={{ color: '#9CA3AF' }}>/{c.totalUnits}</span></>}
                label="Active Units"
              />
              <StatCard
                icon={<AlertTriangle className="h-5 w-5" />}
                value={c.openIssues}
                label="Open Issues"
                badge={c.openIssues === 0 ? <GreenBadge label="Perfect" /> : undefined}
              />
              <StatCard
                icon={<Calendar className="h-5 w-5" />}
                value={c.todayBookings}
                label="Today's Bookings"
              />
              <StatCard
                icon={<UserCheck className="h-5 w-5" />}
                value={c.pendingApprovals}
                label="Pending Approvals"
                badge={c.pendingApprovals === 0 ? <GreenBadge label="Clear" /> : undefined}
              />
            </div>

            {/* Issues Trend — chart has its own white card */}
            <CMIssuesTrendChart hoaIds={[c.id]} period={trendPeriod} />

            {/* Quick Actions */}
            <div>
              <h2 className="font-bold text-[18px] mb-3" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Announce', icon: <Megaphone className="h-5 w-5" />, iconBg: '#FFF5F5', iconColor: '#F97066' },
                  { label: 'Approve Members', icon: <UserCheck className="h-5 w-5" />, iconBg: '#E0F9FF', iconColor: '#00D4FF' },
                  { label: 'Manage Documents', icon: <FileText className="h-5 w-5" />, iconBg: '#FFFBEB', iconColor: '#D97706' },
                  { label: 'Manage Surveys', icon: <BarChart2 className="h-5 w-5" />, iconBg: '#EFF6FF', iconColor: '#3B82F6' },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={() => handleQuickAction(a.label)}
                    className="bg-white rounded-2xl border border-gray-100 text-left active:scale-95 transition-transform"
                    style={{
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                      padding: '16px',
                      minHeight: '72px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: 40, height: 40, flexShrink: 0,
                        borderRadius: 10,
                        backgroundColor: a.iconBg, color: a.iconColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {a.icon}
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                      color: '#0F1F3D', fontFamily: 'Manrope, sans-serif',
                      paddingRight: 8,
                      minWidth: 0,
                      wordBreak: 'break-word',
                    }}>
                      {a.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<AlertTriangle className="h-5 w-5" />} value={c.openIssues} label="Open Issues" />
              <StatCard icon={<Calendar className="h-5 w-5" />} value={`${c.avgResolutionDays}d`} label="Avg Resolution" />
            </div>
            <CMIssuesTrendChart hoaIds={[c.id]} period={trendPeriod} />
          </>
        )}

        {/* AMENITIES */}
        {tab === 'amenities' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<BarChart2 className="h-5 w-5" />} value={`${c.utilization}%`} label="Overall Utilization" />
              <StatCard
                icon={<BarChart2 className="h-5 w-5" />}
                value={
                  c.amenities.length > 0
                    ? `${Math.round(c.amenities.reduce((s, a) => s + a.utilization, 0) / c.amenities.length)}%`
                    : '0%'
                }
                label="Avg Per Amenity"
              />
            </div>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Amenities</h2>
              <button
                onClick={() => setShowAddAmenityModal(true)}
                className="flex items-center gap-1 text-white rounded-lg px-3 py-1.5 text-xs font-bold min-h-[36px]"
                style={{ backgroundColor: '#0F1F3D' }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Amenity
              </button>
            </div>
            {c.amenities.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl flex justify-between items-center border border-gray-100 px-4 py-3.5"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold" style={{ color: '#0F1F3D' }}>{a.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs capitalize" style={{ color: '#9CA3AF' }}>{a.type}</span>
                    {(() => {
                      const u = a.utilization;
                      const bg = u >= 70 ? 'rgba(0,212,255,0.12)' : u >= 30 ? 'rgba(249,112,102,0.14)' : 'rgba(239,68,68,0.12)';
                      const fg = u >= 70 ? '#0091B3' : u >= 30 ? '#C2410C' : '#B91C1C';
                      return (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold"
                          style={{ backgroundColor: bg, color: fg, fontFamily: 'Manrope, sans-serif' }}
                        >
                          {u}% used
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigate(`/cm/community/${c.id}/amenity/${a.id}/rules`)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
                    <Settings className="h-5 w-5 text-[#00D4FF]" />
                  </button>
                  <button onClick={() => setMaintenanceAmenity({ id: a.id, name: a.name, type: a.type, hoaId: c.id })}
                    className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
                    <Wrench className="h-5 w-5 text-amber-500" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Remove "${a.name}"? This will also remove all bookings for this amenity.`)) return;
                      const { error } = await supabase.from('courts').delete().eq('id', a.id);
                      if (error) toast.error('Failed to remove amenity');
                      else { toast.success('Amenity removed'); refetch(); }
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ backgroundColor: '#F3F4F6' }}>
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
            {c.amenities.length === 0 && (
              <div className="text-center py-8 text-sm" style={{ color: '#9CA3AF' }}>No amenities configured</div>
            )}
          </>
        )}

        {/* MEMBERS */}
        {tab === 'members' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={<Users className="h-5 w-5" />} value={c.activeMembers} label="Active Members" />
              <StatCard icon={<UserCheck className="h-5 w-5" />} value={c.totalUnits} label="Total Units" />
              <StatCard
                icon={<AlertTriangle className="h-5 w-5" />}
                value={c.pendingApprovals}
                label="Pending Approvals"
                badge={c.pendingApprovals === 0 ? <GreenBadge label="Clear" /> : undefined}
              />
              <StatCard icon={<BarChart2 className="h-5 w-5" />}
                value={`${Math.round((c.activeMembers / c.totalUnits) * 100)}%`} label="Occupancy" />
            </div>

            {pendingMembers.length > 0 && (
              <div>
                <h2 className="font-bold text-base mb-3" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>
                  Pending Approvals
                </h2>
                {pendingMembers.map((m) => (
                  <div key={m.id} className="bg-white rounded-2xl p-4 mb-3 border border-gray-100"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold" style={{ color: '#0F1F3D' }}>{m.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>Applied {new Date(m.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveMember(m.id)}
                          className="text-white rounded-lg px-3 py-1.5 text-xs font-bold min-h-[44px]"
                          style={{ backgroundColor: '#00D4FF' }}>
                          Approve
                        </button>
                        <button onClick={() => handleRejectMember(m.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold border border-gray-200 min-h-[44px]"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {c.totalUnits - c.activeMembers > 0 && (
              <div className="rounded-2xl p-4 border border-amber-200" style={{ backgroundColor: '#FFFBEB' }}>
                <div className="text-xs font-bold text-amber-700">
                  {c.totalUnits - c.activeMembers} units not yet on the platform
                </div>
                <button onClick={() => setShowInviteSheet(true)}
                  className="mt-2.5 bg-amber-500 text-white rounded-lg py-2 px-3.5 text-xs font-bold w-full min-h-[44px]">
                  Send Invite Reminders
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="text-lg font-extrabold mb-4" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Announce</div>
            <input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)}
              placeholder="Announcement Title"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-3 outline-none focus:border-[#00D4FF]" />
            <textarea value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)}
              placeholder="Write your announcement..." rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-3 resize-none outline-none focus:border-[#00D4FF]" />
            <select value={announcementAudience} onChange={(e) => setAnnouncementAudience(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-4 outline-none">
              <option value="all_residents">All Residents</option>
              <option value="board_only">Board Only</option>
            </select>
            <button onClick={handlePostAnnouncement}
              className="text-white rounded-xl py-3 text-sm font-bold w-full min-h-[44px]"
              style={{ backgroundColor: '#0F1F3D' }}>Post</button>
            <button onClick={() => setShowAnnouncementModal(false)} className="text-center mt-3 w-full underline" style={{ color: '#0F1F3D', fontSize: '15px', fontWeight: 500 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Amenity Modal */}
      {showAddAmenityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-extrabold" style={{ color: '#0F1F3D', fontFamily: 'Manrope, sans-serif' }}>Add Amenity</div>
              <button onClick={() => setShowAddAmenityModal(false)} style={{ color: '#9CA3AF' }}><X className="h-5 w-5" /></button>
            </div>
            <input value={newAmenityName} onChange={(e) => setNewAmenityName(e.target.value)}
              placeholder="Amenity Name (e.g., Tennis Court 1, Pool Area)"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm mb-3 outline-none focus:border-[#00D4FF]" />
            <div className="text-xs font-bold mb-2" style={{ color: '#4B5563' }}>Amenity Type</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {AMENITY_TYPES.map((t) => (
                <button key={t.value} onClick={() => setNewAmenityType(t.value)}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-semibold text-center transition-colors`}
                  style={{
                    borderColor: newAmenityType === t.value ? '#00D4FF' : '#E5E7EB',
                    backgroundColor: newAmenityType === t.value ? 'rgba(0,212,255,0.08)' : 'transparent',
                    color: newAmenityType === t.value ? '#00D4FF' : '#6B7280',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                if (!newAmenityName.trim() || !c) { toast.error('Please enter an amenity name'); return; }
                const { error } = await supabase.from('courts').insert({ name: newAmenityName.trim(), court_type: newAmenityType, hoa_id: c.id });
                if (error) toast.error('Failed to add amenity');
                else { toast.success(`${newAmenityName.trim()} added`); setNewAmenityName(''); setNewAmenityType('tennis'); setShowAddAmenityModal(false); refetch(); }
              }}
              className="text-white rounded-xl py-3 text-sm font-bold w-full min-h-[44px]"
              style={{ backgroundColor: '#0F1F3D' }}>Add Amenity</button>
            <button onClick={() => setShowAddAmenityModal(false)} className="text-center mt-3 w-full underline" style={{ color: '#0F1F3D', fontSize: '15px', fontWeight: 500 }}>Cancel</button>
          </div>
        </div>
      )}

      {maintenanceAmenity && (
        <SetMaintenanceSheet open={!!maintenanceAmenity} onClose={() => setMaintenanceAmenity(null)} amenity={maintenanceAmenity} />
      )}
      {c && (
        <InviteLinkSheet open={showInviteSheet} onClose={() => setShowInviteSheet(false)} community={{ id: c.id, name: c.name }} />
      )}
    </div>
  );
};

export default CMCommunityDashboard;
