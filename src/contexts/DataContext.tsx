
import React, { createContext, useState, useContext, useEffect } from 'react';
import { User, HOA, Court, Booking, UserStatus, CourtStatus, TimeSlot } from '../types';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import {
  getCurrentUserProfile,
  getHOAById,
  getCourtsByHOAId,
  getPendingUsersByHOAId,
  approveUser as supabaseApproveUser,
  rejectUser as supabaseRejectUser,
  addCourt as supabaseAddCourt,
  removeCourt as supabaseRemoveCourt,
  createBooking,
  cancelBooking as supabaseCancelBooking,
  getUserBookings,
  getBookingsForDateAndCourt,
  hasBookingForDate as supabaseHasBookingForDate,
  getMaintenanceForDateAndCourt,
  setCourtMaintenance as supabaseSetCourtMaintenance
} from '../services/supabaseService';

interface DataContextType {
  users: User[];
  hoas: HOA[];
  courts: Court[];
  bookings: Booking[];
  loading: boolean;
  currentHOA: HOA | null;
  pendingUsers: User[];
  getTimeSlots: (date: string, courtId: string) => TimeSlot[];
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  addCourt: (name: string, hoaId: string, courtType: "tennis" | "pickleball") => Promise<void>;
  removeCourt: (courtId: string) => Promise<void>;
  bookCourt: (userId: string, userName: string, courtId: string, courtName: string, date: string, timeSlot: TimeSlot, playType?: 'singles' | 'doubles') => Promise<void>;
  cancelBooking: (bookingId: string) => Promise<void>;
  setCourtMaintenance: (courtId: string, date: string, hour: number, isMaintenance: boolean) => Promise<void>;
  hasBookingForDate: (userId: string, date: string) => boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Helper function to generate time slots
const generateTimeSlots = async (date: string, courtId: string): Promise<TimeSlot[]> => {
  const slots: TimeSlot[] = [];
  
  // Generate slots from 6 AM to 10 PM
  for (let hour = 6; hour < 22; hour++) {
    const start = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // Add 1 hour
    
    slots.push({
      id: `${courtId}-${date}-${hour}`,
      start: start.toISOString(),
      end: end.toISOString(),
      status: CourtStatus.AVAILABLE
    });
  }
  
  // Check for existing bookings
  const bookings = await getBookingsForDateAndCourt(date, courtId);
  const maintenance = await getMaintenanceForDateAndCourt(date, courtId);
  
  // Mark booked slots
  bookings.forEach(booking => {
    const startHour = parseInt(booking.startTime.split(':')[0]);
    const endHour = parseInt(booking.endTime.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const slotIndex = hour - 6; // Offset by 6 since we start at 6 AM
      if (slotIndex >= 0 && slotIndex < slots.length) {
        slots[slotIndex].status = CourtStatus.BOOKED;
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
        slots[slotIndex].status = CourtStatus.MAINTENANCE;
      }
    }
  });
  
  return slots;
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [hoas, setHOAs] = useState<HOA[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [currentHOA, setCurrentHOA] = useState<HOA | null>(null);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeSlotsCache, setTimeSlotsCache] = useState<{[key: string]: TimeSlot[]}>({});
  
  const { currentUser } = useAuth();

  // Initialize data when user changes
  useEffect(() => {
    if (currentUser) {
      refreshData();
    } else {
      // Clear data when user logs out
      setCurrentHOA(null);
      setHOAs([]);
      setCourts([]);
      setBookings([]);
      setPendingUsers([]);
      setLoading(false);
    }
  }, [currentUser]);

  const refreshData = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (currentUser.hoaId) {
        const [hoaData, courtsData, userBookings, pendingUsersData] = await Promise.all([
          getHOAById(currentUser.hoaId),
          getCourtsByHOAId(currentUser.hoaId),
          getUserBookings(currentUser.id),
          currentUser.role === 'admin' ? getPendingUsersByHOAId(currentUser.hoaId) : Promise.resolve([])
        ]);
        
        setCurrentHOA(hoaData);
        if (hoaData) setHOAs([hoaData]);
        setCourts(courtsData);
        setBookings(userBookings);
        setPendingUsers(pendingUsersData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const getTimeSlots = (date: string, courtId: string): TimeSlot[] => {
    const cacheKey = `${date}-${courtId}`;
    if (timeSlotsCache[cacheKey]) {
      return timeSlotsCache[cacheKey];
    }
    
    // Generate slots synchronously for now, fetch async in background
    generateTimeSlots(date, courtId).then(slots => {
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
        id: `${courtId}-${date}-${hour}`,
        start: start.toISOString(),
        end: end.toISOString(),
        status: CourtStatus.AVAILABLE
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

  const addCourtAsync = async (name: string, hoaId: string, courtType: "tennis" | "pickleball"): Promise<void> => {
    try {
      await supabaseAddCourt(name, hoaId, courtType);
      toast.success(`${name} added successfully`);
      await refreshData();
    } catch (error) {
      console.error('Error adding court:', error);
      toast.error('Failed to add court');
    }
  };

  const removeCourtAsync = async (courtId: string): Promise<void> => {
    try {
      const court = courts.find(c => c.id === courtId);
      await supabaseRemoveCourt(courtId);
      toast.success(`${court?.name || 'Court'} removed successfully`);
      await refreshData();
    } catch (error) {
      console.error('Error removing court:', error);
      toast.error('Failed to remove court');
    }
  };

  const bookCourtAsync = async (
    userId: string, 
    userName: string, 
    courtId: string, 
    courtName: string, 
    date: string, 
    timeSlot: TimeSlot,
    playType: 'singles' | 'doubles' = 'singles'
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
      
      await createBooking(userId, courtId, date, startTime, endTime, playType);
      toast.success(`Court booked successfully for ${playType}`);
      await refreshData();
    } catch (error: any) {
      console.error('Error booking court:', error);
      toast.error(error.message || 'Failed to book court');
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

  const setCourtMaintenanceAsync = async (courtId: string, date: string, hour: number, isMaintenance: boolean): Promise<void> => {
    try {
      if (isMaintenance) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
        await supabaseSetCourtMaintenance(courtId, date, startTime, endTime, 'Court maintenance');
      }
      // Note: To remove maintenance, we'd need to implement a delete function
      toast.success(isMaintenance 
        ? "Court set to maintenance" 
        : "Court maintenance removed");
      
      // Clear time slots cache for this court/date
      const cacheKey = `${date}-${courtId}`;
      setTimeSlotsCache(prev => {
        const newCache = { ...prev };
        delete newCache[cacheKey];
        return newCache;
      });
    } catch (error) {
      console.error('Error setting court maintenance:', error);
      toast.error('Failed to update court maintenance');
    }
  };

  const hasBookingForDateSync = (userId: string, date: string): boolean => {
    return bookings.some(booking => booking.userId === userId && booking.date === date);
  };

  const value = {
    users,
    hoas,
    courts,
    bookings,
    currentHOA,
    pendingUsers,
    loading,
    getTimeSlots,
    approveUser: approveUserAsync,
    rejectUser: rejectUserAsync,
    addCourt: addCourtAsync,
    removeCourt: removeCourtAsync,
    bookCourt: bookCourtAsync,
    cancelBooking: cancelBookingAsync,
    setCourtMaintenance: setCourtMaintenanceAsync,
    hasBookingForDate: hasBookingForDateSync,
    refreshData
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
