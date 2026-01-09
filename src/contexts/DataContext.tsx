
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { User, HOA, Amenity, Booking, UserStatus, AmenityStatus, TimeSlot } from '../types';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import {
  getCurrentUserProfile,
  getHOAById,
  getAmenitiesByHOAId,
  getPendingUsersByHOAId,
  approveUser as supabaseApproveUser,
  rejectUser as supabaseRejectUser,
  addAmenity as supabaseAddAmenity,
  removeAmenity as supabaseRemoveAmenity,
  createBooking,
  cancelBooking as supabaseCancelBooking,
  getUserBookings,
  getBookingsForDateAndAmenity,
  hasBookingForDate as supabaseHasBookingForDate,
  getMaintenanceForDateAndAmenity,
  setAmenityMaintenance as supabaseSetAmenityMaintenance
} from '../services/supabaseService';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface DataContextType {
  users: User[];
  hoas: HOA[];
  amenities: Amenity[];
  bookings: Booking[];
  loading: boolean;
  currentHOA: HOA | null;
  pendingUsers: User[];
  getTimeSlots: (date: string, amenityId: string) => TimeSlot[];
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  addAmenity: (name: string, hoaId: string, amenityType: Amenity['amenityType']) => Promise<void>;
  removeAmenity: (amenityId: string) => Promise<void>;
  bookAmenity: (userId: string, userName: string, amenityId: string, amenityName: string, date: string, timeSlot: TimeSlot, playType?: 'singles' | 'doubles' | 'family' | 'group') => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
  setAmenityMaintenance: (amenityId: string, date: string, hour: number, isMaintenance: boolean) => Promise<void>;
  hasBookingForDate: (userId: string, date: string) => boolean;
  refreshData: () => Promise<void>;
  // Legacy support
  courts: Amenity[];
  addCourt: (name: string, hoaId: string, courtType: "tennis" | "pickleball") => Promise<void>;
  removeCourt: (courtId: string) => Promise<void>;
  bookCourt: (userId: string, userName: string, courtId: string, courtName: string, date: string, timeSlot: TimeSlot, playType?: 'singles' | 'doubles') => Promise<void>;
  setCourtMaintenance: (courtId: string, date: string, hour: number, isMaintenance: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper function to generate time slots
const generateTimeSlots = async (date: string, amenityId: string): Promise<TimeSlot[]> => {
  const slots: TimeSlot[] = [];
  
  // Generate slots from 6 AM to 10 PM
  for (let hour = 6; hour < 22; hour++) {
    const start = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // Add 1 hour
    
    slots.push({
      id: `${amenityId}-${date}-${hour}`,
      start: start.toISOString(),
      end: end.toISOString(),
      status: AmenityStatus.AVAILABLE
    });
  }
  
  // Check for existing bookings
  const bookings = await getBookingsForDateAndAmenity(date, amenityId);
  const maintenance = await getMaintenanceForDateAndAmenity(date, amenityId);
  
  // Mark booked slots
  bookings.forEach(booking => {
    const startHour = parseInt(booking.startTime.split(':')[0]);
    const endHour = parseInt(booking.endTime.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const slotIndex = hour - 6; // Offset by 6 since we start at 6 AM
      if (slotIndex >= 0 && slotIndex < slots.length) {
        slots[slotIndex].status = AmenityStatus.BOOKED;
      }
    }
  });
  
  // Mark maintenance slots
  maintenance.forEach(maint => {
    const startHour = parseInt(maint.start_time.split(':')[0]);
    const endHour = parseInt(maint.end_time.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const slotIndex = hour - 6;
      if (slotIndex >= 0 && slotIndex < slots.length) {
        slots[slotIndex].status = AmenityStatus.MAINTENANCE;
      }
    }
  });
  
  return slots;
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [hoas, setHOAs] = useState<HOA[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentHOA, setCurrentHOA] = useState<HOA | null>(null);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeSlotsCache, setTimeSlotsCache] = useState<{[key: string]: TimeSlot[]}>({});
  
  const { currentUser } = useAuth();

  const refreshDataCallback = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (currentUser.hoaId) {
        const [hoaData, amenitiesData, userBookings, pendingUsersData] = await Promise.all([
          getHOAById(currentUser.hoaId),
          getAmenitiesByHOAId(currentUser.hoaId),
          getUserBookings(currentUser.id),
          currentUser.role === 'admin' ? getPendingUsersByHOAId(currentUser.hoaId) : Promise.resolve([])
        ]);
        
        setCurrentHOA(hoaData);
        if (hoaData) setHOAs([hoaData]);
        setAmenities(amenitiesData);
        setBookings(userBookings);
        setPendingUsers(pendingUsersData);
        
        // Clear time slots cache when data refreshes
        setTimeSlotsCache({});
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const refreshPendingUsersCallback = useCallback(async () => {
    if (!currentUser?.id || currentUser.role !== 'admin' || !currentUser.hoaId) return;

    try {
      const pendingUsersData = await getPendingUsersByHOAId(currentUser.hoaId);
      setPendingUsers(pendingUsersData);
    } catch (error) {
      console.error('Error loading pending users:', error);
    }
  }, [currentUser?.id, currentUser?.role, currentUser?.hoaId]);

  // Real-time subscription for booking updates
  useRealtimeSubscription({
    table: 'bookings',
    event: '*',
    onChange: refreshDataCallback,
    enabled: !!currentUser?.id
  });

  // Real-time subscription for court maintenance updates
  useRealtimeSubscription({
    table: 'court_maintenance',
    event: '*',
    onChange: () => {
      // Clear cache and refresh when maintenance changes
      setTimeSlotsCache({});
      refreshDataCallback();
    },
    enabled: !!currentUser?.id
  });

  // Real-time subscription for join request / membership updates (admin pending approvals)
  useRealtimeSubscription({
    table: 'community_join_requests',
    event: '*',
    filter: currentUser?.hoaId ? `hoa_id=eq.${currentUser.hoaId}` : undefined,
    onChange: () => {
      refreshPendingUsersCallback();
    },
    enabled: !!currentUser?.id && currentUser.role === 'admin' && !!currentUser.hoaId
  });

  useRealtimeSubscription({
    table: 'hoa_memberships',
    event: '*',
    filter: currentUser?.hoaId ? `hoa_id=eq.${currentUser.hoaId}` : undefined,
    onChange: () => {
      refreshPendingUsersCallback();
    },
    enabled: !!currentUser?.id && currentUser.role === 'admin' && !!currentUser.hoaId
  });

  useRealtimeSubscription({
    table: 'profiles',
    event: 'UPDATE',
    filter: currentUser?.hoaId ? `hoa_id=eq.${currentUser.hoaId}` : undefined,
    onChange: () => {
      refreshPendingUsersCallback();
    },
    enabled: !!currentUser?.id && currentUser.role === 'admin' && !!currentUser.hoaId
  });

  // Initialize data when user changes
  useEffect(() => {
    if (currentUser) {
      refreshDataCallback();
    } else {
      // Clear data when user logs out
      setCurrentHOA(null);
      setHOAs([]);
      setAmenities([]);
      setBookings([]);
      setPendingUsers([]);
      setLoading(false);
    }
  }, [currentUser, refreshDataCallback]);

  const refreshData = refreshDataCallback;

  // Helper functions
  const getTimeSlots = (date: string, amenityId: string): TimeSlot[] => {
    const cacheKey = `${date}-${amenityId}`;
    if (timeSlotsCache[cacheKey]) {
      return timeSlotsCache[cacheKey];
    }
    
    // Generate slots synchronously for now, fetch async in background
    generateTimeSlots(date, amenityId).then(slots => {
      setTimeSlotsCache(prev => ({
        ...prev,
        [cacheKey]: slots
      }));
    });
    
    // Return basic available slots immediately
    const slots: TimeSlot[] = [];
    for (let hour = 6; hour < 22; hour++) {
      const start = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      
      slots.push({
        id: `${amenityId}-${date}-${hour}`,
        start: start.toISOString(),
        end: end.toISOString(),
        status: AmenityStatus.AVAILABLE
      });
    }
    
    return slots;
  };

  const approveUserAsync = async (userId: string): Promise<void> => {
    try {
      await supabaseApproveUser(userId);
      toast.success("User approved successfully");
      await refreshData();
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Failed to approve user');
    }
  };

  const rejectUserAsync = async (userId: string): Promise<void> => {
    try {
      await supabaseRejectUser(userId);
      toast.success("User rejected");
      await refreshData();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('Failed to reject user');
    }
  };

  const addAmenityAsync = async (name: string, hoaId: string, amenityType: Amenity['amenityType']): Promise<void> => {
    try {
      await supabaseAddAmenity(name, hoaId, amenityType);
      toast.success(`${name} added successfully`);
      await refreshData();
    } catch (error) {
      console.error('Error adding amenity:', error);
      toast.error('Failed to add amenity');
    }
  };

  const removeAmenityAsync = async (amenityId: string): Promise<void> => {
    try {
      const amenity = amenities.find(a => a.id === amenityId);
      await supabaseRemoveAmenity(amenityId);
      toast.success(`${amenity?.name || 'Amenity'} removed successfully`);
      await refreshData();
    } catch (error) {
      console.error('Error removing amenity:', error);
      toast.error('Failed to remove amenity');
    }
  };

  const bookAmenityAsync = async (
    userId: string, 
    userName: string, 
    amenityId: string, 
    amenityName: string, 
    date: string, 
    timeSlot: TimeSlot,
    playType: 'singles' | 'doubles' | 'family' | 'group' = 'singles'
  ): Promise<void> => {
    try {
      // Check if user already has a booking for this date
      const hasBooking = await supabaseHasBookingForDate(userId, date);
      
      if (hasBooking) {
        toast.error("You already have a booking for this date");
        return;
      }

      const startTime = new Date(timeSlot.start).toTimeString().split(' ')[0].substring(0, 5);
      const endTime = new Date(timeSlot.end).toTimeString().split(' ')[0].substring(0, 5);
      
      // TODO: Add validation against amenity rules here
      // - Check if booking time is within allowed window
      // - Check if duration respects max duration
      // - Check if user has exceeded daily/weekly limits
      // - Check if booking respects advance booking window
      // - Check other rule constraints
      
      await createBooking(userId, amenityId, date, startTime, endTime, playType);
      toast.success(`${amenityName} booked successfully for ${playType}`);
      await refreshData();
    } catch (error: any) {
      console.error('Error booking amenity:', error);
      toast.error(error.message || 'Failed to book amenity');
    }
  };

  const cancelBookingAsync = async (bookingId: string): Promise<void> => {
    try {
      await supabaseCancelBooking(bookingId);
      toast.success("Booking canceled successfully");
      await refreshData();
    } catch (error) {
      console.error('Error canceling booking:', error);
      toast.error('Failed to cancel booking');
    }
  };

  const setAmenityMaintenanceAsync = async (amenityId: string, date: string, hour: number, isMaintenance: boolean): Promise<void> => {
    try {
      if (isMaintenance) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
        await supabaseSetAmenityMaintenance(amenityId, date, startTime, endTime, 'Amenity maintenance');
      }
      toast.success(isMaintenance 
        ? "Amenity set to maintenance" 
        : "Amenity maintenance removed");
      
      // Clear time slots cache for this amenity/date
      const cacheKey = `${date}-${amenityId}`;
      setTimeSlotsCache(prev => {
        const newCache = { ...prev };
        delete newCache[cacheKey];
        return newCache;
      });
    } catch (error) {
      console.error('Error setting amenity maintenance:', error);
      toast.error('Failed to update amenity maintenance');
    }
  };

  const hasBookingForDateSync = (userId: string, date: string): boolean => {
    return bookings.some(booking => booking.userId === userId && booking.date === date);
  };

  const value = {
    users,
    hoas,
    amenities,
    bookings,
    currentHOA,
    pendingUsers,
    loading,
    getTimeSlots,
    approveUser: approveUserAsync,
    rejectUser: rejectUserAsync,
    addAmenity: addAmenityAsync,
    removeAmenity: removeAmenityAsync,
    bookAmenity: bookAmenityAsync,
    cancelBooking: cancelBookingAsync,
    setAmenityMaintenance: setAmenityMaintenanceAsync,
    hasBookingForDate: hasBookingForDateSync,
    refreshData,
    // Legacy support for courts
    courts: amenities.filter(a => a.amenityType === 'tennis' || a.amenityType === 'pickleball'),
    addCourt: (name: string, hoaId: string, courtType: "tennis" | "pickleball") => addAmenityAsync(name, hoaId, courtType),
    removeCourt: removeAmenityAsync,
    bookCourt: bookAmenityAsync,
    setCourtMaintenance: setAmenityMaintenanceAsync
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
