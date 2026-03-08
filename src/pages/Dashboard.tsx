import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useActiveHOA } from '../contexts/ActiveHOAContext';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import ResidentHeader from '@/components/resident/ResidentHeader';
import { UserType } from '../types';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';
import PendingApprovalMessage from '../components/PendingApprovalMessage';
import { ActiveCommunitySelector } from '@/components/community/ActiveCommunitySelector';
import { 
  Settings, MessageCircle, Calendar, Wrench, CalendarDays, FolderOpen,
  ChevronRight, Megaphone, ClipboardList, Sparkles
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isPending, isCoach, isPlatformReviewer } = useAuth();
  const { activeHOA, hasMultipleHOAs } = useActiveHOA();
  const { bookings, loading } = useData();

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [myReportsCount, setMyReportsCount] = useState(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [documentsCount, setDocumentsCount] = useState(0);
  const [surveyResponseCount, setSurveyResponseCount] = useState<{ responses: number; total: number }>({ responses: 0, total: 0 });

  useEffect(() => {
    if (currentUser && activeHOA?.hoaId) {
      loadHomeData();
    }
  }, [currentUser, activeHOA?.hoaId]);

  // Unread messages
  useEffect(() => {
    if (!currentUser) return;
    const loadUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .is('read_at', null);
      setUnreadMessages(count || 0);
    };
    loadUnread();
  }, [currentUser]);

  useRealtimeSubscription({
    table: 'messages',
    event: 'INSERT',
    filter: currentUser?.id ? `receiver_id=eq.${currentUser.id}` : undefined,
    onInsert: () => {
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUser!.id)
        .is('read_at', null)
        .then(({ count }) => setUnreadMessages(count || 0));
    },
    enabled: !!currentUser?.id
  });

  const loadHomeData = async () => {
    if (!currentUser || !activeHOA?.hoaId) return;
    const hoaId = activeHOA.hoaId;

    // Reports count
    const { count: reportsCount } = await supabase
      .from('maintenance_reports')
      .select('*', { count: 'exact', head: true })
      .eq('reporter_id', currentUser.id)
      .eq('hoa_id', hoaId)
      .in('status', ['open', 'in_progress']);
    setMyReportsCount(reportsCount || 0);

    // Announcements
    const { data: announcementsData } = await supabase
      .from('hoa_announcements')
      .select('*')
      .eq('hoa_id', hoaId)
      .order('created_at', { ascending: false })
      .limit(2);
    setAnnouncements(announcementsData || []);

    // Events
    const { data: eventsData } = await supabase
      .from('hoa_events')
      .select('*')
      .eq('hoa_id', hoaId)
      .eq('status', 'active')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(2);
    setEvents(eventsData || []);

    // Active survey
    const { data: surveyData } = await supabase
      .from('hoa_surveys')
      .select('*')
      .eq('hoa_id', hoaId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (surveyData && surveyData.length > 0) {
      const survey = surveyData[0];
      setActiveSurvey(survey);
      // Check if already responded
      const { data: myResponse } = await supabase
        .from('hoa_survey_responses')
        .select('id')
        .eq('survey_id', survey.id)
        .eq('user_id', currentUser.id)
        .limit(1);
      // Get total members & response count
      const { count: totalMembers } = await supabase
        .from('hoa_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('hoa_id', hoaId)
        .eq('status', 'approved');
      const { count: responseCount } = await supabase
        .from('hoa_survey_responses')
        .select('*', { count: 'exact', head: true })
        .eq('survey_id', survey.id);
      setSurveyResponseCount({ responses: responseCount || 0, total: totalMembers || 0 });
      if (myResponse && myResponse.length > 0) {
        // Already responded — still show banner but in responded state
        setActiveSurvey({ ...survey, _responded: true });
      }
    } else {
      setActiveSurvey(null);
    }

    // Documents count
    const { count: docsCount } = await supabase
      .from('hoa_documents')
      .select('*', { count: 'exact', head: true })
      .eq('hoa_id', hoaId);
    setDocumentsCount(docsCount || 0);
  };

  // Redirects
  if (isPlatformReviewer) return <Navigate to="/reviewer/dashboard" replace />;
  if (isAdmin) return <Navigate to="/cm" replace />;
  if (TENNIS_FEATURES_ENABLED && isCoach) return <Navigate to="/coach-dashboard" replace />;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
          <Sparkles className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
        </div>
      </div>
    );
  }

  if (isPending && currentUser?.userType !== UserType.NON_HOA) {
    return <PendingApprovalMessage />;
  }

  if (!currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Please log in to continue</h2>
          <Link to="/login" className="text-primary font-medium">Go to Login</Link>
        </div>
      </div>
    );
  }

  const firstName = currentUser.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

  // Upcoming reservations
  const now = new Date();
  const upcomingReservations = bookings
    .filter(b => new Date(`${b.date}T${b.startTime}`) > now)
    .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime())
    .slice(0, 3);

  const EVENT_COLORS: Record<string, string> = {
    community_event: '#00B4D8',
    board_meeting: '#0A1628',
    maintenance_scheduled: '#F59E0B',
    amenity_booking: '#2DD4BF',
  };

  const formatTime12 = (time: string) => {
    const [h, m] = time.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <div className="animate-fade-scale">
      {/* Navy Gradient Header */}
      <ResidentHeader>
        <div className="flex justify-between items-start">
          <div>
            <div className="text-[13px] opacity-75">{greeting}</div>
            <div className="text-2xl font-extrabold mt-0.5">{firstName}</div>
            {activeHOA && (
              <div className="text-xs opacity-60 mt-1 flex items-center gap-1">
                🏘 {activeHOA.hoaName}
              </div>
            )}
          </div>
          <div className="flex gap-2.5 items-center mt-1">
            <Link
              to="/settings"
              className="w-10 h-10 rounded-[10px] flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <Settings className="h-[18px] w-[18px] text-white" />
            </Link>
            <Link
              to="/messages"
              className="relative w-10 h-10 rounded-[10px] flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <MessageCircle className="h-[18px] w-[18px] text-white" />
              {unreadMessages > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: '#00B4D8', borderColor: '#0A1628' }} />
              )}
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2.5 mt-5">
          {[
            { icon: '📅', label: 'Book Amenity', to: '/reserve-court' },
            { icon: '🔧', label: 'Report Issue', to: '/my-reports' },
            { icon: '🗓', label: 'Calendar', to: '/community-calendar' },
            { icon: '📁', label: 'Documents', to: '/documents' },
          ].map((tile, i) => (
            <Link
              key={tile.label}
              to={tile.to}
              className="flex-1 rounded-xl py-3 px-2 text-center"
              style={{
                background: i === 0 ? 'rgba(0,180,216,0.2)' : 'rgba(255,255,255,0.1)',
                border: i === 0 ? '1px solid rgba(0,180,216,0.4)' : '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <div className="text-xl">{tile.icon}</div>
              <div className="text-xs font-bold text-white mt-1">{tile.label}</div>
            </Link>
          ))}
        </div>
      </ResidentHeader>

      {/* Community Switcher */}
      {hasMultipleHOAs && (
        <div className="px-4 pt-4">
          <ActiveCommunitySelector onAddCommunity={() => {}} />
        </div>
      )}

      {/* Body */}
      <div className="px-4 pt-4 pb-24 space-y-3">

        {/* Upcoming Reservations */}
        <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[13px] font-extrabold text-foreground">Upcoming Reservations</span>
            {upcomingReservations.length > 0 && (
              <Link to="/upcoming" className="text-xs font-bold text-primary">View All →</Link>
            )}
          </div>
          {upcomingReservations.length === 0 ? (
            <div className="text-center py-5">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-[13px] text-muted-foreground">No upcoming reservations</p>
              <Link to="/reserve-court" className="inline-block mt-3 px-4 py-2 rounded-[10px] text-xs font-bold text-white" style={{ background: '#00B4D8' }}>
                Book an Amenity
              </Link>
            </div>
          ) : (
            upcomingReservations.map((b, i) => (
              <div key={b.id} className={`flex items-center gap-3 ${i < upcomingReservations.length - 1 ? 'pb-3 mb-3 border-b border-border' : ''}`}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'hsl(var(--cyan-light))' }}>
                  📅
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-extrabold text-foreground truncate">{b.amenityName}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {format(new Date(`${b.date}T00:00:00`), 'EEE, MMM d')} · {formatTime12(b.startTime)} – {formatTime12(b.endTime)}
                  </div>
                </div>
                <Link to="/upcoming" className="text-[11px] font-bold text-primary flex-shrink-0">Details →</Link>
              </div>
            ))
          )}
        </div>

        {/* Active Survey Banner */}
        {activeSurvey && !activeSurvey._responded && (
          <div className="navy-gradient rounded-2xl p-4 border" style={{ borderColor: 'rgba(0,180,216,0.2)' }}>
            <div className="text-[11px] font-bold mb-1" style={{ color: '#00B4D8' }}>📊 ACTIVE SURVEY</div>
            <div className="text-[15px] font-extrabold text-white">{activeSurvey.title}</div>
            <div className="text-[11px] text-white/60 mt-1">
              Closes {format(new Date(activeSurvey.closes_at), 'MMM d')} · {surveyResponseCount.responses}/{surveyResponseCount.total} responded
            </div>
            <Link
              to={`/surveys/${activeSurvey.id}`}
              className="inline-block mt-3 px-4 py-2 rounded-[10px] text-xs font-bold text-white"
              style={{ background: '#00B4D8' }}
            >
              Respond Now →
            </Link>
          </div>
        )}

        {/* Community Announcements */}
        <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[13px] font-extrabold text-foreground">Community Announcements</span>
            <span className="text-xs font-bold text-primary cursor-pointer">View All →</span>
          </div>
          {announcements.length === 0 ? (
            <div className="text-center py-5">
              <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-[13px] text-muted-foreground">No announcements yet</p>
            </div>
          ) : (
            announcements.map((a, i) => (
              <div key={a.id} className={i < announcements.length - 1 ? 'pb-3 mb-3 border-b border-border' : ''}>
                <div className="flex gap-2.5 items-start">
                  {a.audience === 'urgent' && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#EF4444' }} />}
                  <div className="flex-1">
                    <div className="text-[13px] font-extrabold text-foreground">{a.title}</div>
                    <div className="text-xs text-text-mid mt-1 leading-relaxed">{a.body?.substring(0, 70)}...</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Community Events */}
        <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[13px] font-extrabold text-foreground">Community Events</span>
            <Link to="/community-calendar" className="text-xs font-bold text-primary">View All →</Link>
          </div>
          {events.length === 0 ? (
            <div className="text-center py-5">
              <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-[13px] text-muted-foreground">No upcoming events</p>
            </div>
          ) : (
            events.map((e, i) => {
              const color = EVENT_COLORS[e.event_type] || '#00B4D8';
              const dt = new Date(e.starts_at);
              return (
                <div key={e.id} className={`flex gap-3 ${i < events.length - 1 ? 'pb-3 mb-3 border-b border-border' : ''}`}>
                  <div className="w-1 rounded-full flex-shrink-0 min-h-[44px]" style={{ background: color }} />
                  <div className="flex-1">
                    <div className="text-[13px] font-extrabold text-foreground">{e.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {format(dt, 'EEE, MMM d')} · {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      {e.location && ` · ${e.location}`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* My Open Reports */}
        {myReportsCount > 0 && (
          <Link to="/my-reports" className="block">
            <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-extrabold text-foreground">My Open Reports</span>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full" style={{ background: 'hsl(var(--warning-bg))', color: 'hsl(var(--warning))' }}>
                  {myReportsCount} open
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* Documents Shortcut */}
        <Link to="/documents" className="block">
          <div className="bg-card rounded-2xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: 'hsl(var(--cyan-light))' }}>
                📁
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-extrabold text-foreground">Community Documents</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{documentsCount} documents available</div>
              </div>
              <span className="text-[11px] font-bold text-primary">View →</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
