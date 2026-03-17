import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Settings, Wrench, X } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { CMHealthBar } from '@/components/condo-manager/CMHealthBar';
import { CMStatusBadge } from '@/components/condo-manager/CMStatusBadge';
import { CMKpiCard } from '@/components/condo-manager/CMKpiCard';
import { CMIssuesTrendChart, CMPeriodToggle } from '@/components/condo-manager/CMIssuesTrendChart';
import SetMaintenanceSheet from '@/components/condo-manager/SetMaintenanceSheet';
import { SurveyList } from '@/components/surveys/SurveyList';
import { SurveyBuilder } from '@/components/surveys/SurveyBuilder';
import { SurveyResults } from '@/components/surveys/SurveyResults';
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
  const [newAmenityName, setNewAmenityName] = useState('');
  const [newAmenityType, setNewAmenityType] = useState<string>('tennis');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementAudience, setAnnouncementAudience] = useState('all_residents');
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [showSurveyBuilder, setShowSurveyBuilder] = useState(false);
  const [surveyResultsId, setSurveyResultsId] = useState<string | null>(null);
  const [editSurveyId, setEditSurveyId] = useState<string | null>(null);
  const [surveyListKey, setSurveyListKey] = useState(0);

  const c = communities.find((x) => x.id === id) || communities[0];

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setTab(tabParam);
  }, [searchParams]);

  // Fetch pending members when on members tab
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
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
        setPendingMembers(data.map(m => ({
          ...m,
          name: nameMap.get(m.user_id) || 'Unknown',
        })));
      } else {
        setPendingMembers([]);
      }
    };
    fetchPending();
  }, [tab, c]);

  const handleApproveMember = async (membershipId: string) => {
    const { error } = await supabase.rpc('approve_hoa_membership', { membership_id: membershipId });
    if (error) {
      toast.error('Failed to approve member');
    } else {
      toast.success('Member approved');
      setPendingMembers(prev => prev.filter(m => m.id !== membershipId));
    }
  };

  const handleRejectMember = async (membershipId: string) => {
    const { error } = await supabase.rpc('reject_hoa_membership', { membership_id: membershipId });
    if (error) {
      toast.error('Failed to reject member');
    } else {
      toast.success('Member rejected');
      setPendingMembers(prev => prev.filter(m => m.id !== membershipId));
    }
  };

  const handlePostAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementBody.trim() || !c || !currentUser?.id) return;

    const { error } = await supabase.from('hoa_announcements').insert({
      hoa_id: c.id,
      created_by: currentUser.id,
      title: announcementTitle.trim(),
      body: announcementBody.trim(),
      audience: announcementAudience,
    });

    if (error) {
      toast.error('Failed to post announcement');
      return;
    }

    // Send notification to all community members
    const { data: members } = await supabase
      .from('hoa_memberships')
      .select('user_id')
      .eq('hoa_id', c.id)
      .eq('status', 'approved');

    if (members) {
      const notifs = members
        .filter(m => announcementAudience === 'all_residents' || m.user_id === currentUser.id)
        .map(m => ({
          user_id: m.user_id,
          hoa_id: c.id,
          type: 'announcement' as const,
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
        }));

      if (notifs.length > 0) {
        await supabase.from('hoa_notifications').insert(notifs);
      }
    }

    toast.success('Announcement posted');
    setShowAnnouncementModal(false);
    setAnnouncementTitle('');
    setAnnouncementBody('');
  };

  const handleQuickAction = (label: string) => {
    if (!c) return;
    switch (label) {
      case 'Manage Documents':
        navigate(`/cm/community/${c.id}/documents`);
        break;
      case 'Create Survey':
        setEditSurveyId(null);
        setShowSurveyBuilder(true);
        break;
      case 'Approve Members':
        setTab('members');
        break;
      case 'Post Announcement':
        setShowAnnouncementModal(true);
        break;
    }
  };

  if (!c) {
    return (
      <div className="min-h-screen bg-cm-app-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cm-cyan" />
      </div>
    );
  }

  const tabs = ['overview', 'reports', 'amenities', 'members'];

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex items-center gap-3 mb-4">
          <div
            onClick={() => navigate('/cm')}
            className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-xl font-extrabold">{c.name}</div>
            <div className="text-xs opacity-65">{c.totalUnits} units</div>
          </div>
          <CMStatusBadge status={c.status} />
        </div>
        <div className="bg-[rgba(0,180,216,0.12)] border border-[rgba(0,180,216,0.2)] rounded-[14px] p-3">
          <div className="flex justify-between items-center mb-2">
            <div>
              <div className="text-[13px] opacity-85 font-semibold">Community Health Score</div>
              <div className="text-[10px] opacity-55 italic mt-0.5">updated daily</div>
            </div>
            <div className="text-[28px] font-black text-cm-cyan">
              {c.health}<span className="text-sm opacity-70">/100</span>
            </div>
          </div>
          <CMHealthBar value={c.health} status={c.status} />
        </div>
        {(tab === 'overview' || tab === 'reports') && (
          <div className="flex items-center justify-between mt-3">
            <div className="text-[11px] opacity-60 font-semibold">Issues Period</div>
            <CMPeriodToggle value={trendPeriod} onChange={setTrendPeriod} />
          </div>
        )}
      </CMHeader>

      {/* Tabs */}
      <div className="flex bg-white border-b border-cm-border flex-shrink-0">
        {tabs.map((t) => (
          <div
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-3 px-1 text-center text-[11px] font-bold capitalize cursor-pointer transition-colors"
            style={{
              color: tab === t ? 'hsl(var(--cm-cyan))' : 'hsl(var(--cm-text-light))',
              borderBottom: tab === t ? '2px solid hsl(var(--cm-cyan))' : '2px solid transparent',
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <CMKpiCard label="Active Members" value={`${c.activeMembers}/${c.totalUnits}`} period="logged in last 30 days" color="hsl(var(--cm-cyan))" />
              <CMKpiCard
                label="Open Issues" value={c.openIssues} period="right now"
                color={c.openIssues > 3 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
                sub={c.openIssues > 3 ? '⚠ Needs attention' : '✓ Under control'}
                subColor={c.openIssues > 3 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
              />
              <CMKpiCard label="Today's Bookings" value={c.todayBookings} period="today" />
              <CMKpiCard
                label="Pending Approvals" value={c.pendingApprovals} period="awaiting review"
                color={c.pendingApprovals > 0 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))'}
                sub={c.pendingApprovals > 0 ? 'Action required' : 'All clear'}
                subColor={c.pendingApprovals > 0 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))'}
              />
            </div>

            <CMIssuesTrendChart hoaIds={[c.id]} period={trendPeriod} />

            {/* Quick Actions */}
            <div className="text-[13px] font-extrabold text-cm-text mb-3">Quick Actions</div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Post Announcement', icon: '📢' },
                { label: 'Approve Members', icon: '✅' },
                { label: 'Manage Documents', icon: '📁' },
                { label: 'Create Survey', icon: '📊' },
              ].map((a) => (
                <div
                  key={a.label}
                  onClick={() => handleQuickAction(a.label)}
                  className="bg-white border border-cm-border rounded-[14px] p-3.5 flex items-center gap-2.5 cursor-pointer hover:shadow-sm transition-shadow min-h-[44px]"
                >
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-xs font-bold text-cm-navy">{a.label}</span>
                </div>
              ))}
            </div>


            {/* Surveys Section */}
            <div className="mt-6">
              <SurveyList
                key={surveyListKey}
                communityId={c.id}
                communityName={c.name}
                onNewSurvey={() => { setEditSurveyId(null); setShowSurveyBuilder(true); }}
                onViewResults={(id) => setSurveyResultsId(id)}
                onEditSurvey={(s) => { setEditSurveyId(s.id); setShowSurveyBuilder(true); }}
              />
            </div>
          </>
        )}

        {tab === 'reports' && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <CMKpiCard
                label="Open Issues" value={c.openIssues} period="right now"
                color={c.openIssues > 3 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
              />
              <CMKpiCard
                label="Avg Resolution" value={`${c.avgResolutionDays}d`} period="issues closed this month"
                color={c.avgResolutionDays > 4 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
                sub={c.avgResolutionDays > 4 ? '⚠ Above 4d target' : '✓ Within target'}
                subColor={c.avgResolutionDays > 4 ? 'hsl(var(--cm-danger))' : 'hsl(var(--cm-success))'}
              />
            </div>
            <CMIssuesTrendChart hoaIds={[c.id]} period={trendPeriod} />
          </>
        )}

        {tab === 'amenities' && (
          <>
            <CMKpiCard
              label="Utilization Rate" value={`${c.utilization}%`} period="this week Mon–Sun"
              color={c.utilization > 85 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-cyan))'}
              sub={c.utilization > 85 ? '⚠ High demand' : c.utilization < 30 ? '⚠ Low usage' : '✓ Healthy (50–85% ideal)'}
              subColor={c.utilization > 85 || c.utilization < 30 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))'}
            />
            <div className="mt-4 flex items-center justify-between mb-3">
              <div className="text-[13px] font-extrabold text-cm-text">Amenities</div>
              <div
                onClick={() => setShowAddAmenityModal(true)}
                className="flex items-center gap-1 bg-cm-navy text-white rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer min-h-[36px]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Amenity
              </div>
            </div>
            {c.amenities.map((a) => (
              <div key={a.id} className="bg-white rounded-xl mb-2 flex justify-between items-center border border-cm-border" style={{ padding: '14px 16px' }}>
                <div>
                  <div className="text-sm font-bold" style={{ color: '#1A1A2E' }}>{a.name}</div>
                  <div className="text-xs capitalize" style={{ color: '#9CA3AF', fontSize: 12 }}>{a.type}</div>
                </div>
                <div className="flex items-center" style={{ gap: 8 }}>
                  {/* Edit Rules */}
                  <div
                    onClick={() => navigate(`/cm/community/${c.id}/amenity/${a.id}/rules`)}
                    className="flex items-center justify-center cursor-pointer"
                    style={{ width: 44, height: 44, backgroundColor: '#F0F4F8', borderRadius: 10 }}
                  >
                    <Settings className="h-5 w-5" style={{ color: '#00B4D8' }} />
                  </div>
                  {/* Set Maintenance */}
                  <div
                    onClick={() => setMaintenanceAmenity({ id: a.id, name: a.name, type: a.type, hoaId: c.id })}
                    className="flex items-center justify-center cursor-pointer"
                    style={{ width: 44, height: 44, backgroundColor: '#F0F4F8', borderRadius: 10 }}
                  >
                    <Wrench className="h-5 w-5" style={{ color: '#F59E0B' }} />
                  </div>
                  {/* Remove Amenity */}
                  <div
                    onClick={async () => {
                      if (!confirm(`Remove "${a.name}"? This will also remove all bookings for this amenity.`)) return;
                      const { error } = await supabase.from('courts').delete().eq('id', a.id);
                      if (error) {
                        toast.error('Failed to remove amenity');
                      } else {
                        toast.success('Amenity removed');
                        refetch();
                      }
                    }}
                    className="flex items-center justify-center cursor-pointer"
                    style={{ width: 44, height: 44, backgroundColor: '#F0F4F8', borderRadius: 10 }}
                  >
                    <Trash2 className="h-5 w-5" style={{ color: '#EF4444' }} />
                  </div>
                </div>
              </div>
            ))}
            {c.amenities.length === 0 && (
              <div className="text-center py-8 text-cm-text-light">No amenities configured</div>
            )}
          </>
        )}

        {tab === 'members' && (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <CMKpiCard label="Active Members" value={c.activeMembers} period="logged in last 30 days" color="hsl(var(--cm-cyan))" />
              <CMKpiCard label="Total Units" value={c.totalUnits} period="physical units" />
              <CMKpiCard
                label="Pending Approvals" value={c.pendingApprovals} period="awaiting review"
                color={c.pendingApprovals > 0 ? 'hsl(var(--cm-warning))' : 'hsl(var(--cm-success))'}
              />
              <CMKpiCard
                label="Occupancy" value={`${Math.round((c.activeMembers / c.totalUnits) * 100)}%`} period="with app login"
              />
            </div>

            {/* Pending approvals section */}
            {pendingMembers.length > 0 && (
              <div className="mb-4">
                <div className="text-[13px] font-extrabold text-cm-text mb-2">Pending Approvals</div>
                {pendingMembers.map((m) => (
                  <div key={m.id} className="bg-white rounded-[14px] p-3.5 mb-2 border border-cm-border">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-cm-text">{m.name}</div>
                        <div className="text-[11px] text-cm-text-light">Applied {new Date(m.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex gap-2">
                        <div
                          onClick={() => handleApproveMember(m.id)}
                          className="bg-cm-success text-white rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer min-h-[44px] flex items-center"
                        >
                          Approve
                        </div>
                        <div
                          onClick={() => handleRejectMember(m.id)}
                          className="bg-cm-app-bg text-cm-text-mid rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer border border-cm-border min-h-[44px] flex items-center"
                        >
                          Reject
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {c.totalUnits - c.activeMembers > 0 && (
              <div className="bg-cm-warning-bg rounded-[14px] p-3.5 mb-4 border border-yellow-300">
                <div className="text-xs font-bold text-cm-warning">
                  {c.totalUnits - c.activeMembers} units not yet on the platform
                </div>
                <div className="mt-2.5 bg-cm-warning text-white rounded-lg py-2 px-3.5 text-xs font-bold text-center cursor-pointer min-h-[44px] flex items-center justify-center">
                  Send Invite Reminders
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="text-lg font-extrabold text-cm-navy mb-4">Post Announcement</div>
            <input
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              placeholder="Announcement Title"
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3"
            />
            <textarea
              value={announcementBody}
              onChange={(e) => setAnnouncementBody(e.target.value)}
              placeholder="Write your announcement..."
              rows={4}
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3 resize-none"
            />
            <select
              value={announcementAudience}
              onChange={(e) => setAnnouncementAudience(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-4"
            >
              <option value="all_residents">All Residents</option>
              <option value="board_only">Board Only</option>
            </select>
            <div
              onClick={handlePostAnnouncement}
              className="bg-cm-navy text-white rounded-[10px] py-3 text-sm font-bold text-center cursor-pointer w-full min-h-[44px] flex items-center justify-center"
            >
              Post
            </div>
            <div
              onClick={() => setShowAnnouncementModal(false)}
              className="text-center mt-3 text-sm text-cm-text-light cursor-pointer"
            >
              Cancel
            </div>
          </div>
        </div>
      )}

      {/* Add Amenity Modal */}
      {showAddAmenityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-extrabold text-cm-navy">Add Amenity</div>
              <div onClick={() => setShowAddAmenityModal(false)} className="cursor-pointer text-cm-text-light">
                <X className="h-5 w-5" />
              </div>
            </div>
            <input
              value={newAmenityName}
              onChange={(e) => setNewAmenityName(e.target.value)}
              placeholder="Amenity Name (e.g., Tennis Court 1, Pool Area)"
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3"
            />
            <div className="text-xs font-bold text-cm-text mb-2">Amenity Type</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {AMENITY_TYPES.map((t) => (
                <div
                  key={t.value}
                  onClick={() => setNewAmenityType(t.value)}
                  className={`rounded-[10px] border px-3 py-2.5 text-xs font-semibold text-center cursor-pointer transition-colors ${
                    newAmenityType === t.value
                      ? 'border-cm-cyan bg-[rgba(0,180,216,0.08)] text-cm-cyan'
                      : 'border-cm-border text-cm-text-mid'
                  }`}
                >
                  {t.label}
                </div>
              ))}
            </div>
            <div
              onClick={async () => {
                if (!newAmenityName.trim() || !c) {
                  toast.error('Please enter an amenity name');
                  return;
                }
                const { error } = await supabase.from('courts').insert({
                  name: newAmenityName.trim(),
                  court_type: newAmenityType,
                  hoa_id: c.id,
                });
                if (error) {
                  toast.error('Failed to add amenity');
                } else {
                  toast.success(`${newAmenityName.trim()} added`);
                  setNewAmenityName('');
                  setNewAmenityType('tennis');
                  setShowAddAmenityModal(false);
                  refetch();
                }
              }}
              className="bg-cm-navy text-white rounded-[10px] py-3 text-sm font-bold text-center cursor-pointer w-full min-h-[44px] flex items-center justify-center"
            >
              Add Amenity
            </div>
            <div
              onClick={() => setShowAddAmenityModal(false)}
              className="text-center mt-3 text-sm text-cm-text-light cursor-pointer"
            >
              Cancel
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Bottom Sheet */}
      {maintenanceAmenity && (
        <SetMaintenanceSheet
          open={!!maintenanceAmenity}
          onClose={() => setMaintenanceAmenity(null)}
          amenity={maintenanceAmenity}
        />
      )}

      {/* Survey Builder Overlay */}
      {showSurveyBuilder && c && (
        <SurveyBuilder
          communityId={c.id}
          onBack={() => setShowSurveyBuilder(false)}
          onComplete={() => { setShowSurveyBuilder(false); setSurveyListKey(k => k + 1); }}
          editSurveyId={editSurveyId}
        />
      )}

      {/* Survey Results Overlay */}
      {surveyResultsId && c && (
        <SurveyResults
          surveyId={surveyResultsId}
          communityId={c.id}
          onBack={() => setSurveyResultsId(null)}
        />
      )}
    </div>
  );
};

export default CMCommunityDashboard;
