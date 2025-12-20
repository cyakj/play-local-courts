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
