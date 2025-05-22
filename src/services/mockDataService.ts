
import { User, UserRole, UserStatus, HOA, Court, Booking, TimeSlot, CourtStatus } from '../types';

// Mock HOAs
export const mockHOAs: HOA[] = [
  { id: "1", name: "Pinehurst Community", adminId: "admin1" },
  { id: "2", name: "Lakeside Villas", adminId: "admin2" },
  { id: "3", name: "Oak Ridge Estates", adminId: "admin3" }
];

// Mock Users
export const mockUsers: User[] = [
  {
    id: "admin1",
    fullName: "John Admin",
    email: "admin1@example.com",
    role: UserRole.ADMIN,
    status: UserStatus.APPROVED,
    hoaId: "1",
    createdAt: "2023-01-01T00:00:00Z"
  },
  {
    id: "admin2",
    fullName: "Jane Admin",
    email: "admin2@example.com",
    role: UserRole.ADMIN,
    status: UserStatus.APPROVED,
    hoaId: "2",
    createdAt: "2023-01-01T00:00:00Z"
  },
  {
    id: "admin3",
    fullName: "Mike Admin",
    email: "admin3@example.com",
    role: UserRole.ADMIN,
    status: UserStatus.APPROVED,
    hoaId: "3",
    createdAt: "2023-01-01T00:00:00Z"
  },
  {
    id: "user1",
    fullName: "Alice Resident",
    email: "alice@example.com",
    dateOfBirth: "1990-05-15",
    role: UserRole.RESIDENT,
    status: UserStatus.APPROVED,
    hoaId: "1",
    createdAt: "2023-02-01T00:00:00Z"
  },
  {
    id: "user2",
    fullName: "Bob Resident",
    email: "bob@example.com",
    role: UserRole.RESIDENT,
    status: UserStatus.PENDING,
    hoaId: "1",
    createdAt: "2023-03-01T00:00:00Z"
  },
  {
    id: "user3",
    fullName: "Charlie Resident",
    email: "charlie@example.com",
    role: UserRole.RESIDENT,
    status: UserStatus.APPROVED,
    hoaId: "2",
    createdAt: "2023-02-15T00:00:00Z"
  }
];

// Mock Courts
export const mockCourts: Court[] = [
  { id: "court1", name: "Tennis Court 1", hoaId: "1", courtType: "tennis" },
  { id: "court2", name: "Tennis Court 2", hoaId: "1", courtType: "tennis" },
  { id: "court3", name: "Pickleball Court 1", hoaId: "1", courtType: "pickleball" },
  { id: "court4", name: "Tennis Court 1", hoaId: "2", courtType: "tennis" },
  { id: "court5", name: "Pickleball Court 1", hoaId: "2", courtType: "pickleball" },
  { id: "court6", name: "Tennis Court 1", hoaId: "3", courtType: "tennis" }
];

// Function to generate time slots for a given date and court
export function generateTimeSlots(date: string, courtId: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startHour = 8; // 8 AM
  const endHour = 20; // 8 PM

  for (let hour = startHour; hour < endHour; hour++) {
    const startTime = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`);
    const endTime = new Date(`${date}T${(hour + 1).toString().padStart(2, '0')}:00:00`);
    
    // Randomly assign status for demo purposes
    let status = CourtStatus.AVAILABLE;
    
    // Make some slots booked
    if (Math.random() > 0.7) {
      status = CourtStatus.BOOKED;
    }
    
    // Make some courts under maintenance (fewer)
    if (Math.random() > 0.9) {
      status = CourtStatus.MAINTENANCE;
    }

    slots.push({
      id: `${courtId}-${date}-${hour}`,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      status
    });
  }

  return slots;
}

// Mock Bookings (will be populated dynamically)
export let mockBookings: Booking[] = [];

// Initialize some bookings
export function initializeBookings() {
  mockBookings = [];
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  
  const todayString = today.toISOString().split('T')[0];
  const tomorrowString = tomorrow.toISOString().split('T')[0];
  
  mockCourts.forEach(court => {
    const todaySlots = generateTimeSlots(todayString, court.id);
    const tomorrowSlots = generateTimeSlots(tomorrowString, court.id);
    
    // Add some bookings for demonstration
    const bookedSlots = [...todaySlots, ...tomorrowSlots]
      .filter(slot => slot.status === CourtStatus.BOOKED)
      .slice(0, 5); // Just take a few
      
    bookedSlots.forEach((slot, index) => {
      const userId = `user${(index % 3) + 1}`;
      const user = mockUsers.find(u => u.id === userId);
      
      if (user && user.hoaId === court.hoaId) {
        mockBookings.push({
          id: `booking-${slot.id}`,
          userId: user.id,
          userName: user.fullName,
          courtId: court.id,
          courtName: court.name,
          date: slot.start.split('T')[0],
          timeSlot: slot,
          createdAt: new Date().toISOString()
        });
      }
    });
  });
}

// Call initialize on service import
initializeBookings();
