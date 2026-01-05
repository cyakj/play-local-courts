// ZIP code to approximate coordinates mapping for distance calculations
// This is a simplified approach using ZIP code prefix regions

interface ZipCoordinates {
  lat: number;
  lng: number;
}

// Approximate center coordinates for US ZIP code prefix regions
// This provides reasonable estimates for distance calculations without requiring a full ZIP database
const ZIP_PREFIX_COORDINATES: Record<string, ZipCoordinates> = {
  // Northeast
  '0': { lat: 42.3601, lng: -71.0589 }, // Boston area
  '1': { lat: 42.3601, lng: -72.5589 }, // Massachusetts/Connecticut
  
  // New York/New Jersey
  '10': { lat: 40.7128, lng: -74.0060 }, // NYC
  '11': { lat: 40.6892, lng: -73.9642 }, // Brooklyn/Queens
  '07': { lat: 40.7357, lng: -74.1724 }, // Northern NJ
  '08': { lat: 39.9523, lng: -75.1638 }, // Southern NJ/Philly
  
  // Mid-Atlantic
  '2': { lat: 38.9072, lng: -77.0369 }, // DC/Virginia/Maryland
  
  // Southeast
  '3': { lat: 33.7490, lng: -84.3880 }, // Georgia/Atlanta
  '32': { lat: 30.3322, lng: -81.6557 }, // Florida - Jacksonville
  '33': { lat: 25.7617, lng: -80.1918 }, // Florida - Miami
  
  // Midwest
  '4': { lat: 42.3314, lng: -83.0458 }, // Michigan/Detroit
  '5': { lat: 44.9778, lng: -93.2650 }, // Minnesota/Twin Cities
  '6': { lat: 41.8781, lng: -87.6298 }, // Chicago/Illinois
  
  // South Central
  '7': { lat: 29.7604, lng: -95.3698 }, // Texas/Houston
  '75': { lat: 32.7767, lng: -96.7970 }, // Texas - Dallas
  '78': { lat: 29.4241, lng: -98.4936 }, // Texas - San Antonio
  
  // Mountain
  '8': { lat: 39.7392, lng: -104.9903 }, // Colorado/Denver
  '85': { lat: 33.4484, lng: -112.0740 }, // Arizona - Phoenix
  
  // Pacific
  '9': { lat: 34.0522, lng: -118.2437 }, // California/LA
  '90': { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  '94': { lat: 37.7749, lng: -122.4194 }, // San Francisco
  '98': { lat: 47.6062, lng: -122.3321 }, // Seattle
};

/**
 * Get approximate coordinates for a ZIP code
 * Uses prefix matching to find the closest regional center
 */
export function getZipCoordinates(zipCode: string): ZipCoordinates | null {
  if (!zipCode || zipCode.length < 3) return null;
  
  const cleanZip = zipCode.replace(/\D/g, '').slice(0, 5);
  if (cleanZip.length < 3) return null;
  
  // Try increasingly shorter prefixes
  for (let len = Math.min(cleanZip.length, 3); len >= 1; len--) {
    const prefix = cleanZip.slice(0, len);
    if (ZIP_PREFIX_COORDINATES[prefix]) {
      return ZIP_PREFIX_COORDINATES[prefix];
    }
  }
  
  // Fallback to first digit
  const firstDigit = cleanZip[0];
  return ZIP_PREFIX_COORDINATES[firstDigit] || null;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate distance between two ZIP codes
 * Returns distance in miles or null if coordinates can't be determined
 */
export function getDistanceBetweenZips(zip1: string, zip2: string): number | null {
  const coords1 = getZipCoordinates(zip1);
  const coords2 = getZipCoordinates(zip2);
  
  if (!coords1 || !coords2) return null;
  
  return calculateDistance(coords1.lat, coords1.lng, coords2.lat, coords2.lng);
}

/**
 * Format distance for display
 */
export function formatDistance(
  distance: number | null,
  showExact: boolean = true
): string {
  if (distance === null) return 'Distance unknown';
  
  if (!showExact) {
    if (distance < 5) return 'Nearby';
    if (distance < 15) return 'Nearby';
    if (distance < 30) return 'In your area';
    return 'Farther away';
  }
  
  if (distance < 1) {
    return 'Less than 1 mile away';
  }
  
  return `${distance.toFixed(1)} miles away`;
}

/**
 * Validate a US ZIP code format
 */
export function isValidZipCode(zipCode: string): boolean {
  const cleanZip = zipCode.replace(/\D/g, '');
  return cleanZip.length === 5;
}
