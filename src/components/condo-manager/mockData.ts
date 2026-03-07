// Mock data for Condo Manager dashboard — will be replaced with real Supabase queries

export interface CMCommunity {
  id: number;
  name: string;
  totalUnits: number;
  health: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  openIssues: number;
  pendingApprovals: number;
  todayBookings: number;
  activeMembers: number;
  avgResolutionDays: number;
  utilization: number;
  amenities: string[];
  issuesByCategory: { name: string; count: number }[];
  recentActivity: { text: string; time: string; dot: string }[];
}

export const MOCK_COMMUNITIES: CMCommunity[] = [
  {
    id: 1, name: 'The Greens', totalUnits: 48, health: 87, status: 'good',
    openIssues: 2, pendingApprovals: 3, todayBookings: 7, activeMembers: 44,
    avgResolutionDays: 2.4, utilization: 74,
    amenities: ['2 Tennis Courts', 'Pool', 'Clubhouse'],
    issuesByCategory: [
      { name: 'Pool', count: 3 }, { name: 'Grounds', count: 2 },
      { name: 'Courts', count: 2 }, { name: 'Lighting', count: 1 },
    ],
    recentActivity: [
      { text: 'Pool filter reported by Ron G.', time: '2h ago', dot: '#F59E0B' },
      { text: 'Court 1 booked by Sarah M.', time: '3h ago', dot: '#00B4D8' },
      { text: 'New member: James K.', time: '5h ago', dot: '#2DD4BF' },
    ],
  },
  {
    id: 2, name: 'The Fairways', totalUnits: 72, health: 64, status: 'warning',
    openIssues: 8, pendingApprovals: 1, todayBookings: 12, activeMembers: 61,
    avgResolutionDays: 5.1, utilization: 88,
    amenities: ['Golf Course', '3 Tennis Courts', 'Pool', 'Gym'],
    issuesByCategory: [
      { name: 'Amenities', count: 5 }, { name: 'Courts', count: 4 },
      { name: 'Buildings', count: 3 }, { name: 'Plumbing', count: 2 },
    ],
    recentActivity: [
      { text: 'Gym equipment broken — 3rd report', time: '1h ago', dot: '#EF4444' },
      { text: 'Parking lot light out', time: '4h ago', dot: '#F59E0B' },
      { text: 'Golf fully booked tomorrow', time: '6h ago', dot: '#00B4D8' },
    ],
  },
  {
    id: 3, name: 'The Pines', totalUnits: 35, health: 95, status: 'excellent',
    openIssues: 0, pendingApprovals: 0, todayBookings: 4, activeMembers: 35,
    avgResolutionDays: 1.2, utilization: 61,
    amenities: ['Tennis Court', 'Pool'],
    issuesByCategory: [{ name: 'Grounds', count: 1 }],
    recentActivity: [
      { text: 'Pool booked for community event', time: '1h ago', dot: '#00B4D8' },
      { text: 'All members active this week', time: '1d ago', dot: '#2DD4BF' },
    ],
  },
];

export const MOCK_REPORTS = [
  { id: 1, community: 'The Greens', amenity: 'The Greens Court', status: 'Open', priority: 'High', category: 'Grounds & Landscaping', description: 'Too many bushes blocking the path', reporter: 'Ron Glickman', date: '3/5/2026' },
  { id: 2, community: 'The Greens', amenity: 'Greens Pool', status: 'In Progress', priority: 'Medium', category: 'Water & Plumbing', description: 'Pool filter making unusual noise', reporter: 'Sarah M.', date: '3/4/2026' },
  { id: 3, community: 'The Fairways', amenity: 'Fairways Gym', status: 'Open', priority: 'Urgent', category: 'Amenities & Equipment', description: 'Treadmill broken — 3rd report this month', reporter: 'James K.', date: '3/6/2026' },
  { id: 4, community: 'The Fairways', amenity: 'Parking Lot A', status: 'Open', priority: 'Medium', category: 'Lighting & Electrical', description: 'Light out on north side', reporter: 'David R.', date: '3/2/2026' },
  { id: 5, community: 'The Pines', amenity: 'Pines Pool', status: 'Resolved', priority: 'Low', category: 'Grounds & Landscaping', description: 'Foliage around pool overgrown', reporter: 'Anna T.', date: '1/4/2026' },
];

