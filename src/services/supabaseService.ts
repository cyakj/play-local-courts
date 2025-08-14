import { supabase } from '@/integrations/supabase/client';
import { User, HOA, Amenity, Booking, UserRole, UserStatus, UserType, ProfileRow, HOARow, AmenityRow, BookingRow } from '../types';
import { shouldSendEmail } from './emailService';

// Helper functions to transform database rows to app types
const transformProfileToUser = (profile: any, userEmail?: string): User => ({
  id: profile.id,
  fullName: profile.full_name || 'Unknown User',
  email: userEmail || profile.email || '',
  phoneNumber: profile.phone_number,
  dateOfBirth: profile.date_of_birth,
  role: profile.hoa_role as UserRole,
  status: profile.hoa_status as UserStatus,
  hoaId: profile.hoa_id || undefined,
  userType: (profile.user_type === 'coach' ? UserType.COACH : 
           profile.user_type === 'non_hoa' ? UserType.NON_HOA : UserType.HOA),
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

const transformAmenityRow = (amenity: AmenityRow): Amenity => ({
  id: amenity.id,
  name: amenity.name,
  hoaId: amenity.hoa_id,
  amenityType: amenity.amenity_type as Amenity['amenityType'],
  createdAt: amenity.created_at
});

const transformBookingRow = (booking: any, userName?: string, amenityName?: string): Booking => ({
  id: booking.id,
  userId: booking.user_id,
  userName: userName || 'Unknown User',
  amenityId: booking.amenity_id || booking.court_id, // Support both field names
  amenityName: amenityName || 'Unknown Amenity',
  date: booking.date,
  startTime: booking.start_time,
  endTime: booking.end_time,
  playType: booking.play_type as 'singles' | 'doubles' | 'family' | 'group',
  status: booking.status as 'confirmed' | 'cancelled',
  createdAt: booking.created_at
});

// User/Profile operations
export const getCurrentUserProfile = async (): Promise<User | null> => {
  console.log('Getting current user profile...');
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('No authenticated user found');
    return null;
  }

  console.log('Authenticated user found:', user.id);

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  if (!profile) {
    console.log('No profile found for user:', user.id);
    return null;
  }
  
  console.log('Profile fetched successfully:', profile);
  return transformProfileToUser(profile, user.email);
};

export const getAllHOAs = async (): Promise<HOA[]> => {
  console.log('Fetching all HOAs...');
  
  // First try to check if we can access the table
  const { count, error: countError } = await supabase
    .from('hoas')
    .select('*', { count: 'exact', head: true });

  console.log('HOA table count check:', { count, countError });

  const { data, error } = await supabase
    .from('hoas')
    .select('*');

  console.log('Raw Supabase response:', { data, error });

  if (error) {
    console.error('Error fetching HOAs:', error);
    console.error('Error details:', error.message, error.code, error.details);
    
    // Check if it's a permissions error
    if (error.code === 'PGRST116' || error.message?.includes('permission denied')) {
      console.error('Possible RLS issue - table may need public read policy');
    }
    
    return [];
  }

  if (!data) {
    console.log('No HOA data returned from database');
    return [];
  }

  console.log('Raw HOA data from database:', data);
  console.log('Number of HOAs returned:', data.length);
  
  const transformedHOAs = data.map(transformHOARow);
  console.log('Transformed HOAs:', transformedHOAs);
  
  return transformedHOAs;
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

// Amenity operations
export const getAmenitiesByHOAId = async (hoaId: string): Promise<Amenity[]> => {
  const { data, error } = await supabase
    .from('courts')
    .select('*')
    .eq('hoa_id', hoaId);

  if (error || !data) return [];
  return data.map(court => ({
    id: court.id,
    name: court.name,
    hoaId: court.hoa_id,
    amenityType: court.court_type as Amenity['amenityType'],
    createdAt: court.created_at
  }));
};

export const addAmenity = async (name: string, hoaId: string, amenityType: Amenity['amenityType']): Promise<void> => {
  const { error } = await supabase
    .from('courts')
    .insert({
      name,
      hoa_id: hoaId,
      court_type: amenityType
    });

  if (error) throw error;
};

export const removeAmenity = async (amenityId: string): Promise<void> => {
  const { error } = await supabase
    .from('courts')
    .delete()
    .eq('id', amenityId);

  if (error) throw error;
};

// Legacy court functions for backward compatibility
export const getCourtsByHOAId = getAmenitiesByHOAId;
export const addCourt = addAmenity;
export const removeCourt = removeAmenity;

// Helper function to get user and amenity names separately
const getUserAndAmenityNames = async (userId: string, amenityId: string) => {
  const [userResult, amenityResult] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    supabase.from('courts').select('name').eq('id', amenityId).single()
  ]);

  return {
    userName: userResult.data?.full_name || 'Unknown User',
    amenityName: amenityResult.data?.name || 'Unknown Amenity'
  };
};

