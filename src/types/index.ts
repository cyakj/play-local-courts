
// User roles for HOA system
export enum UserRole {
  RESIDENT = "resident",
  ADMIN = "admin"
}

// User status for HOA approval
export enum UserStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected"
}

// Court status
export enum CourtStatus {
  AVAILABLE = "available",
  BOOKED = "booked",
  MAINTENANCE = "maintenance"
}

// User type matching Supabase profiles table
export interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  role: UserRole; // maps to hoa_role in database
  status: UserStatus; // maps to hoa_status in database
  hoaId: string;
  createdAt: string;
}

// HOA type matching Supabase hoas table
export interface HOA {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  adminId?: string;
  createdAt: string;
}

// Court type matching Supabase courts table
export interface Court {
  id: string;
  name: string;
  hoaId: string;
  courtType: "tennis" | "pickleball";
  createdAt: string;
}

// Time slot type (1-hour blocks)
export interface TimeSlot {
  id: string;
  start: string; // ISO string
  end: string; // ISO string
  status: CourtStatus;
}

// Booking type matching Supabase bookings table
export interface Booking {
  id: string;
  userId: string;
  userName: string;
  courtId: string;
  courtName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  playType?: 'singles' | 'doubles';
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

// Database row types for Supabase operations
export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  date_of_birth?: string;
  hoa_role: string;
  hoa_status: string;
  hoa_id?: string;
  created_at: string;
}

export interface HOARow {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  admin_id?: string;
  created_at: string;
}

export interface CourtRow {
  id: string;
  name: string;
  court_type: string;
  hoa_id: string;
  created_at: string;
}

export interface BookingRow {
  id: string;
  user_id: string;
  court_id: string;
  date: string;
  start_time: string;
  end_time: string;
  play_type?: string;
  status: string;
  created_at: string;
}