export const MOCK_ALERTS = [
  { type: 'approval', community: 'The Greens', text: '3 pending member approvals', time: 'now', urgent: true },
  { type: 'issue', community: 'The Fairways', text: 'Gym equipment — 3rd report filed', time: '1h ago', urgent: true },
  { type: 'issue', community: 'The Fairways', text: 'Issue unresolved 7+ days: Parking light', time: '1d ago', urgent: true },
  { type: 'booking', community: 'The Greens', text: 'Court 1 fully booked this weekend', time: '3h ago', urgent: false },
  { type: 'health', community: 'The Fairways', text: 'Health score dropped to 64', time: '1d ago', urgent: false },
];

export const MOCK_NOTIFICATIONS = [
  { type: 'issue', community: 'The Fairways', title: 'New maintenance report', body: 'James K. reported Amenities & Equipment at Fairways Gym', time: '1h ago', read: false },
  { type: 'approval', community: 'The Greens', title: 'New member application', body: 'Ron Glickman applied to join The Greens', time: '2h ago', read: false },
  { type: 'survey', community: 'The Greens', title: 'Survey: Parking Hours', body: '12 residents have responded so far', time: '3h ago', read: false },
  { type: 'booking', community: 'The Pines', title: 'Booking confirmed', body: 'Pool booked for Sat Mar 8 at 10:00 AM', time: '5h ago', read: true },
  { type: 'health', community: 'The Fairways', title: 'Health score alert — The Fairways', body: 'Dropped to 64. 8 open issues need attention.', time: '1d ago', read: true },
  { type: 'event', community: 'The Greens', title: 'New event: Spring BBQ', body: 'Community Event · Sat Mar 15 at 4:00 PM · Pool Deck', time: '2d ago', read: true },
];

export const MOCK_EVENTS = [
  { id: 1, community: 'The Greens', title: 'Spring BBQ', type: 'community_event', date: 'Mar 15', day: 15, time: '4:00 PM', location: 'Pool Deck', rsvp: 14 },
  { id: 2, community: 'The Greens', title: 'Board Meeting — Q1', type: 'board_meeting', date: 'Mar 12', day: 12, time: '7:00 PM', location: 'Clubhouse', rsvp: null },
  { id: 3, community: 'The Fairways', title: 'Pool Maintenance Day', type: 'maintenance_scheduled', date: 'Mar 10', day: 10, time: '9:00 AM', location: 'Pool', rsvp: null },
  { id: 4, community: 'The Pines', title: 'Welcome New Residents', type: 'community_event', date: 'Mar 20', day: 20, time: '6:00 PM', location: 'Common Area', rsvp: 8 },
  { id: 5, community: 'The Greens', title: 'Tennis Social', type: 'amenity_booking', date: 'Mar 7', day: 7, time: '10:00 AM', location: 'Court 1', rsvp: 6 },
  { id: 6, community: 'The Fairways', title: 'Board Meeting — Budget', type: 'board_meeting', date: 'Mar 7', day: 7, time: '6:00 PM', location: 'Clubhouse', rsvp: null },
  { id: 7, community: 'The Greens', title: 'Pool Party', type: 'community_event', date: 'Mar 22', day: 22, time: '2:00 PM', location: 'Pool Deck', rsvp: 20 },
  { id: 8, community: 'The Pines', title: 'Court Resurfacing', type: 'maintenance_scheduled', date: 'Mar 25', day: 25, time: '8:00 AM', location: 'Tennis Court', rsvp: null },
  { id: 9, community: 'The Fairways', title: 'Gym Open House', type: 'amenity_booking', date: 'Mar 5', day: 5, time: '5:00 PM', location: 'Gym', rsvp: 10 },
  { id: 10, community: 'The Greens', title: 'Landscape Review', type: 'maintenance_scheduled', date: 'Mar 3', day: 3, time: '9:00 AM', location: 'Grounds', rsvp: null },
];

export const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  community_event: { color: '#00B4D8', label: 'Community Event' },
  board_meeting: { color: '#0A1628', label: 'Board Meeting' },
  maintenance_scheduled: { color: '#F59E0B', label: 'Maintenance' },
  amenity_booking: { color: '#2DD4BF', label: 'Amenity Booking' },
};

export const ALERT_ICON: Record<string, string> = { approval: '✅', issue: '🔧', booking: '📅', health: '📊' };
export const ALERT_COLOR: Record<string, string> = {
  approval: '#00B4D8', issue: '#EF4444', booking: '#2DD4BF', health: '#F59E0B',
};

export const NOTIF_ICON: Record<string, string> = { issue: '🔧', approval: '👤', booking: '📅', health: '📊', survey: '📊', event: '📅' };
export const NOTIF_COLOR: Record<string, string> = {
  issue: '#EF4444', approval: '#00B4D8', booking: '#2DD4BF', health: '#F59E0B', survey: '#00B4D8', event: '#2DD4BF',
};
