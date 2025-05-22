
import React, { createContext, useState, useContext, useEffect } from 'react';
import { User, HOA, Court, Booking, UserStatus, CourtStatus, TimeSlot } from '../types';
import { mockUsers, mockHOAs, mockCourts, mockBookings, generateTimeSlots } from '../services/mockDataService';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface DataContextType {
  users: User[];
  hoas: HOA[];
  courts: Court[];
  bookings: Booking[];
  getHOAById: (id: string) => HOA | undefined;
  getCourtsByHOAId: (hoaId: string) => Court[];
  getPendingUsersByHOAId: (hoaId: string) => User[];
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  addCourt: (name: string, hoaId: string, courtType: "tennis" | "pickleball") => void;
  removeCourt: (courtId: string) => void;
  bookCourt: (userId: string, userName: string, courtId: string, courtName: string, date: string, timeSlot: TimeSlot) => void;
  cancelBooking: (bookingId: string) => void;
  getUserBookings: (userId: string) => Booking[];
  getTimeSlots: (date: string, courtId: string) => TimeSlot[];
  setCourtMaintenance: (courtId: string, date: string, hour: number, isMaintenance: boolean) => void;
  hasBookingForDate: (userId: string, date: string) => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([...mockUsers]);
  const [hoas, setHOAs] = useState<HOA[]>([...mockHOAs]);
  const [courts, setCourts] = useState<Court[]>([...mockCourts]);
  const [bookings, setBookings] = useState<Booking[]>([...mockBookings]);
  const [timeSlots, setTimeSlots] = useState<Record<string, TimeSlot[]>>({});
  const { currentUser } = useAuth();

  // Initialize time slots for today and next 7 days
  useEffect(() => {
    const newTimeSlots: Record<string, TimeSlot[]> = {};
    const today = new Date();
    
    // Generate time slots for next 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      courts.forEach(court => {
        const key = `${dateString}-${court.id}`;
        newTimeSlots[key] = generateTimeSlots(dateString, court.id);
      });
    }
    
    setTimeSlots(newTimeSlots);
  }, [courts]);

  // Helper functions
  const getHOAById = (id: string) => hoas.find(h => h.id === id);
  
  const getCourtsByHOAId = (hoaId: string) => courts.filter(c => c.hoaId === hoaId);
  
  const getPendingUsersByHOAId = (hoaId: string) => 
    users.filter(u => u.hoaId === hoaId && u.status === UserStatus.PENDING);

  const approveUser = (userId: string) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userId 
          ? { ...user, status: UserStatus.APPROVED } 
          : user
      )
    );
    toast.success("User approved successfully");
  };

  const rejectUser = (userId: string) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userId 
          ? { ...user, status: UserStatus.REJECTED } 
          : user
      )
    );
    toast.success("User rejected");
  };

  const addCourt = (name: string, hoaId: string, courtType: "tennis" | "pickleball") => {
    const newCourt: Court = {
      id: `court${courts.length + 1}`,
      name,
      hoaId,
      courtType,
    };
    setCourts(prev => [...prev, newCourt]);
    toast.success(`${name} added successfully`);
  };

  const removeCourt = (courtId: string) => {
    const courtName = courts.find(c => c.id === courtId)?.name;
    setCourts(prev => prev.filter(court => court.id !== courtId));
    
    // Remove all bookings for this court
    setBookings(prev => prev.filter(booking => booking.courtId !== courtId));
    toast.success(`${courtName || 'Court'} removed successfully`);
  };

  const getTimeSlots = (date: string, courtId: string): TimeSlot[] => {
    const key = `${date}-${courtId}`;
    if (!timeSlots[key]) {
      // Generate time slots if they don't exist
      const newSlots = generateTimeSlots(date, courtId);
      setTimeSlots(prev => ({ ...prev, [key]: newSlots }));
      return newSlots;
    }
    return timeSlots[key];
  };

  const bookCourt = (userId: string, userName: string, courtId: string, courtName: string, date: string, timeSlot: TimeSlot) => {
    // Check if user already has a booking for this date
    const hasBooking = hasBookingForDate(userId, date);
    
    if (hasBooking) {
      toast.error("You already have a booking for this date");
      return;
    }

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      userId,
      userName,
      courtId,
      courtName,
      date,
      timeSlot: {
        ...timeSlot,
        status: CourtStatus.BOOKED
      },
      createdAt: new Date().toISOString()
    };
    
    setBookings(prev => [...prev, newBooking]);
    
    // Update time slot status
    const key = `${date}-${courtId}`;
    setTimeSlots(prev => ({
      ...prev,
      [key]: prev[key]?.map(slot => 
        slot.id === timeSlot.id 
          ? { ...slot, status: CourtStatus.BOOKED } 
          : slot
      ) || []
    }));
    
    toast.success("Court booked successfully");
  };

  const cancelBooking = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    
    if (booking) {
      // Update time slot status
      const key = `${booking.date}-${booking.courtId}`;
      setTimeSlots(prev => ({
        ...prev,
        [key]: prev[key]?.map(slot => 
          slot.id === booking.timeSlot.id 
            ? { ...slot, status: CourtStatus.AVAILABLE } 
            : slot
        ) || []
      }));
      
      // Remove booking
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      toast.success("Booking canceled successfully");
    }
  };

  const getUserBookings = (userId: string) => bookings.filter(b => b.userId === userId);

  const setCourtMaintenance = (courtId: string, date: string, hour: number, isMaintenance: boolean) => {
    const key = `${date}-${courtId}`;
    
    setTimeSlots(prev => ({
      ...prev,
      [key]: prev[key]?.map(slot => {
        const slotHour = new Date(slot.start).getHours();
        if (slotHour === hour) {
          return { 
            ...slot, 
            status: isMaintenance ? CourtStatus.MAINTENANCE : CourtStatus.AVAILABLE 
          };
        }
        return slot;
      }) || []
    }));
    
    toast.success(isMaintenance 
      ? "Court set to maintenance" 
      : "Court maintenance removed");
  };

  const hasBookingForDate = (userId: string, date: string) => {
    return bookings.some(b => b.userId === userId && b.date === date);
  };

  const value = {
    users,
    hoas,
    courts,
    bookings,
    getHOAById,
    getCourtsByHOAId,
    getPendingUsersByHOAId,
    approveUser,
    rejectUser,
    addCourt,
    removeCourt,
    bookCourt,
    cancelBooking,
    getUserBookings,
    getTimeSlots,
    setCourtMaintenance,
    hasBookingForDate
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
