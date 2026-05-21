/**
 * Feature Flags
 * 
 * VITE_TENNIS_FEATURES_ENABLED controls visibility of all tennis and coach-related features.
 * Set to 'true' to restore all tennis features.
 * Set to 'false' (or omit) to hide them for HOA-only launch.
 */
export const TENNIS_FEATURES_ENABLED = import.meta.env.VITE_TENNIS_FEATURES_ENABLED === 'true';
