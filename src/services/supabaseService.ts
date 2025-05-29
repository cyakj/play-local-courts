import { supabase } from '@/integrations/supabase/client';
import { User, HOA, Court, Booking, UserRole, UserStatus, ProfileRow, HOARow, CourtRow, BookingRow } from '../types';

// Helper functions to transform database rows to app types
const transformProfileToUser = (profile: any, userEmail?: string): User => ({
  id: profile.id,
  fullName: profile.full_name,
  email: userEmail || '', // Use userEmail parameter or empty string
  phoneNumber: profile.phone_number,
  dateOfBirth: profile.date_of_birth,
  role: profile.hoa_role as UserRole,
  status: profile.hoa_status as UserStatus,
  hoaId: profile.hoa_id || '',
  createdAt: profile.created_at
});

const transformHOARow = (hoa: HOARow): HOA => ({
  id: hoa.id,
  name: hoa.name,
  address: hoa.address,
  phone: hoa.phone,
  email: hoa.email,
  adminId: hoa.admin_id,
  createdAt: hoa.created_at
});

const transformCourtRow = (court: CourtRow): Court => ({
  id: court.id,
  name: court.name,
  hoaId: court.hoa_id,
  courtType: court.court_type as "tennis" | "pickleball",
  createdAt: court.created_at
});

const transformBookingRow = (booking: any): Booking => ({
  id: booking.id,
  userId: booking.user_id,
  userName: booking.profiles?.full_name || 'Unknown User',
  courtId: booking.court_id,
  courtName: booking.courts?.name || 'Unknown Court',
  date: booking.date,
  startTime: booking.start_time,
  endTime: booking.end_time,
  playType: booking.play_type as 'singles' | 'doubles',
  status: booking.status as 'confirmed' | 'cancelled',
  createdAt: booking.created_at
});

// User/Profile operations
export const getCurrentUserProfile = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) return null;
  
  // Pass the email from the auth user to the transform function
  return transformProfileToUser(profile, user.email);
};

export const updateUserProfile = async (userId: string, updates: any): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;
};

// HOA operations
export const getHOAById = async (hoaId: string): Promise<HOA | null> => {
  const { data, error } = await supabase
    .from('hoas')
    .select('*')
    .eq('id', hoaId)
    .single();

  if (error || !data) return null;
  return transformHOARow(data);
};

export const getPendingUsersByHOAId = async (hoaId: string): Promise<User[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('hoa_id', hoaId)
    .eq('hoa_status', 'pending');

  if (error || !data) return [];
  return data.map(profile => transformProfileToUser(profile));
};

export const approveUser = async (userId: string): Promise<void> => {
  await updateUserProfile(userId, { hoa_status: 'approved' });
};

export const rejectUser = async (userId: string): Promise<void> => {
  await updateUserProfile(userId, { hoa_status: 'rejected' });
};

// Court operations
export const getCourtsByHOAId = async (hoaId: string): Promise<Court[]> => {
  const { data, error } = await supabase
    .from('courts')
    .select('*')
    .eq('hoa_id', hoaId);

  if (error || !data) return [];
  return data.map(transformCourtRow);
};

export const addCourt = async (name: string, hoaId: string, courtType: "tennis" | "pickleball"): Promise<void> => {
  const { error } = await supabase
    .from('courts')
    .insert({
      name,
      hoa_id: hoaId,
      court_type: courtType
    });

  if (error) throw error;
};

export const removeCourt = async (courtId: string): Promise<void> => {
  const { error } = await supabase
    .from('courts')
    .delete()
    .eq('id', courtId);

  if (error) throw error;
};

// Booking operations
export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      courts(name),
      profiles(full_name)
    `)
    .eq('user_id', userId)
    .eq('status', 'confirmed');

  if (error || !data) return [];
  
  return data.map(transformBookingRow);
};

export const createBooking = async (
  userId: string,
  courtId: string,
  date: string,
  startTime: string,
  endTime: string,
  playType: 'singles' | 'doubles' = 'singles'
): Promise<void> => {
  // Check if user already has a booking for this date
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('status', 'confirmed');

  if (existingBookings && existingBookings.length > 0) {
    throw new Error('You already have a booking for this date');
  }

  const { error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      court_id: courtId,
      date,
      start_time: startTime,
      end_time: endTime,
      play_type: playType,
      status: 'confirmed'
    });

  if (error) throw error;
};

export const cancelBooking = async (bookingId: string): Promise<void> => {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId);

  if (error) throw error;
};

export const getBookingsForDateAndCourt = async (date: string, courtId: string): Promise<Booking[]> => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      courts(name),
      profiles(full_name)
    `)
    .eq('court_id', courtId)
    .eq('date', date)
    .eq('status', 'confirmed');

  if (error || !data) return [];
  
  return data.map(transformBookingRow);
};

export const hasBookingForDate = async (userId: string, date: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .eq('status', 'confirmed')
    .limit(1);

  if (error) return false;
  return data && data.length > 0;
};

// Court maintenance operations
export const setCourtMaintenance = async (
  courtId: string,
  date: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<void> => {
  const { error } = await supabase
    .from('court_maintenance')
    .insert({
      court_id: courtId,
      date,
      start_time: startTime,
      end_time: endTime,
      description
    });

  if (error) throw error;
};

export const getMaintenanceForDateAndCourt = async (date: string, courtId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('court_maintenance')
    .select('*')
    .eq('court_id', courtId)
    .eq('date', date);

  if (error || !data) return [];
  return data;
};