// Booking operations with email integration
export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'confirmed');

  if (error || !data) return [];
  
  // Get user and amenity names for each booking
  const bookingsWithNames = await Promise.all(
    data.map(async (booking) => {
      const { userName, amenityName } = await getUserAndAmenityNames(booking.user_id, booking.court_id);
      return transformBookingRow(booking, userName, amenityName);
    })
  );

  return bookingsWithNames;
};

export const createBooking = async (
  userId: string,
  amenityId: string,
  date: string,
  startTime: string,
  endTime: string,
  playType: 'singles' | 'doubles' | 'family' | 'group' = 'singles'
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

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      court_id: amenityId, // Using court_id field for backward compatibility
      date,
      start_time: startTime,
      end_time: endTime,
      play_type: playType,
      status: 'confirmed'
    })
    .select('*')
    .single();

  if (error) throw error;

  // Check user preferences before sending email
  const shouldSend = await shouldSendEmail(userId, 'booking_confirmations');
  if (shouldSend && booking) {
    try {
      const { userName, amenityName } = await getUserAndAmenityNames(userId, amenityId);
      
      await sendBookingEmail({
        type: 'booking_confirmation',
        bookingId: booking.id,
        userEmail: '', // Will be populated by edge function from auth
        userName,
        amenityName,
        date,
        startTime,
        endTime,
        playType
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't throw error - booking was successful even if email failed
    }
  }
};

export const cancelBooking = async (bookingId: string): Promise<void> => {
  // Get booking details before canceling
  const { data: booking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId);

  if (error) throw error;

  // Check user preferences before sending cancellation email
  if (booking) {
    const shouldSend = await shouldSendEmail(booking.user_id, 'cancellation_notifications');
    if (shouldSend) {
      try {
        const { userName, amenityName } = await getUserAndAmenityNames(booking.user_id, booking.court_id);
        
        await sendBookingEmail({
          type: 'booking_cancellation',
          bookingId: booking.id,
          userEmail: '', // Will be populated by edge function from auth
          userName,
          amenityName,
          date: booking.date,
          startTime: booking.start_time,
          endTime: booking.end_time,
          playType: booking.play_type
        });
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError);
        // Don't throw error - cancellation was successful even if email failed
      }
    }
  }
};

export const getBookingsForDateAndAmenity = async (date: string, amenityId: string): Promise<Booking[]> => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('court_id', amenityId)
    .eq('date', date)
    .eq('status', 'confirmed');

  if (error || !data) return [];
  
  // Get user and amenity names for each booking
  const bookingsWithNames = await Promise.all(
    data.map(async (booking) => {
      const { userName, amenityName } = await getUserAndAmenityNames(booking.user_id, booking.court_id);
      return transformBookingRow(booking, userName, amenityName);
    })
  );

  return bookingsWithNames;
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

