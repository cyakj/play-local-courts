export type ScheduleVisibility = 'private' | 'show_as_unavailable';
export type TeachingLocationType = 'facility' | 'travel' | 'either';
export type BlockoutType =
  | 'lunch'
  | 'personal'
  | 'tournament'
  | 'vacation'
  | 'facility_unavailable'
  | 'travel_time'
  | 'other';

export interface CoachGlobalHour {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_closed: boolean;
}

export interface CoachFacilityHour {
  id: string;
  coach_id: string;
  facility_name: string;
  facility_address: string | null;
  court_type: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  publicly_bookable: boolean;
  notes: string | null;
  is_active: boolean;
}

export interface CoachTravelHour {
  id: string;
  coach_id: string;
  travel_radius_miles: number | null;
  areas_served: string[];
  days_of_week: number[];
  start_time: string;
  end_time: string;
  publicly_bookable: boolean;
  travel_notes: string | null;
  is_active: boolean;
}

export interface CoachTeachingBlock {
  id: string;
  coach_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_type: TeachingLocationType;
  facility_name: string | null;
  court_type: string | null;
  travel_radius_miles: number | null;
  areas_served: string[];
  travel_notes: string | null;
  publicly_bookable: boolean;
  is_active: boolean;
}

export interface CoachBlockout {
  id: string;
  coach_id: string;
  type: BlockoutType;
  title: string | null;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  specific_date: string | null;
  visibility: ScheduleVisibility;
}

export interface CoachSchedulePrivateSettings {
  coach_id: string;
  travel_base_address: string | null;
}

export interface ScheduleDraft {
  globalHours: CoachGlobalHour[];
  teachingBlocks: CoachTeachingBlock[];
  blockouts: CoachBlockout[];
}

export interface LegacyScheduleDraft {
  globalHours: CoachGlobalHour[];
  facilityHours: CoachFacilityHour[];
  travelHours: CoachTravelHour[];
  blockouts: CoachBlockout[];
  privateSettings: CoachSchedulePrivateSettings;
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function createDraftId(prefix: string): string {
  return `draft-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isDraftId(id: string): boolean {
  return id.startsWith('draft-');
}

export function normalizeTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export function formatTime(value: string | null): string {
  if (!value) return 'Any time';
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function formatDays(days: number[] | null): string {
  if (!days?.length) return 'No days selected';
  if (days.length === 7) return 'Every day';
  return days.map(day => DAY_NAMES[day]?.slice(0, 3) ?? '').join(', ');
}
