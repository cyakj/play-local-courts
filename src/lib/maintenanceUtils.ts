/**
 * Shared maintenance utilities used across MyReports, MaintenanceReports,
 * MultiStepReportDialog, and worker interfaces.
 */

/** Map raw DB category values → human-readable labels */
export const getCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    // New categories (from MultiStepReportDialog)
    amenities_equipment: 'Amenities & Equipment',
    lighting_electrical: 'Lighting & Electrical',
    water_plumbing: 'Water & Plumbing',
    grounds_landscaping: 'Grounds & Landscaping',
    buildings_structures: 'Buildings & Structures',
    safety_other: 'Safety / Other',
    // Legacy admin categories
    lighting: 'Lighting',
    surface_net: 'Surface & Net',
    gate_access: 'Gate & Access',
    plumbing: 'Plumbing',
    cleaning: 'Cleaning',
    pool_maintenance: 'Pool Maintenance',
    general_repairs: 'General Repairs',
    other: 'Other',
  };
  return labels[category] || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/** All category options for filter dropdowns (unified set) */
export const allCategories = [
  { value: 'amenities_equipment', label: 'Amenities & Equipment' },
  { value: 'lighting_electrical', label: 'Lighting & Electrical' },
  { value: 'water_plumbing', label: 'Water & Plumbing' },
  { value: 'grounds_landscaping', label: 'Grounds & Landscaping' },
  { value: 'buildings_structures', label: 'Buildings & Structures' },
  { value: 'safety_other', label: 'Safety / Other' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'surface_net', label: 'Surface & Net' },
  { value: 'gate_access', label: 'Gate & Access' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'other', label: 'Other' },
];

/**
 * Parse severity from the description prefix `[Severity: X]`.
 * Returns a normalized priority string.
 */
export const parsePriorityFromDescription = (description: string): string => {
  const match = description.match(/^\[Severity:\s*(Low|Moderate|High|Critical)\]/i);
  if (!match) return 'medium';
  const severity = match[1].toLowerCase();
  switch (severity) {
    case 'critical': return 'urgent';
    case 'high': return 'high';
    case 'moderate': return 'medium';
    case 'low': return 'low';
    default: return 'medium';
  }
};

/** Strip the severity prefix from the description for clean display */
export const cleanDescription = (description: string): string => {
  return description.replace(/^\[Severity:\s*(Low|Moderate|High|Critical)\]\s*/i, '');
};

/** Priority display config */
export const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  low: { label: 'Low', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/** Status display config */
export const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  open: { label: 'Open', variant: 'secondary', className: 'bg-gray-100 text-gray-700' },
  assigned: { label: 'Assigned', variant: 'default', className: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepted', variant: 'default', className: 'bg-indigo-100 text-indigo-700' },
  in_progress: { label: 'In Progress', variant: 'default', className: 'bg-orange-100 text-orange-700' },
  completed: { label: 'Completed', variant: 'secondary', className: 'bg-green-100 text-green-700' },
  resolved: { label: 'Resolved', variant: 'secondary', className: 'bg-green-100 text-green-700' },
  reopened: { label: 'Reopened', variant: 'destructive', className: 'bg-red-100 text-red-700' },
};

/** All status options for filters */
export const allStatusFilters = [
  { value: 'active', label: 'Active (Open + In Progress)' },
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'completed', label: 'Completed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'reopened', label: 'Reopened' },
];