// Amenity maintenance operations
export const setAmenityMaintenance = async (
  amenityId: string,
  date: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<void> => {
  const { error } = await supabase
    .from('court_maintenance')
    .insert({
      court_id: amenityId,
      date,
      start_time: startTime,
      end_time: endTime,
      description
    });

  if (error) throw error;
};

export const getMaintenanceForDateAndAmenity = async (date: string, amenityId: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('court_maintenance')
    .select('*')
    .eq('court_id', amenityId)
    .eq('date', date);

  if (error || !data) return [];
  return data;
};

// Legacy function names for backward compatibility
export const setCourtMaintenance = setAmenityMaintenance;
export const getMaintenanceForDateAndCourt = getMaintenanceForDateAndAmenity;

// Email service functions
interface EmailData {
  type: 'booking_confirmation' | 'booking_cancellation' | 'booking_reminder';
  bookingId: string;
  userEmail: string;
  userName: string;
  amenityName: string;
  date: string;
  startTime: string;
  endTime: string;
  playType?: string;
}

export const sendBookingEmail = async (emailData: EmailData): Promise<void> => {
  const { data, error } = await supabase.functions.invoke('send-booking-email', {
    body: emailData
  });

  if (error) {
    console.error('Error sending booking email:', error);
    throw error;
  }

  console.log('Booking email sent successfully:', data);
};

export const sendBookingReminders = async (): Promise<void> => {
  // Get tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Get all bookings for tomorrow
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('date', tomorrowStr)
    .eq('status', 'confirmed');

  if (error || !bookings) {
    console.error('Error fetching tomorrow\'s bookings:', error);
    return;
  }

  // Send reminder emails (only to users who have reminders enabled)
  for (const booking of bookings) {
    try {
      const shouldSend = await shouldSendEmail(booking.user_id, 'booking_reminders');
      if (shouldSend) {
        const { userName, amenityName } = await getUserAndAmenityNames(booking.user_id, booking.court_id);
        
        await sendBookingEmail({
          type: 'booking_reminder',
          bookingId: booking.id,
          userEmail: '', // Will be populated by edge function from auth
          userName,
          amenityName,
          date: booking.date,
          startTime: booking.start_time,
          endTime: booking.end_time,
          playType: booking.play_type
        });
      }
    } catch (emailError) {
      console.error(`Failed to send reminder email for booking ${booking.id}:`, emailError);
    }
  }
};

// Add these new functions for community management

export const createCommunity = async (
  name: string,
  communityType: string = 'hoa',
  address?: string,
  logoUrl?: string,
  description?: string
): Promise<string> => {
  const { data, error } = await supabase.rpc('create_community', {
    community_name: name,
    community_type: communityType,
    community_address: address || null,
    logo_url: logoUrl || null,
    description: description || null
  });

  if (error) {
    console.error('Error creating community:', error);
    throw error;
  }

  return data;
};

export const requestJoinCommunity = async (
  hoaId: string,
  message?: string
): Promise<string> => {
  const { data, error } = await supabase.rpc('request_join_community', {
    target_hoa_id: hoaId,
    join_message: message || null
  });

  if (error) {
    console.error('Error requesting to join community:', error);
    throw error;
  }

  return data;
};

export const getCommunityJoinRequests = async (hoaId?: string) => {
  let query = supabase
    .from('community_join_requests')
    .select(`
      id,
      user_id,
      hoa_id,
      status,
      message,
      created_at,
      updated_at,
      profiles!community_join_requests_user_id_fkey(
        id,
        full_name,
        email
      ),
      hoas!community_join_requests_hoa_id_fkey(
        id,
        name
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (hoaId) {
    query = query.eq('hoa_id', hoaId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching community join requests:', error);
    throw error;
  }

  return data || [];
};

export const approveJoinRequest = async (requestId: string): Promise<void> => {
  const { error } = await supabase
    .from('community_join_requests')
    .update({ 
      status: 'approved',
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (error) {
    console.error('Error approving join request:', error);
    throw error;
  }

  // Also update the user's profile to link them to the HOA
  const { data: request } = await supabase
    .from('community_join_requests')
    .select('user_id, hoa_id')
    .eq('id', requestId)
    .single();

  if (request) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        hoa_id: request.hoa_id,
        hoa_status: 'approved'
      })
      .eq('id', request.user_id);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
      throw profileError;
    }
  }
};

export const rejectJoinRequest = async (requestId: string): Promise<void> => {
  const { error } = await supabase
    .from('community_join_requests')
    .update({ 
      status: 'rejected',
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (error) {
    console.error('Error rejecting join request:', error);
    throw error;
  }
};
