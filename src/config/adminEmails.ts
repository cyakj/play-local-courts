
// Predefined admin email addresses that should automatically get admin privileges
export const ADMIN_EMAILS = [
  'admin1@hoaresorts.com', // Replace with actual admin email
  'admin2@hoaresorts.com', // Replace with actual admin email
];

// Check if an email should be granted admin privileges
export const isAdminEmail = (email: string): boolean => {
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
