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
  Settings, MessageCircle, CalendarDays, Megaphone, Sparkles, ClipboardList, Calendar
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isPending, isCoach, isPlatformReviewer } = useAuth();
  const { activeHOA, hasMultipleHOAs } = useActiveHOA();
  const { bookings, loading } = useData();

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [myReportsCount, setMyReportsCount] = useState(0);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [cancelledBookings, setCancelledBookings] = useState<any[]>([]);
  const [dismissedCancellations, setDismissedCancellations] = useState<Set<string>>(new Set());
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [allAnnouncements, setAllAnnouncements] = useState<any[]>([]);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);

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
  // Load admin-cancelled bookings for banner
  useEffect(() => {
    if (!currentUser) return;
    const loadCancelled = async () => {
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('bookings')
        .select('id, court_id, date, start_time, end_time, cancelled_by, updated_at')
        .eq('user_id', currentUser.id)
        .eq('status', 'cancelled')
        .eq('cancelled_by', 'admin')
        .gte('updated_at', cutoff);
      
      if (data && data.length > 0) {
        // Check if user has rebooked the same amenity since cancellation
        const courtIds = [...new Set(data.map(b => b.court_id))];
        const [courtsResult, rebookedResult] = await Promise.all([
          supabase.from('courts').select('id, name').in('id', courtIds),
          supabase.from('bookings')
            .select('court_id, created_at')
            .eq('user_id', currentUser.id)
            .eq('status', 'confirmed')
            .in('court_id', courtIds)
            .gte('created_at', cutoff),
        ]);

        const courtMap: Record<string, string> = {};
        courtsResult.data?.forEach(c => { courtMap[c.id] = c.name; });

        // Build set of amenities that have been rebooked after cancellation
        const rebookedCourts = new Set<string>();
        rebookedResult.data?.forEach(rb => {
          const cancelledForCourt = data.find(d => d.court_id === rb.court_id);
          if (cancelledForCourt && new Date(rb.created_at) > new Date(cancelledForCourt.updated_at)) {
            rebookedCourts.add(cancelledForCourt.id);
          }
        });

        setCancelledBookings(
          data
            .filter(b => !rebookedCourts.has(b.id))
            .map(b => ({ ...b, amenityName: courtMap[b.court_id] || 'Amenity' }))
        );
      } else {
        setCancelledBookings([]);
      }
    };

    loadCancelled();

    try {
      const dismissed = JSON.parse(localStorage.getItem('dismissed_cancellations') || '[]');
      setDismissedCancellations(new Set(dismissed));
    } catch {}
  }, [currentUser, bookings]);

  useRealtimeSubscription({
    table: 'bookings',
    event: '*',
    filter: currentUser?.id ? `user_id=eq.${currentUser.id}` : undefined,
    onChange: () => {
      if (currentUser) {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        supabase
          .from('bookings')
          .select('id, court_id, date, start_time, end_time, cancelled_by, updated_at')
          .eq('user_id', currentUser.id)
          .eq('status', 'cancelled')
          .eq('cancelled_by', 'admin')
          .gte('updated_at', cutoff)
          .then(async ({ data }) => {
            if (data && data.length > 0) {
              const courtIds = [...new Set(data.map(b => b.court_id))];
              const [courtsResult, rebookedResult] = await Promise.all([
                supabase.from('courts').select('id, name').in('id', courtIds),
                supabase.from('bookings')
                  .select('court_id, created_at')
                  .eq('user_id', currentUser.id)
                  .eq('status', 'confirmed')
                  .in('court_id', courtIds)
                  .gte('created_at', cutoff),
              ]);
              const courtMap: Record<string, string> = {};
              courtsResult.data?.forEach(c => { courtMap[c.id] = c.name; });
              const rebookedCourts = new Set<string>();
              rebookedResult.data?.forEach(rb => {
                const cancelledForCourt = data.find(d => d.court_id === rb.court_id);
                if (cancelledForCourt && new Date(rb.created_at) > new Date(cancelledForCourt.updated_at)) {
                  rebookedCourts.add(cancelledForCourt.id);
                }
              });
              setCancelledBookings(
                data.filter(b => !rebookedCourts.has(b.id))
                  .map(b => ({ ...b, amenityName: courtMap[b.court_id] || 'Amenity' }))
              );
            } else {
              setCancelledBookings([]);
            }
          });
      }
    },
    enabled: !!currentUser?.id
  });

  const handleDismissCancellation = (bookingId: string) => {
    setDismissedCancellations(prev => {
      const next = new Set(prev);
      next.add(bookingId);
      try { localStorage.setItem('dismissed_cancellations', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const loadHomeData = async () => {
    if (!currentUser || !activeHOA?.hoaId) return;
    const hoaId = activeHOA.hoaId;

    // Open reports with details
    const { data: reportsData, count: reportsCount } = await supabase
      .from('maintenance_reports')
      .select('*', { count: 'exact' })
      .eq('reporter_id', currentUser.id)
      .eq('hoa_id', hoaId)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(3);
    setMyReportsCount(reportsCount || 0);
    setMyReports(reportsData || []);

    // Announcements
    const { data: announcementsData } = await supabase
      .from('hoa_announcements')
      .select('*')
      .eq('hoa_id', hoaId)
      .order('created_at', { ascending: false })
      .limit(3);
    setAnnouncements(announcementsData || []);

    // Events
    const { data: eventsData } = await supabase
      .from('hoa_events')
      .select('*')
      .eq('hoa_id', hoaId)
      .eq('status', 'active')
      .eq('event_type', 'community_event')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(3);
    setEvents(eventsData || []);

    // Active survey (not yet responded)
    const { data: surveyData } = await supabase
      .from('hoa_surveys')
      .select('*')
      .eq('hoa_id', hoaId)
      .eq('status', 'active')
      .gte('closes_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (surveyData && surveyData.length > 0) {
      const survey = surveyData[0];
      const { data: myResponse } = await supabase
        .from('hoa_survey_responses')
        .select('id')
        .eq('survey_id', survey.id)
        .eq('user_id', currentUser.id)
        .limit(1);
      if (!myResponse || myResponse.length === 0) {
        setActiveSurvey(survey);
      } else {
        setActiveSurvey(null);
      }
    } else {
      setActiveSurvey(null);
    }
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
    .slice(0, 2);

  const formatTime12 = (time: string) => {
    const [h, m] = time.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  const cardStyle = "bg-white rounded-2xl p-4 border border-[#E5E7EB] mb-3" as const;
  const cardShadow = { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };
  const cardTitle = "text-[16px] font-bold" as const;
  const viewAll = "text-[13px] font-bold" as const;

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
      </ResidentHeader>

      {/* Community Switcher */}
      {hasMultipleHOAs && (
        <div className="px-4 pt-4">
          <ActiveCommunitySelector onAddCommunity={() => {}} />
        </div>
      )}

      {/* Body */}
      <div className="px-4 pt-4 pb-28" style={{ background: '#F0F4F8' }}>

        {/* Admin cancellation banners */}
        {cancelledBookings
          .filter(cb => !dismissedCancellations.has(cb.id))
          .map(cb => (
            <div
              key={cb.id}
              className="rounded-2xl p-3.5 mb-3 relative"
              style={{
                background: '#FEF2F2',
                border: '1px solid #EF4444',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              <div
                onClick={() => handleDismissCancellation(cb.id)}
                className="absolute top-2.5 right-2.5 cursor-pointer w-6 h-6 flex items-center justify-center rounded-full"
                style={{ color: '#9CA3AF' }}
              >
                ✕
              </div>
              <div className="flex items-start gap-2.5 pr-5">
                <span className="text-base mt-0.5">⚠️</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold" style={{ color: '#EF4444' }}>
                    Your {cb.amenityName} booking on {format(new Date(`${cb.date}T00:00:00`), 'MMM d')} at {formatTime12(cb.start_time)} was cancelled.
                  </div>
                  <Link
                    to="/reserve-court"
                    className="inline-block mt-1.5 text-[13px] font-bold"
                    style={{ color: '#00B4D8' }}
                  >
                    Book Again →
                  </Link>
                </div>
              </div>
            </div>
          ))
        }

        {/* CARD 1 — Upcoming Reservations */}
        <div className={cardStyle} style={cardShadow}>
          <div className="flex justify-between items-center mb-3">
            <span className={cardTitle} style={{ color: '#1A1A2E' }}>Upcoming Reservations</span>
            {upcomingReservations.length > 0 && (
              <Link to="/book" className={viewAll} style={{ color: '#00B4D8' }}>View All →</Link>
            )}
          </div>
          {upcomingReservations.length === 0 ? (
            <div className="text-center py-5">
              <Calendar className="h-10 w-10 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
              <p className="text-[13px] mb-3" style={{ color: '#9CA3AF' }}>No upcoming reservations</p>
              <Link to="/reserve-court" className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#00B4D8' }}>
                Book an Amenity
              </Link>
            </div>
          ) : (
            upcomingReservations.map((b, i) => (
              <div key={b.id} className={`flex items-center gap-3 ${i < upcomingReservations.length - 1 ? 'pb-3 mb-3 border-b border-[#E5E7EB]' : ''}`}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#2DD4BF' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate" style={{ color: '#1A1A2E' }}>{b.amenityName}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>
                    {format(new Date(`${b.date}T00:00:00`), 'EEE, MMM d')} · {formatTime12(b.startTime)} – {formatTime12(b.endTime)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CARD 2 — Active Survey Banner */}
        {activeSurvey && (
          <div
            className="rounded-2xl p-4 mb-3 flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, #00B4D8 0%, #0091B5 100%)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">📋</span>
                <span className="text-[14px] font-bold text-white">You have a survey to complete</span>
              </div>
              <div className="text-[12px] text-white/70 truncate">{activeSurvey.title}</div>
            </div>
            <Link
              to={`/surveys/${activeSurvey.id}`}
              className="flex-shrink-0 px-4 py-2 rounded-xl text-[12px] font-bold text-white border border-white/40"
            >
              Take Survey →
            </Link>
          </div>
        )}

        {/* CARD 3 — Community Announcements */}
        <div className={cardStyle} style={cardShadow}>
          <div className="flex justify-between items-center mb-3">
            <span className={cardTitle} style={{ color: '#1A1A2E' }}>Community Announcements</span>
            {announcements.length > 0 && (
              <span
                className={viewAll}
                style={{ color: '#00B4D8', cursor: 'pointer' }}
                onClick={async () => {
                  if (showAllAnnouncements) {
                    setShowAllAnnouncements(false);
                    return;
                  }
                  if (allAnnouncements.length === 0 && activeHOA?.hoaId) {
                    const { data } = await supabase
                      .from('hoa_announcements')
                      .select('*')
                      .eq('hoa_id', activeHOA.hoaId)
                      .order('created_at', { ascending: false })
                      .limit(20);
                    setAllAnnouncements(data || []);
                  }
                  setShowAllAnnouncements(true);
                }}
              >
                {showAllAnnouncements ? '← Show Less' : 'View All →'}
              </span>
            )}
          </div>
          {announcements.length === 0 ? (
            <div className="text-center py-5">
              <Megaphone className="h-10 w-10 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>No announcements yet</p>
            </div>
          ) : (
            announcements.map((a, i) => (
              <div key={a.id} className={i < announcements.length - 1 ? 'pb-3 mb-3 border-b border-[#E5E7EB]' : ''}>
                <div className="text-[13px] font-bold" style={{ color: '#1A1A2E' }}>{a.title}</div>
                <div className="text-[12px] mt-0.5 truncate" style={{ color: '#9CA3AF' }}>
                  {a.body?.substring(0, 80)}{a.body?.length > 80 ? '…' : ''}
                </div>
                <div className="text-[11px] mt-1" style={{ color: '#9CA3AF' }}>
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* CARD 4 — Community Events */}
        <div className={cardStyle} style={cardShadow}>
          <div className="flex justify-between items-center mb-3">
            <span className={cardTitle} style={{ color: '#1A1A2E' }}>Community Events</span>
            {events.length > 0 && (
              <Link to="/community-calendar" className={viewAll} style={{ color: '#00B4D8' }}>View All →</Link>
            )}
          </div>
          {events.length === 0 ? (
            <div className="text-center py-5">
              <CalendarDays className="h-10 w-10 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
              <p className="text-[13px]" style={{ color: '#9CA3AF' }}>No upcoming events</p>
            </div>
          ) : (
            events.map((e, i) => {
              const dt = new Date(e.starts_at);
              return (
                <div key={e.id} className={`flex items-center gap-3 ${i < events.length - 1 ? 'pb-3 mb-3 border-b border-[#E5E7EB]' : ''}`}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#00B4D8' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: '#1A1A2E' }}>{e.title}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>
                      {format(dt, 'EEE, MMM d')} · {dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      {e.location && <span className="text-[11px]"> · {e.location}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* CARD 5 — My Open Reports */}
        {myReportsCount > 0 && (
          <div className={cardStyle} style={cardShadow}>
            <div className="flex justify-between items-center mb-3">
              <span className={cardTitle} style={{ color: '#1A1A2E' }}>My Open Reports</span>
              {myReportsCount > 3 && (
                <Link to="/my-reports" className={viewAll} style={{ color: '#00B4D8' }}>View All →</Link>
              )}
            </div>
            {myReports.map((r, i) => (
              <Link to="/my-reports" key={r.id} className={`flex items-center justify-between ${i < myReports.length - 1 ? 'pb-3 mb-3 border-b border-[#E5E7EB]' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold truncate" style={{ color: '#1A1A2E' }}>{r.title || r.issue_type || 'Report'}</span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: r.status === 'open' ? '#FEF3C7' : '#CFFAFE',
                        color: r.status === 'open' ? '#F59E0B' : '#00B4D8',
                      }}
                    >
                      {r.status === 'open' ? 'Open' : 'In Progress'}
                    </span>
                  </div>
                  {r.location && (
                    <div className="text-[12px] mt-0.5" style={{ color: '#9CA3AF' }}>{r.location}</div>
                  )}
                  <div className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
