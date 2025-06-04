
// Predefined admin email addresses that should automatically get admin privileges
export const ADMIN_EMAILS = [
  'thegreens.tennis@gmail.com',
  'thefairways.tennis@gmail.com',
];

// Check if an email should be granted admin privileges
export const isAdminEmail = (email: string): boolean => {
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
