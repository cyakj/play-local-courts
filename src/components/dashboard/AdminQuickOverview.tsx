import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { useData } from '@/contexts/DataContext';
import { 
  Shield, 
  UserCheck,
  Wrench,
  Calendar,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminStats {
  pendingApprovals: number;
  openMaintenanceIssues: number;
  todayBookings: number;
  amenitiesInMaintenance: number;
}

export const AdminQuickOverview = () => {
  const { currentUser, isAdmin } = useAuth();
  const { activeHOA } = useActiveHOA();
  const { pendingUsers, amenities } = useData();
  const [stats, setStats] = useState<AdminStats>({
    pendingApprovals: 0,
    openMaintenanceIssues: 0,
    todayBookings: 0,
    amenitiesInMaintenance: 0
  });

  useEffect(() => {
    if (currentUser && isAdmin && activeHOA) {
      loadAdminStats();
    }
  }, [currentUser, isAdmin, activeHOA, pendingUsers]);

  const loadAdminStats = async () => {
    if (!activeHOA) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Count open maintenance issues
      const { count: maintenanceCount } = await supabase
        .from('maintenance_reports')
        .select('id', { count: 'exact' })
        .eq('hoa_id', activeHOA.hoaId)
        .in('status', ['submitted', 'in_review', 'in_progress']);

      // Count today's bookings
      const { count: bookingCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact' })
        .eq('date', today)
        .eq('status', 'confirmed');

      // Count amenities in maintenance
      const { count: maintenanceAmenities } = await supabase
        .from('court_maintenance')
        .select('id', { count: 'exact' })
        .eq('date', today);

      setStats({
        pendingApprovals: pendingUsers.length,
        openMaintenanceIssues: maintenanceCount || 0,
        todayBookings: bookingCount || 0,
        amenitiesInMaintenance: maintenanceAmenities || 0
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card className="overflow-hidden border-orange-200">
      <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-red-50">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-600" />
          Admin Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Link to="/pending-requests" className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-orange-600" />
              <span className="text-2xl font-bold">{stats.pendingApprovals}</span>
            </div>
            <div className="text-xs text-muted-foreground">Pending Approvals</div>
          </Link>

          <Link to="/maintenance-reports" className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-orange-600" />
              <span className="text-2xl font-bold">{stats.openMaintenanceIssues}</span>
            </div>
            <div className="text-xs text-muted-foreground">Open Issues</div>
          </Link>

          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-2xl font-bold">{stats.todayBookings}</span>
            </div>
            <div className="text-xs text-muted-foreground">Today's Bookings</div>
          </div>

          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-2xl font-bold">{stats.amenitiesInMaintenance}</span>
            </div>
            <div className="text-xs text-muted-foreground">In Maintenance</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to="/admin" className="flex items-center gap-1">
              Admin Hub
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link to="/manage-courts" className="flex items-center gap-1">
              Amenities
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
