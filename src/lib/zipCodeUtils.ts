// ZIP code to approximate coordinates mapping for distance calculations
// This is a simplified approach using ZIP code prefix regions

interface ZipCoordinates {
  lat: number;
  lng: number;
}

// Approximate center coordinates for US ZIP code regions
// Uses 5-digit ZIP codes where available for better accuracy, falls back to prefixes
const ZIP_PREFIX_COORDINATES: Record<string, ZipCoordinates> = {
  // Puerto Rico - 5-digit ZIPs for better accuracy
  // Northern PR
  '00646': { lat: 18.4589, lng: -66.2678 }, // Dorado
  '00693': { lat: 18.4255, lng: -66.4028 }, // Vega Alta
  '00674': { lat: 18.4308, lng: -66.4887 }, // Manatí
  '00690': { lat: 18.4722, lng: -66.3908 }, // Toa Baja
  '00694': { lat: 18.4442, lng: -66.3556 }, // Vega Baja
  // San Juan metro area
  '00901': { lat: 18.4663, lng: -66.1057 }, // San Juan - Old San Juan
  '00907': { lat: 18.4516, lng: -66.0711 }, // San Juan - Condado
  '00909': { lat: 18.4360, lng: -66.0520 }, // San Juan - Santurce
  '00911': { lat: 18.4250, lng: -66.0400 }, // San Juan - Río Piedras
  '00913': { lat: 18.4135, lng: -66.0280 }, // San Juan - Río Piedras
  '00917': { lat: 18.4130, lng: -66.0520 }, // San Juan - Hato Rey
  '00918': { lat: 18.4145, lng: -66.0715 }, // San Juan - Hato Rey
  '00920': { lat: 18.4085, lng: -66.0930 }, // San Juan - Río Piedras
  '00921': { lat: 18.3960, lng: -66.0810 }, // San Juan - Río Piedras
  '00923': { lat: 18.4050, lng: -66.0420 }, // San Juan - Cupey
  '00924': { lat: 18.3920, lng: -66.0350 }, // San Juan - Cupey
  '00925': { lat: 18.3950, lng: -66.0550 }, // San Juan - Río Piedras
  '00926': { lat: 18.3800, lng: -66.0600 }, // San Juan - Cupey
  '00927': { lat: 18.3994, lng: -66.0518 }, // San Juan - Hato Rey
  '00928': { lat: 18.4050, lng: -66.0650 }, // San Juan - Río Piedras
  '00929': { lat: 18.4100, lng: -66.0800 }, // San Juan - Río Piedras
  '00934': { lat: 18.4200, lng: -66.1000 }, // San Juan - Pueblo Viejo
  '00936': { lat: 18.4250, lng: -66.0550 }, // San Juan - Puerto Nuevo
  // East PR
  '00959': { lat: 18.3540, lng: -65.9770 }, // Bayamón
  '00960': { lat: 18.3820, lng: -66.1550 }, // Bayamón
  '00961': { lat: 18.3990, lng: -66.1580 }, // Bayamón
  '00979': { lat: 18.3870, lng: -65.9640 }, // Carolina
  '00981': { lat: 18.3750, lng: -65.9350 }, // Carolina - Isla Verde area
  '00982': { lat: 18.3550, lng: -65.9300 }, // Carolina
  '00983': { lat: 18.3930, lng: -65.9200 }, // Carolina
  '00984': { lat: 18.3690, lng: -65.8890 }, // Carolina
  '00985': { lat: 18.3820, lng: -65.8800 }, // Carolina
  '00987': { lat: 18.3940, lng: -65.9680 }, // Carolina
  // Guaynabo
  '00965': { lat: 18.3970, lng: -66.1070 }, // Guaynabo
  '00966': { lat: 18.4050, lng: -66.1150 }, // Guaynabo
  '00968': { lat: 18.3800, lng: -66.1120 }, // Guaynabo
  '00969': { lat: 18.3620, lng: -66.1100 }, // Guaynabo
  '00970': { lat: 18.3500, lng: -66.1050 }, // Guaynabo
  // Caguas area
  '00725': { lat: 18.2341, lng: -66.0352 }, // Caguas
  '00726': { lat: 18.2290, lng: -66.0480 }, // Caguas
  '00727': { lat: 18.2200, lng: -66.0200 }, // Caguas
  // Southern PR
  '00716': { lat: 18.0108, lng: -66.6141 }, // Ponce
  '00717': { lat: 18.0050, lng: -66.6000 }, // Ponce
  '00730': { lat: 18.0005, lng: -66.0123 }, // Humacao
  '00731': { lat: 18.1509, lng: -65.8271 }, // Fajardo
  // West PR
  '00680': { lat: 18.4313, lng: -67.1537 }, // Mayagüez
  '00681': { lat: 18.4250, lng: -67.1400 }, // Mayagüez
  '00682': { lat: 18.4200, lng: -67.1300 }, // Mayagüez
  
  // Puerto Rico prefix fallbacks (for ZIPs not listed above)
  '006': { lat: 18.43, lng: -66.40 }, // Northern PR general
  '007': { lat: 18.38, lng: -65.95 }, // East-Central PR
  '008': { lat: 18.01, lng: -66.61 }, // Southern PR - Ponce area  
  '009': { lat: 18.42, lng: -66.07 }, // San Juan metro area
  
  // Northeast US
  '01': { lat: 42.1015, lng: -72.5898 }, // Western Massachusetts
  '02': { lat: 42.3601, lng: -71.0589 }, // Boston area
  '03': { lat: 42.9956, lng: -71.4548 }, // New Hampshire
  '04': { lat: 44.3106, lng: -69.7795 }, // Maine
  '05': { lat: 44.2601, lng: -72.5754 }, // Vermont
  '06': { lat: 41.7658, lng: -72.6734 }, // Connecticut
  
  // New York/New Jersey
  '10': { lat: 40.7128, lng: -74.0060 }, // NYC Manhattan
  '11': { lat: 40.6892, lng: -73.9642 }, // Brooklyn/Queens
  '12': { lat: 42.6526, lng: -73.7562 }, // Albany area
  '13': { lat: 43.0481, lng: -76.1474 }, // Syracuse area
  '14': { lat: 42.8864, lng: -78.8784 }, // Buffalo area
  '07': { lat: 40.7357, lng: -74.1724 }, // Northern NJ
  '08': { lat: 39.9523, lng: -75.1638 }, // Southern NJ/Philly
  
  // Mid-Atlantic
  '15': { lat: 40.4406, lng: -79.9959 }, // Pittsburgh
  '16': { lat: 42.1292, lng: -80.0851 }, // Erie PA
  '17': { lat: 40.2732, lng: -76.8867 }, // Harrisburg PA
  '18': { lat: 41.4090, lng: -75.6624 }, // Scranton PA
  '19': { lat: 39.9526, lng: -75.1652 }, // Philadelphia
  '20': { lat: 38.9072, lng: -77.0369 }, // DC
  '21': { lat: 39.2904, lng: -76.6122 }, // Baltimore
  '22': { lat: 38.8816, lng: -77.0910 }, // Northern Virginia
  '23': { lat: 37.5407, lng: -77.4360 }, // Richmond
  '24': { lat: 37.2710, lng: -79.9414 }, // Roanoke
  
  // Southeast
  '27': { lat: 35.7796, lng: -78.6382 }, // Raleigh NC
  '28': { lat: 35.2271, lng: -80.8431 }, // Charlotte NC
  '29': { lat: 32.7765, lng: -79.9311 }, // Charleston SC
  '30': { lat: 33.7490, lng: -84.3880 }, // Atlanta
  '31': { lat: 32.0809, lng: -81.0912 }, // Savannah GA
  '32': { lat: 30.3322, lng: -81.6557 }, // Jacksonville FL
  '33': { lat: 25.7617, lng: -80.1918 }, // Miami
  '34': { lat: 27.9506, lng: -82.4572 }, // Tampa
  '35': { lat: 33.5186, lng: -86.8104 }, // Birmingham AL
  '36': { lat: 32.3792, lng: -86.3077 }, // Montgomery AL
  '37': { lat: 36.1627, lng: -86.7816 }, // Nashville
  '38': { lat: 35.1495, lng: -90.0490 }, // Memphis
  '39': { lat: 32.2988, lng: -90.1848 }, // Jackson MS
  
  // Midwest
  '40': { lat: 38.2527, lng: -85.7585 }, // Louisville KY
  '41': { lat: 39.1031, lng: -84.5120 }, // Cincinnati area (KY side)
  '43': { lat: 39.9612, lng: -82.9988 }, // Columbus OH
  '44': { lat: 41.4993, lng: -81.6944 }, // Cleveland
  '45': { lat: 39.1031, lng: -84.5120 }, // Cincinnati
  '46': { lat: 39.7684, lng: -86.1581 }, // Indianapolis
  '47': { lat: 38.0406, lng: -87.5340 }, // Evansville IN
  '48': { lat: 42.3314, lng: -83.0458 }, // Detroit
  '49': { lat: 42.9634, lng: -85.6681 }, // Grand Rapids
  '50': { lat: 41.5868, lng: -93.6250 }, // Des Moines
  '53': { lat: 43.0389, lng: -87.9065 }, // Milwaukee
  '54': { lat: 44.5133, lng: -88.0133 }, // Green Bay
  '55': { lat: 44.9778, lng: -93.2650 }, // Minneapolis
  '60': { lat: 41.8781, lng: -87.6298 }, // Chicago
  '61': { lat: 40.6936, lng: -89.5890 }, // Peoria
  '62': { lat: 39.7817, lng: -89.6501 }, // Springfield IL
  '63': { lat: 38.6270, lng: -90.1994 }, // St Louis
  '64': { lat: 39.0997, lng: -94.5786 }, // Kansas City
  '65': { lat: 37.2090, lng: -93.2923 }, // Springfield MO
  '66': { lat: 39.0558, lng: -95.6890 }, // Topeka
  '67': { lat: 37.6872, lng: -97.3301 }, // Wichita
  '68': { lat: 40.8258, lng: -96.6852 }, // Lincoln NE
  
  // South Central
  '70': { lat: 29.9511, lng: -90.0715 }, // New Orleans
  '71': { lat: 32.5252, lng: -92.1193 }, // Monroe LA
  '72': { lat: 34.7465, lng: -92.2896 }, // Little Rock
  '73': { lat: 35.4676, lng: -97.5164 }, // Oklahoma City
  '74': { lat: 36.1540, lng: -95.9928 }, // Tulsa
  '75': { lat: 32.7767, lng: -96.7970 }, // Dallas
  '76': { lat: 32.7555, lng: -97.3308 }, // Fort Worth
  '77': { lat: 29.7604, lng: -95.3698 }, // Houston
  '78': { lat: 29.4241, lng: -98.4936 }, // San Antonio
  '79': { lat: 31.9686, lng: -102.0779 }, // Midland TX
  
  // Mountain
  '80': { lat: 39.7392, lng: -104.9903 }, // Denver
  '81': { lat: 38.2544, lng: -104.6091 }, // Pueblo CO
  '82': { lat: 41.1400, lng: -104.8202 }, // Cheyenne WY
  '83': { lat: 43.6150, lng: -116.2023 }, // Boise
  '84': { lat: 40.7608, lng: -111.8910 }, // Salt Lake City
  '85': { lat: 33.4484, lng: -112.0740 }, // Phoenix
  '86': { lat: 35.1983, lng: -111.6513 }, // Flagstaff
  '87': { lat: 35.0844, lng: -106.6504 }, // Albuquerque
  '88': { lat: 32.3199, lng: -106.7637 }, // Las Cruces
  '89': { lat: 36.1699, lng: -115.1398 }, // Las Vegas
  
  // Pacific
  '90': { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  '91': { lat: 34.1478, lng: -118.1445 }, // Pasadena/Glendale
  '92': { lat: 32.7157, lng: -117.1611 }, // San Diego
  '93': { lat: 35.3733, lng: -119.0187 }, // Bakersfield
  '94': { lat: 37.7749, lng: -122.4194 }, // San Francisco
  '95': { lat: 38.5816, lng: -121.4944 }, // Sacramento
  '96': { lat: 21.3069, lng: -157.8583 }, // Hawaii
  '97': { lat: 45.5152, lng: -122.6784 }, // Portland OR
  '98': { lat: 47.6062, lng: -122.3321 }, // Seattle
  '99': { lat: 47.6588, lng: -117.4260 }, // Spokane
};

/**
 * Get approximate coordinates for a ZIP code
 * Uses prefix matching to find the closest regional center
 */
export function getZipCoordinates(zipCode: string): ZipCoordinates | null {
  if (!zipCode || zipCode.length < 3) return null;
  
  const cleanZip = zipCode.replace(/\D/g, '').slice(0, 5);
  if (cleanZip.length < 3) return null;
  
  // Try exact 5-digit match first for maximum accuracy
  if (cleanZip.length === 5 && ZIP_PREFIX_COORDINATES[cleanZip]) {
    return ZIP_PREFIX_COORDINATES[cleanZip];
  }
  
  // Try increasingly shorter prefixes (3-digit, 2-digit)
  for (let len = 3; len >= 2; len--) {
    const prefix = cleanZip.slice(0, len);
    if (ZIP_PREFIX_COORDINATES[prefix]) {
      return ZIP_PREFIX_COORDINATES[prefix];
    }
  }
  
  // Fallback to 2-digit prefix for general region
  const twoDigit = cleanZip.slice(0, 2);
  return ZIP_PREFIX_COORDINATES[twoDigit] || null;
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
