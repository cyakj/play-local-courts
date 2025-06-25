
export interface Coach {
  id: string;
  userId: string;
  businessName?: string;
  credentials: 'USPTA' | 'PTR' | 'None';
  yearsExperience: number;
  sportsOffered: string[];
  homeBase: string;
  willingToTravel: boolean;
  hourlyRate?: number;
  bio?: string;
  profileImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonRequest {
  id: string;
  playerId: string;
  coachId: string;
  sport: string;
  lessonType: 'private' | 'semi-private' | 'group' | 'junior';
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredDate: string;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  location?: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CoachAvailability {
  id: string;
  coachId: string;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string;
  endTime: string;
  createdAt: string;
}

export interface CoachReview {
  id: string;
  coachId: string;
  playerId: string;
  lessonRequestId?: string;
  rating: number;
  reviewText?: string;
  coachResponse?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientNote {
  id: string;
  coachId: string;
  clientId: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
