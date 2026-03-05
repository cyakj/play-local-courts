import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useActiveHOA } from '../contexts/ActiveHOAContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PendingApprovalMessage from '../components/PendingApprovalMessage';
import { ActiveCommunitySelector } from '@/components/community/ActiveCommunitySelector';
import { AdminQuickOverview } from '@/components/dashboard';
import { UserType } from '../types';
import { TENNIS_FEATURES_ENABLED } from '@/config/featureFlags';
import { 
  Calendar, 
  CalendarCheck, 
  Wrench,
  Clock,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Megaphone,
  ClipboardList,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { currentUser, isAdmin, isPending, isCoach, isPlatformReviewer } = useAuth();
  const { toast } = useToast();
  const { activeHOA, hasMultipleHOAs } = useActiveHOA();
  const { bookings, loading } = useData();
  const [myReportsCount, setMyReportsCount] = useState({ open: 0, in_progress: 0 });

  useEffect(() => {
    loadReportCounts();
  }, [currentUser, activeHOA?.hoaId]);

  const loadReportCounts = async () => {
    if (!currentUser || !activeHOA?.hoaId) return;
    try {
      const { data, error } = await supabase
        .from('maintenance_reports')
        .select('status')
        .eq('reporter_id', currentUser.id)
        .eq('hoa_id', activeHOA.hoaId)
        .in('status', ['open', 'in_progress']);

      if (!error && data) {
        setMyReportsCount({
          open: data.filter(r => r.status === 'open').length,
          in_progress: data.filter(r => r.status === 'in_progress').length,
        });
      }
    } catch (error) {
      console.error('Error loading report counts:', error);
    }
  };

  // Redirect platform reviewers
  if (isPlatformReviewer) {
    return <Navigate to="/reviewer/dashboard" replace />;
  }

  // Redirect coaches when tennis features enabled
  if (TENNIS_FEATURES_ENABLED && isCoach) {
    return <Navigate to="/coach-dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
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
          <Button asChild>
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  const firstName = currentUser.fullName?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Upcoming reservations
  const now = new Date();
  const upcomingReservations = bookings
    .filter(booking => new Date(`${booking.date}T${booking.startTime}`) > now)
    .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime())
    .slice(0, 2);

  const totalOpenReports = myReportsCount.open + myReportsCount.in_progress;

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);
      
      if (error) throw error;
      toast({ title: 'Booking cancelled', description: 'Your reservation has been cancelled.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to cancel booking', variant: 'destructive' });
    }
  };

  const formatTime12Hour = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-6 animate-fade-scale">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {firstName}
          {activeHOA && <span className="text-muted-foreground font-normal"> — {activeHOA.hoaName}</span>}
        </h1>
      </div>

      {/* Community Switcher */}
      {hasMultipleHOAs && (
        <ActiveCommunitySelector onAddCommunity={() => {}} />
      )}

      {/* Admin Overview - for HOA admins */}
      {isAdmin && <AdminQuickOverview />}

      {/* Upcoming Reservations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Upcoming Reservations
            </div>
            {upcomingReservations.length > 0 && (
              <Link to="/upcoming" className="text-sm font-medium text-primary hover:underline">
                View All
              </Link>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {upcomingReservations.length > 0 ? (
            upcomingReservations.map((booking, index) => {
              const bookingDate = new Date(`${booking.date}T00:00:00`);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const isToday = bookingDate.getTime() === today.getTime();
              const isTomorrow = bookingDate.getTime() === tomorrow.getTime();
              const dateLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : format(bookingDate, 'EEE, MMM d');

              return (
                <div
                  key={booking.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all",
                    index === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className={cn("font-semibold", index === 0 ? "text-lg" : "text-sm")}>
                        {booking.amenityName}
                      </p>
                      <div className={cn(
                        "flex items-center gap-3 mt-1 text-xs",
                        index === 0 ? "text-primary-foreground/80" : "text-muted-foreground"
                      )}>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {dateLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime12Hour(booking.startTime)} – {formatTime12Hour(booking.endTime)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant={index === 0 ? "secondary" : "outline"}
                      size="sm"
                      className="text-xs h-8 min-h-[44px]"
                      onClick={() => handleCancelBooking(booking.id)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No upcoming reservations</p>
              <Button asChild size="sm">
                <Link to="/reserve-court">Book an Amenity</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Community Announcements - placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Community Announcements
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-center py-6">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No announcements yet</p>
          </div>
        </CardContent>
      </Card>

      {/* My Reports Summary */}
      <Link to="/my-reports">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">My Reports</p>
                  {totalOpenReports > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {totalOpenReports} open report{totalOpenReports !== 1 ? 's' : ''}
                      {myReportsCount.in_progress > 0 && ` — ${myReportsCount.in_progress} in progress`}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No open reports</p>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button asChild className="h-14 rounded-xl text-sm font-semibold" variant="default">
          <Link to="/reserve-court" className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" />
            Book Amenity
          </Link>
        </Button>
        <Button asChild className="h-14 rounded-xl text-sm font-semibold" variant="outline">
          <Link to="/my-reports" className="flex items-center gap-2" onClick={(e) => {
            // Will navigate to reports and user can click Report New Issue there
          }}>
            <Wrench className="h-5 w-5" />
            Report Issue
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default Dashboard;
