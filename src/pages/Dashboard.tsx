import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useActiveHOA } from '../contexts/ActiveHOAContext';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { UserType } from '../types';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';
import PendingApprovalMessage from '../components/PendingApprovalMessage';
import { ActiveCommunitySelector } from '@/components/community/ActiveCommunitySelector';
import {
  Settings, MessageCircle, CalendarDays, Megaphone, Sparkles, ClipboardList,
  Calendar, Building2, BarChart2, X, AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface AnnouncementFeedItem {
  id: string;
  title: string;
  body: string;
  created_at: string;
  href?: string;
}

const mergeAnnouncementFeed = (announcementRows: any[] = [], closedSurveyRows: any[] = []): AnnouncementFeedItem[] => {
  return [
    ...announcementRows.map((announcement) => ({
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      created_at: announcement.created_at,
    })),
    ...closedSurveyRows.map((survey) => ({
      id: `survey-results-${survey.id}`,
      title: `Survey Results: ${survey.title}`,
      body: `Results are now available for "${survey.title}" — tap to view the community results.`,
      created_at: survey.closes_at || survey.created_at,
      href: `/surveys/${survey.id}/results`,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isPending, isCoach, isPlatformReviewer } = useAuth();
  const { activeHOA, hasMultipleHOAs } = useActiveHOA();
  const { bookings, loading } = useData();

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [myReportsCount, setMyReportsCount] = useState(0);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [cancelledBookings, setCancelledBookings] = useState<any[]>([]);
  const [dismissedCancellations, setDismissedCancellations] = useState<Set<string>>(new Set());
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [allAnnouncements, setAllAnnouncements] = useState<AnnouncementFeedItem[]>([]);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser && activeHOA?.hoaId) {
      loadHomeData();
    }
  }, [currentUser, activeHOA?.hoaId]);

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

    const [announcementsResult, closedSurveysResult] = await Promise.all([
      supabase
        .from('hoa_announcements')
        .select('*')
        .eq('hoa_id', hoaId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('hoa_surveys')
        .select('id, title, created_at, closes_at')
        .eq('hoa_id', hoaId)
        .eq('status', 'closed')
        .eq('results_visibility', 'community')
        .order('closes_at', { ascending: false })
        .limit(10),
    ]);

    const mergedAnnouncements = mergeAnnouncementFeed(
      announcementsResult.data || [],
      closedSurveysResult.data || []
    );

    setAnnouncements(mergedAnnouncements.slice(0, 3));
    setAllAnnouncements([]);
    setShowAllAnnouncements(false);
    setExpandedAnnouncement(null);

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
      <div className="flex h-screen w-full items-center justify-center" style={{ background: '#F9FAFB' }}>
        <div
          className="w-12 h-12 border-2 rounded-full animate-spin"
          style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }}
        />
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
          <h2 className="text-xl font-semibold mb-4" style={{ color: '#0F1F3D' }}>Please log in to continue</h2>
          <Link to="/login" className="font-medium" style={{ color: '#00D4FF' }}>Go to Login</Link>
        </div>
      </div>
    );
  }

  const firstName = currentUser.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

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

  const cardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: 16,
    padding: 16,
    border: '1px solid rgba(15,31,61,0.08)',
    marginBottom: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  };

  return (
    <div style={{ background: '#F9FAFB', minHeight: '100vh' }}>
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
            <Link
              to="/messages"
              className="relative w-10 h-10 flex items-center justify-center cursor-pointer"
            >
              <MessageCircle className="h-5 w-5 text-white" />
              {unreadMessages > 0 && (
                <div className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                  {unreadMessages}
                </div>
              )}
            </Link>
            <Link
              to="/settings"
              className="w-10 h-10 flex items-center justify-center cursor-pointer"
            >
              <Settings className="h-5 w-5 text-white" />
            </Link>
          </div>
        </div>

        {/* Greeting */}
        <div className="text-[13px] uppercase font-semibold mb-1" style={{ color: '#00D4FF', letterSpacing: '0.15em' }}>
          Welcome back
        </div>
        <h1 className="text-[32px] font-black text-white leading-[1.1] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {greeting}<br />{firstName}
        </h1>
        {activeHOA && (
          <p className="text-cyan-200 mt-3 leading-relaxed" style={{ fontSize: '15px', opacity: 0.9 }}>
            <Building2 className="inline h-3.5 w-3.5 mr-1.5 mb-0.5" />
            {activeHOA.hoaName}
          </p>
        )}

        {/* Bottom fade */}
        <div
          className="absolute -bottom-6 left-0 right-0 h-8 pointer-events-none z-0"
          style={{ background: 'linear-gradient(to bottom, #0F1F3D, transparent)' }}
        />
      </div>

      {/* Community Switcher */}
      {hasMultipleHOAs && (
        <div className="px-4 pt-8">
          <ActiveCommunitySelector onAddCommunity={() => {}} />
        </div>
      )}

      {/* Body */}
      <div className={`px-4 ${hasMultipleHOAs ? 'pt-4' : 'pt-8'} pb-28`}>

        {/* Admin cancellation banners */}
        {cancelledBookings
          .filter(cb => !dismissedCancellations.has(cb.id))
          .map(cb => (
            <div
              key={cb.id}
              className="rounded-2xl p-3.5 mb-3 relative"
              style={{ background: '#FEF2F2', border: '1px solid #EF4444', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            >
              <button
                onClick={() => handleDismissCancellation(cb.id)}
                className="absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center rounded-xl"
                style={{ color: '#9CA3AF', background: 'rgba(239,68,68,0.08)' }}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-2.5 pr-10">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold" style={{ color: '#EF4444' }}>
                    Your {cb.amenityName} booking on {format(new Date(`${cb.date}T00:00:00`), 'MMM d')} at {formatTime12(cb.start_time)} was cancelled.
                  </div>
                  <Link
                    to="/reserve-court"
                    className="inline-block mt-1.5 text-[13px] font-bold"
                    style={{ color: '#00D4FF' }}
                  >
                    Book Again →
                  </Link>
                </div>
              </div>
            </div>
          ))
        }

        {/* CARD 1 — Upcoming Reservations */}
        <div style={cardStyle}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[16px] font-extrabold" style={{ color: '#0F1F3D' }}>Upcoming Reservations</span>
            {upcomingReservations.length > 0 && (
              <Link to="/book" className="text-[13px] font-bold" style={{ color: '#00D4FF' }}>View All →</Link>
            )}
          </div>
          {upcomingReservations.length === 0 ? (
            <div className="text-center py-5">
              <Calendar className="h-10 w-10 mx-auto mb-2" style={{ color: '#8892A4' }} />
              <p className="text-[13px] mb-3" style={{ color: '#8892A4' }}>No upcoming reservations</p>
              <Link
                to="/reserve-court"
                className="inline-block px-4 py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: '#00D4FF' }}
              >
                Book an Amenity
              </Link>
            </div>
          ) : (
            upcomingReservations.map((b, i) => (
              <div key={b.id} className={`flex items-center gap-3 ${i < upcomingReservations.length - 1 ? 'pb-3 mb-3 border-b' : ''}`} style={{ borderColor: 'rgba(15,31,61,0.08)' }}>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#00D4FF' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate" style={{ color: '#0F1F3D' }}>{b.amenityName}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: '#8892A4' }}>
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
            style={{ background: 'linear-gradient(135deg, #00D4FF 0%, #0091B5 100%)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="h-4 w-4 text-white flex-shrink-0" />
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
        <div style={cardStyle}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[16px] font-extrabold" style={{ color: '#0F1F3D' }}>Community Announcements</span>
            {announcements.length > 0 && (
              <span
                className="text-[13px] font-bold cursor-pointer"
                style={{ color: '#00D4FF' }}
                onClick={async () => {
                  if (showAllAnnouncements) {
                    setShowAllAnnouncements(false);
                    return;
                  }
                  if (allAnnouncements.length === 0 && activeHOA?.hoaId) {
                    const [announcementResponse, closedSurveysResponse] = await Promise.all([
                      supabase
                        .from('hoa_announcements')
                        .select('*')
                        .eq('hoa_id', activeHOA.hoaId)
                        .order('created_at', { ascending: false })
                        .limit(20),
                      supabase
                        .from('hoa_surveys')
                        .select('id, title, created_at, closes_at')
                        .eq('hoa_id', activeHOA.hoaId)
                        .eq('status', 'closed')
                        .eq('results_visibility', 'community')
                        .order('closes_at', { ascending: false })
                        .limit(20),
                    ]);

                    setAllAnnouncements(
                      mergeAnnouncementFeed(
                        announcementResponse.data || [],
                        closedSurveysResponse.data || []
                      ).slice(0, 20)
                    );
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
              <Megaphone className="h-10 w-10 mx-auto mb-2" style={{ color: '#8892A4' }} />
              <p className="text-[13px]" style={{ color: '#8892A4' }}>No announcements yet</p>
            </div>
          ) : (
            (showAllAnnouncements && allAnnouncements.length > 0 ? allAnnouncements : announcements).map((a, i, arr) => {
              const isExpanded = expandedAnnouncement === a.id;
              return (
                <div
                  key={a.id}
                  className={`cursor-pointer ${i < arr.length - 1 ? 'pb-3 mb-3 border-b' : ''}`}
                  style={{ borderColor: 'rgba(15,31,61,0.08)' }}
                  onClick={() => {
                    if (a.href) {
                      navigate(a.href);
                      return;
                    }
                    setExpandedAnnouncement(isExpanded ? null : a.id);
                  }}
                >
                  <div className="text-[13px] font-bold" style={{ color: '#0F1F3D' }}>{a.title}</div>
                  <div className={`text-[12px] mt-0.5 ${a.href ? 'truncate' : isExpanded ? '' : 'truncate'}`} style={{ color: '#8892A4' }}>
                    {a.href ? (
                      <>{a.body?.substring(0, 80)}{a.body?.length > 80 ? '…' : ''}</>
                    ) : isExpanded ? a.body : (
                      <>{a.body?.substring(0, 80)}{a.body?.length > 80 ? '…' : ''}</>
                    )}
                  </div>
                  {a.href && (
                    <div
                      className="mt-2 inline-flex items-center gap-1.5 px-3 rounded-xl text-[13px] font-bold"
                      style={{ color: '#00D4FF', background: '#E0F9FF', minHeight: 44 }}
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      View Results →
                    </div>
                  )}
                  <div className="text-[11px] mt-1" style={{ color: '#8892A4' }}>
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* CARD 4 — Community Events */}
        <div style={cardStyle}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[16px] font-extrabold" style={{ color: '#0F1F3D' }}>Community Events</span>
            {events.length > 0 && (
              <Link to="/community-calendar" className="text-[13px] font-bold" style={{ color: '#00D4FF' }}>View All →</Link>
            )}
          </div>
          {events.length === 0 ? (
            <div className="text-center py-5">
              <CalendarDays className="h-10 w-10 mx-auto mb-2" style={{ color: '#8892A4' }} />
              <p className="text-[13px]" style={{ color: '#8892A4' }}>No upcoming events</p>
            </div>
          ) : (
            events.map((e, i) => {
              const dt = new Date(e.starts_at);
              return (
                <div key={e.id} className={`flex items-center gap-3 ${i < events.length - 1 ? 'pb-3 mb-3 border-b' : ''}`} style={{ borderColor: 'rgba(15,31,61,0.08)' }}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#00D4FF' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: '#0F1F3D' }}>{e.title}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: '#8892A4' }}>
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
          <div style={cardStyle}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[16px] font-extrabold" style={{ color: '#0F1F3D' }}>My Open Reports</span>
              {myReportsCount > 3 && (
                <Link to="/my-reports" className="text-[13px] font-bold" style={{ color: '#00D4FF' }}>View All →</Link>
              )}
            </div>
            {myReports.map((r, i) => (
              <Link
                to="/my-reports"
                key={r.id}
                className={`flex items-center justify-between ${i < myReports.length - 1 ? 'pb-3 mb-3 border-b' : ''}`}
                style={{ borderColor: 'rgba(15,31,61,0.08)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold truncate" style={{ color: '#0F1F3D' }}>
                      {r.title || r.issue_type || 'Report'}
                    </span>
                    <span
                      className="text-[12px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: r.status === 'open' ? '#FFF5F5' : '#E0F9FF',
                        color: r.status === 'open' ? '#F97066' : '#00D4FF',
                      }}
                    >
                      {r.status === 'open' ? 'Open' : 'In Progress'}
                    </span>
                  </div>
                  {r.location && (
                    <div className="text-[12px] mt-0.5" style={{ color: '#8892A4' }}>{r.location}</div>
                  )}
                  <div className="text-[11px] mt-0.5" style={{ color: '#8892A4' }}>
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
