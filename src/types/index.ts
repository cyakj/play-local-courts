
// User roles
export enum UserRole {
  RESIDENT = "resident",
  ADMIN = "admin"
}

// User status
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

// User type
export interface User {
  id: string;
  fullName: string;
  email: string;
  dateOfBirth?: string;
  role: UserRole;
  status: UserStatus;
  hoaId: string;
  createdAt: string;
}

// HOA type
export interface HOA {
  id: string;
  name: string;
  adminId: string;
}

// Court type
export interface Court {
  id: string;
  name: string;
  hoaId: string;
  courtType: "tennis" | "pickleball";
}

// Time slot type (1-hour blocks)
export interface TimeSlot {
  id: string;
  start: string; // ISO string
  end: string; // ISO string
  status: CourtStatus;
}

// Booking type
export interface Booking {
  id: string;
  userId: string;
  userName: string;
  courtId: string;
  courtName: string;
  date: string; // YYYY-MM-DD
  timeSlot: TimeSlot;
  createdAt: string;
}
