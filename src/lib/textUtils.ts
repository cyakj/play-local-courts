/**
 * Capitalizes the first letter of each word in a string
 */
export const capitalizeWords = (text: string | null | undefined): string => {
  if (!text) return '';
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Formats match type for display (e.g., "singles" -> "Singles", "mixed_doubles" -> "Mixed Doubles")
 */
export const formatMatchType = (type: string | null | undefined): string => {
  if (!type) return '';
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Auto-capitalize input handler for proper nouns (names, places)
 * Capitalizes the first letter of each word as the user types
 */
export const autoCapitalizeProperNoun = (value: string): string => {
  if (!value) return '';
  return value
    .split(' ')
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

/**
 * Formats a time string from 24-hour format (HH:MM:SS or HH:MM) to 12-hour format with AM/PM
 * Examples: "13:00:00" -> "1:00 PM", "09:30" -> "9:30 AM"
 */
export const formatTime12Hour = (time: string | null | undefined): string => {
  if (!time) return '';
  
  // Extract hours and minutes (ignore seconds if present)
  const parts = time.split(':');
  if (parts.length < 2) return time;
  
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  
  if (isNaN(hours)) return time;
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  
  return `${hours}:${minutes} ${ampm}`;
};
