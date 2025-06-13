
import { User, UserRole, UserStatus, HOA, Amenity, Booking, TimeSlot, AmenityStatus } from '../types';

// Mock HOAs
export const mockHOAs: HOA[] = [
  { id: "1", name: "The Greens", adminId: "admin1", createdAt: "2023-01-01T00:00:00Z" },
  { id: "2", name: "The Fairways", adminId: "admin2", createdAt: "2023-01-01T00:00:00Z" }
];

// Mock Users
export const mockUsers: User[] = [
  {
    id: "admin1",
    fullName: "The Greens Admin",
    email: "admin1@example.com",
    role: UserRole.ADMIN,
    status: UserStatus.APPROVED,
    hoaId: "1",
    createdAt: "2023-01-01T00:00:00Z"
  },
  {
    id: "admin2",
    fullName: "The Fairways Admin",
    email: "admin2@example.com",
    role: UserRole.ADMIN,
    status: UserStatus.APPROVED,
    hoaId: "2",
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
  }
];

// Mock Amenities (previously Courts)
export const mockCourts: Amenity[] = [
  { id: "court1", name: "Tennis Court 1", hoaId: "1", amenityType: "tennis", createdAt: "2023-01-01T00:00:00Z" },
  { id: "court2", name: "Tennis Court 2", hoaId: "1", amenityType: "tennis", createdAt: "2023-01-01T00:00:00Z" },
  { id: "court3", name: "Pickleball Court 1", hoaId: "1", amenityType: "pickleball", createdAt: "2023-01-01T00:00:00Z" },
  { id: "court4", name: "Tennis Court 1", hoaId: "2", amenityType: "tennis", createdAt: "2023-01-01T00:00:00Z" },
  { id: "court5", name: "Pickleball Court 1", hoaId: "2", amenityType: "pickleball", createdAt: "2023-01-01T00:00:00Z" }
];

// Function to generate time slots for a given date and amenity
export function generateTimeSlots(date: string, amenityId: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startHour = 8; // 8 AM
  const endHour = 20; // 8 PM

  for (let hour = startHour; hour < endHour; hour++) {
    const startTime = new Date(`${date}T${hour.toString().padStart(2, '0')}:00:00`);
    const endTime = new Date(`${date}T${(hour + 1).toString().padStart(2, '0')}:00:00`);
    
    // Randomly assign status for demo purposes
    let status = AmenityStatus.AVAILABLE;
    
    // Make some slots booked
    if (Math.random() > 0.7) {
      status = AmenityStatus.BOOKED;
    }
    
    // Make some amenities under maintenance (fewer)
    if (Math.random() > 0.9) {
      status = AmenityStatus.MAINTENANCE;
    }

    slots.push({
      id: `${amenityId}-${date}-${hour}`,
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
  
  mockCourts.forEach(amenity => {
    const todaySlots = generateTimeSlots(todayString, amenity.id);
    const tomorrowSlots = generateTimeSlots(tomorrowString, amenity.id);
    
    // Add some bookings for demonstration
    const bookedSlots = [...todaySlots, ...tomorrowSlots]
      .filter(slot => slot.status === AmenityStatus.BOOKED)
      .slice(0, 5); // Just take a few
      
    bookedSlots.forEach((slot, index) => {
      const userId = `user${(index % 3) + 1}`;
      const user = mockUsers.find(u => u.id === userId);
      
      if (user && user.hoaId === amenity.hoaId) {
        const startTime = new Date(slot.start).toTimeString().slice(0, 5);
        const endTime = new Date(slot.end).toTimeString().slice(0, 5);
        
        mockBookings.push({
          id: `booking-${slot.id}`,
          userId: user.id,
          userName: user.fullName,
          amenityId: amenity.id,
          amenityName: amenity.name,
          date: slot.start.split('T')[0],
          startTime: startTime,
          endTime: endTime,
          playType: 'singles',
          status: 'confirmed',
          createdAt: new Date().toISOString()
        });
      }
    });
  });
}

// Call initialize on service import
initializeBookings();
