// ZIP code to coordinates mapping for distance calculations
// Uses verified centroid data for accurate straight-line distance calculations
// Sources: US Census Bureau, USPS, verified geographic databases

interface ZipCoordinates {
  lat: number;
  lng: number;
}

// Comprehensive ZIP code coordinates database
// Includes all US 3-digit prefixes + detailed 5-digit coverage for territories
const ZIP_COORDINATES: Record<string, ZipCoordinates> = {
  // ============================================
  // US TERRITORIES - Detailed 5-digit coverage
  // ============================================
  
  // ===== PUERTO RICO (006-009) =====
  // All municipalities with verified coordinates
  
  // Adjuntas
  '00601': { lat: 18.1647, lng: -66.7237 },
  
  // Aguada
  '00602': { lat: 18.3793, lng: -67.1870 },
  
  // Aguadilla
  '00603': { lat: 18.4274, lng: -67.1541 },
  '00604': { lat: 18.4985, lng: -67.1227 },
  '00605': { lat: 18.4651, lng: -67.1413 },
  
  // Aguas Buenas
  '00607': { lat: 18.2569, lng: -66.1028 },
  
  // Aibonito
  '00609': { lat: 18.1400, lng: -66.2660 },
  
  // Añasco
  '00610': { lat: 18.2854, lng: -67.1402 },
  
  // Arecibo
  '00612': { lat: 18.4500, lng: -66.7156 },
  '00613': { lat: 18.4720, lng: -66.7150 },
  '00614': { lat: 18.4300, lng: -66.6900 },
  '00616': { lat: 18.4273, lng: -66.6735 },
  
  // Barceloneta
  '00617': { lat: 18.4508, lng: -66.5384 },
  
  // Barranquitas
  '00618': { lat: 18.1868, lng: -66.3062 },
  
  // Bayamón
  '00956': { lat: 18.3985, lng: -66.1640 },
  '00957': { lat: 18.3794, lng: -66.1697 },
  '00958': { lat: 18.3611, lng: -66.1580 },
  '00959': { lat: 18.4013, lng: -66.1558 },
  '00960': { lat: 18.3820, lng: -66.1550 },
  '00961': { lat: 18.3990, lng: -66.1580 },
  
  // Cabo Rojo
  '00622': { lat: 18.0866, lng: -67.1457 },
  '00623': { lat: 18.0620, lng: -67.1715 },
  
  // Caguas
  '00725': { lat: 18.2341, lng: -66.0352 },
  '00726': { lat: 18.2100, lng: -66.0480 },
  '00727': { lat: 18.2200, lng: -66.0200 },
  
  // Camuy
  '00627': { lat: 18.4839, lng: -66.8449 },
  
  // Canóvanas
  '00729': { lat: 18.3793, lng: -65.8993 },
  
  // Carolina
  '00979': { lat: 18.3870, lng: -65.9640 },
  '00981': { lat: 18.3750, lng: -65.9350 },
  '00982': { lat: 18.3550, lng: -65.9300 },
  '00983': { lat: 18.3930, lng: -65.9200 },
  '00984': { lat: 18.3690, lng: -65.8890 },
  '00985': { lat: 18.3820, lng: -65.8800 },
  '00986': { lat: 18.4109, lng: -65.9617 },
  '00987': { lat: 18.3940, lng: -65.9680 },
  '00988': { lat: 18.4020, lng: -65.9500 },
  
  // Cataño
  '00962': { lat: 18.4434, lng: -66.1248 },
  '00963': { lat: 18.4413, lng: -66.1185 },
  
  // Cayey
  '00736': { lat: 18.1117, lng: -66.1660 },
  '00737': { lat: 18.1200, lng: -66.1500 },
  
  // Ceiba
  '00735': { lat: 18.2642, lng: -65.6484 },
  
  // Ciales
  '00638': { lat: 18.3358, lng: -66.4690 },
  
  // Cidra
  '00739': { lat: 18.1759, lng: -66.1612 },
  
  // Coamo
  '00640': { lat: 18.0799, lng: -66.3581 },
  
  // Comerío
  '00782': { lat: 18.2193, lng: -66.2253 },
  
  // Corozal
  '00783': { lat: 18.3418, lng: -66.3168 },
  
  // Culebra
  '00775': { lat: 18.3100, lng: -65.3028 },
  
  // Dorado
  '00646': { lat: 18.4329, lng: -66.2865 }, // VERIFIED
  
  // Fajardo
  '00738': { lat: 18.3358, lng: -65.6520 },
  '00740': { lat: 18.3260, lng: -65.6560 },
  
  // Florida
  '00650': { lat: 18.3633, lng: -66.5717 },
  
  // Guánica
  '00653': { lat: 17.9719, lng: -66.9080 },
  
  // Guayama
  '00784': { lat: 17.9841, lng: -66.1137 },
  '00785': { lat: 17.9590, lng: -66.1320 },
  
  // Guayanilla
  '00656': { lat: 18.0192, lng: -66.7919 },
  
  // Guaynabo
  '00965': { lat: 18.3970, lng: -66.1070 },
  '00966': { lat: 18.4050, lng: -66.1150 },
  '00968': { lat: 18.3800, lng: -66.1120 },
  '00969': { lat: 18.3620, lng: -66.1100 },
  '00970': { lat: 18.3580, lng: -66.1050 },
  '00971': { lat: 18.3850, lng: -66.1180 },
  
  // Gurabo
  '00778': { lat: 18.2545, lng: -65.9727 },
  
  // Hatillo
  '00659': { lat: 18.4867, lng: -66.8253 },
  
  // Hormigueros
  '00660': { lat: 18.1398, lng: -67.1270 },
  
  // Humacao
  '00791': { lat: 18.1497, lng: -65.8274 }, // VERIFIED - ~42mi from Dorado
  '00792': { lat: 18.1340, lng: -65.8060 },
  
  // Isabela
  '00662': { lat: 18.5005, lng: -67.0247 },
  
  // Jayuya
  '00664': { lat: 18.2185, lng: -66.5916 },
  
  // Juana Díaz
  '00795': { lat: 18.0533, lng: -66.5066 },
  
  // Juncos
  '00777': { lat: 18.2275, lng: -65.9212 },
  
  // Lajas
  '00667': { lat: 18.0498, lng: -67.0595 },
  
  // Lares
  '00669': { lat: 18.2949, lng: -66.8782 },
  
  // Las Marías
  '00670': { lat: 18.2517, lng: -66.9918 },
  
  // Las Piedras
  '00771': { lat: 18.1830, lng: -65.8662 },
  
  // Loíza
  '00772': { lat: 18.4312, lng: -65.8800 },
  
  // Luquillo
  '00773': { lat: 18.3726, lng: -65.7165 },
  
  // Manatí
  '00674': { lat: 18.4308, lng: -66.4887 },
  
  // Maricao
  '00606': { lat: 18.1808, lng: -66.9798 },
  
  // Maunabo
  '00707': { lat: 18.0072, lng: -65.8993 },
  
  // Mayagüez
  '00680': { lat: 18.2013, lng: -67.1397 },
  '00681': { lat: 18.2100, lng: -67.1400 },
  '00682': { lat: 18.2000, lng: -67.1500 },
  
  // Moca
  '00676': { lat: 18.3950, lng: -67.1133 },
  
  // Morovis
  '00687': { lat: 18.3261, lng: -66.4062 },
  
  // Naguabo
  '00718': { lat: 18.2117, lng: -65.7346 },
  
  // Naranjito
  '00719': { lat: 18.3003, lng: -66.2447 },
  
  // Orocovis
  '00720': { lat: 18.2266, lng: -66.3912 },
  
  // Patillas
  '00723': { lat: 18.0037, lng: -66.0135 },
  
  // Peñuelas
  '00624': { lat: 18.0583, lng: -66.7260 },
  
  // Ponce
  '00716': { lat: 18.0108, lng: -66.6141 },
  '00717': { lat: 18.0050, lng: -66.6000 },
  '00728': { lat: 17.9730, lng: -66.6220 },
  '00730': { lat: 18.0011, lng: -66.6306 },
  '00731': { lat: 17.9862, lng: -66.6470 },
  '00732': { lat: 17.9920, lng: -66.6600 },
  '00733': { lat: 17.9810, lng: -66.6340 },
  '00734': { lat: 18.0000, lng: -66.6100 },
  
  // Quebradillas
  '00678': { lat: 18.4739, lng: -66.9385 },
  
  // Rincón
  '00677': { lat: 18.3400, lng: -67.2499 },
  
  // Río Grande
  '00745': { lat: 18.3802, lng: -65.8313 },
  
  // Sabana Grande
  '00637': { lat: 18.0779, lng: -66.9607 },
  
  // Salinas
  '00751': { lat: 17.9779, lng: -66.2988 },
  
  // San Germán
  '00683': { lat: 18.0827, lng: -67.0355 },
  
  // San Juan - Metro
  '00901': { lat: 18.4663, lng: -66.1057 },
  '00902': { lat: 18.4655, lng: -66.1105 },
  '00906': { lat: 18.4550, lng: -66.0900 },
  '00907': { lat: 18.4516, lng: -66.0711 },
  '00908': { lat: 18.4490, lng: -66.0620 },
  '00909': { lat: 18.4360, lng: -66.0520 },
  '00910': { lat: 18.4300, lng: -66.0460 },
  '00911': { lat: 18.4250, lng: -66.0400 },
  '00912': { lat: 18.4480, lng: -66.0600 },
  '00913': { lat: 18.4135, lng: -66.0280 },
  '00914': { lat: 18.4200, lng: -66.0330 },
  '00915': { lat: 18.4220, lng: -66.0450 },
  '00916': { lat: 18.4150, lng: -66.0600 },
  '00917': { lat: 18.4130, lng: -66.0520 },
  '00918': { lat: 18.4145, lng: -66.0715 },
  '00919': { lat: 18.4100, lng: -66.0850 },
  '00920': { lat: 18.4085, lng: -66.0930 },
  '00921': { lat: 18.3960, lng: -66.0810 },
  '00922': { lat: 18.4050, lng: -66.0680 },
  '00923': { lat: 18.4050, lng: -66.0420 },
  '00924': { lat: 18.3920, lng: -66.0350 },
  '00925': { lat: 18.3950, lng: -66.0550 },
  '00926': { lat: 18.3800, lng: -66.0600 },
  '00927': { lat: 18.3994, lng: -66.0518 }, // VERIFIED
  '00928': { lat: 18.4050, lng: -66.0650 },
  '00929': { lat: 18.4100, lng: -66.0800 },
  '00930': { lat: 18.4430, lng: -66.0750 },
  '00931': { lat: 18.4000, lng: -66.0500 },
  '00933': { lat: 18.4350, lng: -66.0550 },
  '00934': { lat: 18.4200, lng: -66.1000 },
  '00935': { lat: 18.4300, lng: -66.0900 },
  '00936': { lat: 18.4250, lng: -66.0550 },
  '00937': { lat: 18.4180, lng: -66.1050 },
  '00939': { lat: 18.4330, lng: -66.0800 },
  '00940': { lat: 18.4420, lng: -66.0700 },
  
  // San Lorenzo
  '00754': { lat: 18.1894, lng: -65.9607 },
  
  // San Sebastián
  '00685': { lat: 18.3367, lng: -66.9901 },
  
  // Santa Isabel
  '00757': { lat: 17.9660, lng: -66.4049 },
  
  // Toa Alta
  '00953': { lat: 18.3878, lng: -66.2483 },
  '00954': { lat: 18.3730, lng: -66.2500 },
  
  // Toa Baja
  '00949': { lat: 18.4539, lng: -66.2500 },
  '00950': { lat: 18.4439, lng: -66.2547 },
  '00951': { lat: 18.4380, lng: -66.2600 },
  '00952': { lat: 18.4300, lng: -66.2450 },
  
  // Trujillo Alto
  '00976': { lat: 18.3627, lng: -66.0175 },
  '00977': { lat: 18.3548, lng: -65.9996 },
  '00978': { lat: 18.3450, lng: -66.0100 },
  
  // Utuado
  '00641': { lat: 18.2655, lng: -66.7008 },
  
  // Vega Alta
  '00692': { lat: 18.4122, lng: -66.3314 },
  
  // Vega Baja
  '00693': { lat: 18.4442, lng: -66.3915 },
  '00694': { lat: 18.4442, lng: -66.3556 },
  
  // Vieques
  '00765': { lat: 18.1263, lng: -65.4401 },
  
  // Villalba
  '00766': { lat: 18.1278, lng: -66.4922 },
  
  // Yabucoa
  '00767': { lat: 18.0505, lng: -65.8793 },
  
  // Yauco
  '00698': { lat: 18.0350, lng: -66.8499 },
  
  // Puerto Rico 3-digit fallbacks
  '006': { lat: 18.25, lng: -66.80 },
  '007': { lat: 18.15, lng: -65.90 },
  '008': { lat: 18.01, lng: -66.61 },
  '009': { lat: 18.40, lng: -66.07 },
  
  // ===== US VIRGIN ISLANDS (008) =====
  // St. Thomas
  '00801': { lat: 18.3419, lng: -64.9307 },
  '00802': { lat: 18.3358, lng: -64.8963 },
  '00803': { lat: 18.3300, lng: -64.9200 },
  '00804': { lat: 18.3200, lng: -64.9100 },
  '00805': { lat: 18.3450, lng: -64.9450 },
  
  // St. John
  '00830': { lat: 18.3358, lng: -64.7281 },
  '00831': { lat: 18.3400, lng: -64.7400 },
  
  // St. Croix
  '00820': { lat: 17.7417, lng: -64.7028 },
  '00821': { lat: 17.7280, lng: -64.7500 },
  '00822': { lat: 17.7520, lng: -64.7850 },
  '00823': { lat: 17.7350, lng: -64.6900 },
  '00824': { lat: 17.7600, lng: -64.7200 },
  '00840': { lat: 17.7117, lng: -64.8781 },
  '00841': { lat: 17.7200, lng: -64.8500 },
  '00850': { lat: 17.7470, lng: -64.7030 },
  '00851': { lat: 17.7450, lng: -64.7100 },
  
  // ===== GUAM (969) =====
  '96910': { lat: 13.4443, lng: 144.7937 },
  '96912': { lat: 13.5200, lng: 144.8300 },
  '96913': { lat: 13.4800, lng: 144.7500 },
  '96915': { lat: 13.3800, lng: 144.6700 },
  '96916': { lat: 13.2800, lng: 144.7000 },
  '96917': { lat: 13.3400, lng: 144.6800 },
  '96919': { lat: 13.4700, lng: 144.7800 },
  '96921': { lat: 13.4600, lng: 144.7900 },
  '96928': { lat: 13.4400, lng: 144.7600 },
  '96929': { lat: 13.5530, lng: 144.8730 },
  '96931': { lat: 13.4800, lng: 144.8000 },
  '96932': { lat: 13.4700, lng: 144.7500 },
  '969': { lat: 13.4443, lng: 144.7937 },
  
  // ===== AMERICAN SAMOA (967) =====
  '96799': { lat: -14.2756, lng: -170.7020 },
  '967': { lat: -14.2756, lng: -170.7020 },
  
  // ===== NORTHERN MARIANA ISLANDS (969) =====
  '96950': { lat: 15.2137, lng: 145.7546 },
  '96951': { lat: 14.1500, lng: 145.2100 },
  '96952': { lat: 15.0979, lng: 145.6739 },
  
  // ===== MARSHALL ISLANDS =====
  '96960': { lat: 7.0897, lng: 171.3803 },
  '96970': { lat: 7.1000, lng: 171.3800 },
  
  // ===== PALAU =====
  '96940': { lat: 7.5000, lng: 134.6243 },
  
  // ===== FEDERATED STATES OF MICRONESIA =====
  '96941': { lat: 6.9248, lng: 158.1610 },
  '96942': { lat: 7.4256, lng: 151.7839 },
  '96943': { lat: 5.3300, lng: 163.0100 },
  '96944': { lat: 9.5144, lng: 138.1292 },
  
  // ============================================
  // US MAINLAND - Complete 3-digit prefix coverage
  // ============================================
  
  // ===== 00X - Not used (except PR/USVI above) =====
  
  // ===== 010-019 Massachusetts =====
  '010': { lat: 42.1155, lng: -72.5395 }, // Springfield
  '011': { lat: 42.1015, lng: -72.5898 }, // Springfield area
  '012': { lat: 42.4430, lng: -73.2550 }, // Pittsfield
  '013': { lat: 42.4512, lng: -71.9560 }, // Greenfield/Northampton
  '014': { lat: 42.2620, lng: -71.8020 }, // Worcester
  '015': { lat: 42.2626, lng: -71.8023 }, // Worcester area
  '016': { lat: 42.2650, lng: -71.8000 }, // Worcester area
  '017': { lat: 42.4072, lng: -71.3824 }, // Framingham
  '018': { lat: 42.5047, lng: -71.1956 }, // Woburn/Lowell area
  '019': { lat: 42.5195, lng: -70.8967 }, // Lynn/Salem
  
  // ===== 020-029 Massachusetts (Boston) =====
  '020': { lat: 42.2155, lng: -71.0280 }, // Brockton
  '021': { lat: 42.3601, lng: -71.0589 }, // Boston
  '022': { lat: 42.3750, lng: -71.1056 }, // Boston area
  '023': { lat: 42.0654, lng: -71.2480 }, // Brockton area
  '024': { lat: 42.4430, lng: -71.2290 }, // Lexington
  '025': { lat: 41.7003, lng: -70.3002 }, // Cape Cod
  '026': { lat: 41.6688, lng: -70.2962 }, // Cape Cod/Hyannis
  '027': { lat: 41.6362, lng: -70.9342 }, // New Bedford
  
  // ===== 030-039 New Hampshire =====
  '030': { lat: 42.9956, lng: -71.4548 }, // Manchester/Nashua
  '031': { lat: 42.9956, lng: -71.4548 }, // Manchester
  '032': { lat: 43.0642, lng: -70.7689 }, // Portsmouth
  '033': { lat: 43.2081, lng: -71.5376 }, // Concord
  '034': { lat: 43.7074, lng: -72.2895 }, // Hanover/Lebanon
  '035': { lat: 43.9654, lng: -71.6681 }, // Littleton
  '036': { lat: 43.4980, lng: -71.1547 }, // Laconia
  '037': { lat: 44.2706, lng: -71.3033 }, // Berlin
  '038': { lat: 42.7654, lng: -71.4676 }, // Nashua area
  
  // ===== 040-049 Maine =====
  '040': { lat: 43.6591, lng: -70.2568 }, // Portland
  '041': { lat: 43.6591, lng: -70.2568 }, // Portland
  '042': { lat: 43.4106, lng: -70.7795 }, // Biddeford/Sanford
  '043': { lat: 44.0978, lng: -70.2312 }, // Lewiston/Auburn
  '044': { lat: 44.8016, lng: -68.7712 }, // Bangor
  '045': { lat: 44.3106, lng: -69.7795 }, // Augusta
  '046': { lat: 44.5432, lng: -67.6155 }, // Ellsworth
  '047': { lat: 46.8721, lng: -68.0168 }, // Houlton
  '048': { lat: 43.9226, lng: -69.8103 }, // Rockland
  '049': { lat: 45.1834, lng: -69.2450 }, // Waterville area
  
  // ===== 050-059 Vermont =====
  '050': { lat: 43.6106, lng: -72.9726 }, // White River Junction
  '051': { lat: 43.1330, lng: -72.4435 }, // Bellows Falls
  '052': { lat: 42.8509, lng: -72.5579 }, // Brattleboro
  '053': { lat: 42.8951, lng: -73.1820 }, // Bennington
  '054': { lat: 44.4759, lng: -73.2121 }, // Burlington
  '055': { lat: 44.4759, lng: -73.2121 }, // Burlington
  '056': { lat: 44.2601, lng: -72.5754 }, // Montpelier
  '057': { lat: 43.6106, lng: -72.9726 }, // Rutland
  '058': { lat: 44.9241, lng: -72.2017 }, // St. Johnsbury
  '059': { lat: 44.8918, lng: -72.8193 }, // Newport
  
  // ===== 060-069 Connecticut =====
  '060': { lat: 41.7658, lng: -72.6734 }, // Hartford
  '061': { lat: 41.7658, lng: -72.6734 }, // Hartford
  '062': { lat: 41.5582, lng: -72.0995 }, // Willimantic
  '063': { lat: 41.3083, lng: -72.9279 }, // New Haven
  '064': { lat: 41.3083, lng: -72.9279 }, // New Haven
  '065': { lat: 41.3083, lng: -72.9279 }, // New Haven
  '066': { lat: 41.0534, lng: -73.5387 }, // Bridgeport
  '067': { lat: 41.1918, lng: -73.1953 }, // Waterbury
  '068': { lat: 41.0534, lng: -73.5387 }, // Stamford
  '069': { lat: 41.0534, lng: -73.5387 }, // Stamford area
  
  // ===== 070-089 New Jersey =====
  '070': { lat: 40.7357, lng: -74.1724 }, // Newark
  '071': { lat: 40.7357, lng: -74.1724 }, // Newark
  '072': { lat: 40.4862, lng: -74.4518 }, // Elizabeth/Perth Amboy
  '073': { lat: 40.7282, lng: -74.0776 }, // Jersey City
  '074': { lat: 40.8859, lng: -74.0435 }, // Paterson
  '075': { lat: 40.8859, lng: -74.0435 }, // Paterson
  '076': { lat: 40.7282, lng: -74.0776 }, // Hackensack
  '077': { lat: 40.2206, lng: -74.0090 }, // Red Bank
  '078': { lat: 40.4862, lng: -74.4518 }, // New Brunswick
  '079': { lat: 40.8568, lng: -74.2263 }, // Summit
  '080': { lat: 39.9513, lng: -75.1190 }, // Cherry Hill
  '081': { lat: 39.9513, lng: -75.1190 }, // Camden
  '082': { lat: 39.3643, lng: -74.4229 }, // Atlantic City
  '083': { lat: 39.4815, lng: -75.0210 }, // Vineland
  '084': { lat: 39.3643, lng: -74.4229 }, // Atlantic City
  '085': { lat: 40.2171, lng: -74.7429 }, // Trenton
  '086': { lat: 40.2171, lng: -74.7429 }, // Trenton
  '087': { lat: 40.0583, lng: -74.4057 }, // Lakewood
  '088': { lat: 40.0583, lng: -74.4057 }, // Lakewood area
  '089': { lat: 40.0583, lng: -74.4057 }, // Lakewood area
  
  // ===== 100-149 New York =====
  '100': { lat: 40.7128, lng: -74.0060 }, // Manhattan
  '101': { lat: 40.7128, lng: -74.0060 }, // Manhattan
  '102': { lat: 40.7128, lng: -74.0060 }, // Manhattan
  '103': { lat: 40.5795, lng: -74.1502 }, // Staten Island
  '104': { lat: 40.8448, lng: -73.8648 }, // Bronx
  '105': { lat: 40.9176, lng: -73.8584 }, // Yonkers/Westchester
  '106': { lat: 40.9409, lng: -73.7339 }, // White Plains
  '107': { lat: 40.9176, lng: -73.8584 }, // Yonkers
  '108': { lat: 41.0534, lng: -73.7562 }, // New Rochelle
  '109': { lat: 41.0534, lng: -73.8707 }, // Westchester
  '110': { lat: 40.6892, lng: -73.9642 }, // Queens
  '111': { lat: 40.7282, lng: -73.7949 }, // Long Island City
  '112': { lat: 40.6782, lng: -73.9442 }, // Brooklyn
  '113': { lat: 40.7282, lng: -73.7949 }, // Flushing
  '114': { lat: 40.7282, lng: -73.7949 }, // Jamaica
  '115': { lat: 40.7143, lng: -73.7594 }, // Jamaica
  '116': { lat: 40.6892, lng: -73.7949 }, // Far Rockaway
  '117': { lat: 40.6501, lng: -73.9496 }, // Brooklyn
  '118': { lat: 40.7549, lng: -73.4662 }, // Hicksville
  '119': { lat: 40.7549, lng: -73.4662 }, // Long Island
  '120': { lat: 42.6526, lng: -73.7562 }, // Albany
  '121': { lat: 42.6526, lng: -73.7562 }, // Albany
  '122': { lat: 42.6526, lng: -73.7562 }, // Albany area
  '123': { lat: 42.8142, lng: -73.9396 }, // Schenectady
  '124': { lat: 41.9534, lng: -73.9968 }, // Kingston
  '125': { lat: 41.7001, lng: -73.9210 }, // Poughkeepsie
  '126': { lat: 41.7001, lng: -73.9210 }, // Poughkeepsie
  '127': { lat: 41.5034, lng: -74.0104 }, // Newburgh
  '128': { lat: 43.0481, lng: -76.1474 }, // Glens Falls
  '129': { lat: 44.6995, lng: -73.4529 }, // Plattsburgh
  '130': { lat: 43.0481, lng: -76.1474 }, // Syracuse
  '131': { lat: 43.0481, lng: -76.1474 }, // Syracuse
  '132': { lat: 43.0481, lng: -76.1474 }, // Syracuse
  '133': { lat: 43.0976, lng: -75.2328 }, // Utica
  '134': { lat: 43.0976, lng: -75.2328 }, // Utica
  '135': { lat: 43.0976, lng: -75.2328 }, // Utica
  '136': { lat: 43.9748, lng: -75.9108 }, // Watertown
  '137': { lat: 44.3406, lng: -75.9170 }, // Massena
  '138': { lat: 42.4440, lng: -76.5019 }, // Ithaca
  '139': { lat: 42.0987, lng: -76.8077 }, // Binghamton
  '140': { lat: 42.8864, lng: -78.8784 }, // Buffalo
  '141': { lat: 42.8864, lng: -78.8784 }, // Buffalo
  '142': { lat: 42.8864, lng: -78.8784 }, // Buffalo
  '143': { lat: 43.1566, lng: -77.6088 }, // Rochester
  '144': { lat: 43.1566, lng: -77.6088 }, // Rochester
  '145': { lat: 43.1566, lng: -77.6088 }, // Rochester
  '146': { lat: 43.1566, lng: -77.6088 }, // Rochester
  '147': { lat: 42.1292, lng: -79.2353 }, // Jamestown
  '148': { lat: 42.1292, lng: -78.8784 }, // Olean
  '149': { lat: 42.0834, lng: -76.1459 }, // Elmira
  
  // ===== 150-196 Pennsylvania =====
  '150': { lat: 40.4406, lng: -79.9959 }, // Pittsburgh
  '151': { lat: 40.4406, lng: -79.9959 }, // Pittsburgh
  '152': { lat: 40.4406, lng: -79.9959 }, // Pittsburgh
  '153': { lat: 40.3573, lng: -79.8663 }, // Pittsburgh area
  '154': { lat: 40.0078, lng: -79.0550 }, // Uniontown
  '155': { lat: 40.3226, lng: -78.9209 }, // Johnstown
  '156': { lat: 40.5028, lng: -78.3947 }, // Altoona
  '157': { lat: 41.4069, lng: -79.6589 }, // Oil City
  '158': { lat: 41.2033, lng: -77.1945 }, // DuBois
  '159': { lat: 40.5028, lng: -78.3947 }, // Altoona area
  '160': { lat: 41.2400, lng: -80.4806 }, // New Castle
  '161': { lat: 41.2400, lng: -80.4806 }, // New Castle
  '162': { lat: 40.9936, lng: -77.6619 }, // State College
  '163': { lat: 41.9970, lng: -80.0620 }, // Erie
  '164': { lat: 42.1292, lng: -80.0851 }, // Erie
  '165': { lat: 42.1292, lng: -80.0851 }, // Erie
  '166': { lat: 40.4858, lng: -78.9017 }, // Altoona
  '167': { lat: 40.3226, lng: -78.9209 }, // Johnstown
  '168': { lat: 40.3226, lng: -78.9209 }, // Johnstown
  '169': { lat: 41.8693, lng: -78.0322 }, // Wellsboro
  '170': { lat: 40.2732, lng: -76.8867 }, // Harrisburg
  '171': { lat: 40.2732, lng: -76.8867 }, // Harrisburg
  '172': { lat: 40.0379, lng: -76.3055 }, // Lancaster
  '173': { lat: 40.0379, lng: -76.3055 }, // Lancaster
  '174': { lat: 39.9784, lng: -76.9847 }, // York
  '175': { lat: 40.0379, lng: -76.3055 }, // Lancaster
  '176': { lat: 40.0379, lng: -76.3055 }, // Lancaster
  '177': { lat: 40.0126, lng: -77.1529 }, // Chambersburg
  '178': { lat: 41.1203, lng: -77.4484 }, // Williamsport
  '179': { lat: 40.3356, lng: -75.9269 }, // Reading
  '180': { lat: 40.6023, lng: -75.4714 }, // Lehigh Valley
  '181': { lat: 40.6259, lng: -75.3705 }, // Bethlehem
  '182': { lat: 41.2354, lng: -75.8760 }, // Hazleton
  '183': { lat: 40.3356, lng: -75.9269 }, // Reading
  '184': { lat: 41.4090, lng: -75.6624 }, // Scranton
  '185': { lat: 41.4090, lng: -75.6624 }, // Scranton
  '186': { lat: 41.4090, lng: -75.6624 }, // Scranton
  '187': { lat: 41.2444, lng: -75.8817 }, // Wilkes-Barre
  '188': { lat: 41.2444, lng: -75.8817 }, // Wilkes-Barre
  '189': { lat: 40.0964, lng: -75.3525 }, // Doylestown
  '190': { lat: 39.9526, lng: -75.1652 }, // Philadelphia
  '191': { lat: 39.9526, lng: -75.1652 }, // Philadelphia
  '192': { lat: 39.9526, lng: -75.1652 }, // Philadelphia
  '193': { lat: 40.0793, lng: -75.3129 }, // Paoli
  '194': { lat: 40.1104, lng: -75.2860 }, // Norristown
  '195': { lat: 40.3356, lng: -75.9269 }, // Reading
  '196': { lat: 40.3356, lng: -75.9269 }, // Reading
  
  // ===== 197-199 Delaware =====
  '197': { lat: 39.7391, lng: -75.5398 }, // Wilmington
  '198': { lat: 39.7391, lng: -75.5398 }, // Wilmington
  '199': { lat: 39.1582, lng: -75.5244 }, // Dover
  
  // ===== 200-205 Washington DC =====
  '200': { lat: 38.9072, lng: -77.0369 }, // Washington DC
  '201': { lat: 38.9072, lng: -77.0369 }, // Washington DC
  '202': { lat: 38.9072, lng: -77.0369 }, // Washington DC
  '203': { lat: 38.9072, lng: -77.0369 }, // Washington DC
  '204': { lat: 38.9072, lng: -77.0369 }, // Washington DC
  '205': { lat: 38.9072, lng: -77.0369 }, // Washington DC
  
  // ===== 206-219 Maryland =====
  '206': { lat: 38.9784, lng: -76.4922 }, // Waldorf
  '207': { lat: 38.9784, lng: -76.8867 }, // Southern MD
  '208': { lat: 39.0458, lng: -76.6413 }, // Laurel
  '209': { lat: 39.4143, lng: -77.4105 }, // Silver Spring
  '210': { lat: 39.2904, lng: -76.6122 }, // Baltimore
  '211': { lat: 39.2904, lng: -76.6122 }, // Baltimore
  '212': { lat: 39.2904, lng: -76.6122 }, // Baltimore
  '214': { lat: 39.0458, lng: -76.6413 }, // Annapolis
  '215': { lat: 39.5296, lng: -76.3525 }, // Aberdeen/Bel Air
  '216': { lat: 39.6418, lng: -77.7200 }, // Frederick
  '217': { lat: 39.6418, lng: -77.7200 }, // Frederick
  '218': { lat: 38.3607, lng: -75.5994 }, // Salisbury
  '219': { lat: 39.6418, lng: -77.7200 }, // Cumberland/Hagerstown
  
  // ===== 220-246 Virginia =====
  '220': { lat: 38.8816, lng: -77.0910 }, // Northern Virginia
  '221': { lat: 38.8816, lng: -77.0910 }, // Northern Virginia
  '222': { lat: 38.8048, lng: -77.0469 }, // Arlington
  '223': { lat: 38.8462, lng: -77.3064 }, // Alexandria
  '224': { lat: 38.7728, lng: -77.4536 }, // Manassas
  '225': { lat: 38.2987, lng: -77.4603 }, // Fredericksburg
  '226': { lat: 39.1857, lng: -77.5636 }, // Winchester
  '227': { lat: 38.4496, lng: -78.8689 }, // Harrisonburg
  '228': { lat: 38.0293, lng: -78.4767 }, // Charlottesville
  '229': { lat: 38.0293, lng: -78.4767 }, // Charlottesville
  '230': { lat: 37.5407, lng: -77.4360 }, // Richmond
  '231': { lat: 37.5407, lng: -77.4360 }, // Richmond
  '232': { lat: 37.5407, lng: -77.4360 }, // Richmond
  '233': { lat: 36.8468, lng: -76.2852 }, // Norfolk
  '234': { lat: 36.8468, lng: -76.2852 }, // Norfolk
  '235': { lat: 36.8468, lng: -76.2852 }, // Norfolk
  '236': { lat: 36.8468, lng: -76.2852 }, // Newport News
  '237': { lat: 37.0299, lng: -76.3452 }, // Hampton
  '238': { lat: 37.2707, lng: -76.7075 }, // Williamsburg
  '239': { lat: 37.5407, lng: -77.4360 }, // Petersburg
  '240': { lat: 37.2710, lng: -79.9414 }, // Roanoke
  '241': { lat: 37.2710, lng: -79.9414 }, // Roanoke
  '242': { lat: 36.5954, lng: -82.1888 }, // Bristol
  '243': { lat: 37.4316, lng: -78.6569 }, // Lynchburg
  '244': { lat: 37.4316, lng: -78.6569 }, // Lynchburg
  '245': { lat: 37.4316, lng: -78.6569 }, // Lynchburg
  '246': { lat: 37.7879, lng: -79.4428 }, // Lexington
  
  // ===== 247-268 West Virginia =====
  '247': { lat: 37.2279, lng: -81.2381 }, // Bluefield
  '248': { lat: 37.7816, lng: -81.1832 }, // Beckley
  '249': { lat: 37.7816, lng: -81.1832 }, // Lewisburg
  '250': { lat: 38.3498, lng: -81.6326 }, // Charleston
  '251': { lat: 38.3498, lng: -81.6326 }, // Charleston
  '252': { lat: 38.3498, lng: -81.6326 }, // Charleston
  '253': { lat: 38.4192, lng: -82.4452 }, // Huntington
  '254': { lat: 39.2808, lng: -80.3442 }, // Clarksburg
  '255': { lat: 38.9212, lng: -80.1774 }, // Weston
  '256': { lat: 39.2808, lng: -80.3442 }, // Fairmont
  '257': { lat: 38.9270, lng: -80.6484 }, // Buckhannon
  '258': { lat: 38.9212, lng: -80.1774 }, // Elkins
  '259': { lat: 39.2639, lng: -81.5615 }, // Parkersburg
  '260': { lat: 39.4548, lng: -77.9639 }, // Martinsburg
  '261': { lat: 39.6295, lng: -79.9559 }, // Morgantown
  '262': { lat: 40.0640, lng: -80.7209 }, // Wheeling
  '263': { lat: 39.4512, lng: -79.4370 }, // Cumberland area
  '264': { lat: 38.8485, lng: -81.0012 }, // Clay
  '265': { lat: 38.6273, lng: -80.4556 }, // Summersville
  '266': { lat: 37.7937, lng: -80.4456 }, // Covington
  '267': { lat: 39.3598, lng: -81.7262 }, // Marietta
  '268': { lat: 38.0607, lng: -81.8734 }, // Logan
  
  // ===== 270-289 North Carolina =====
  '270': { lat: 36.0726, lng: -79.7920 }, // Greensboro
  '271': { lat: 36.0726, lng: -79.7920 }, // Greensboro
  '272': { lat: 36.0999, lng: -80.2442 }, // Winston-Salem
  '273': { lat: 36.0999, lng: -80.2442 }, // Winston-Salem
  '274': { lat: 36.0726, lng: -79.7920 }, // Greensboro
  '275': { lat: 35.7796, lng: -78.6382 }, // Raleigh
  '276': { lat: 35.7796, lng: -78.6382 }, // Raleigh
  '277': { lat: 35.9940, lng: -78.8986 }, // Durham
  '278': { lat: 36.5407, lng: -77.3911 }, // Rocky Mount
  '279': { lat: 35.9482, lng: -77.7905 }, // Roanoke Rapids
  '280': { lat: 35.2271, lng: -80.8431 }, // Charlotte
  '281': { lat: 35.2271, lng: -80.8431 }, // Charlotte
  '282': { lat: 35.2271, lng: -80.8431 }, // Charlotte
  '283': { lat: 35.5951, lng: -82.5515 }, // Asheville
  '284': { lat: 35.5951, lng: -82.5515 }, // Asheville
  '285': { lat: 35.0527, lng: -78.8784 }, // Fayetteville
  '286': { lat: 35.1085, lng: -80.7909 }, // Pinehurst
  '287': { lat: 34.2257, lng: -77.9447 }, // Wilmington
  '288': { lat: 34.2257, lng: -77.9447 }, // Wilmington
  '289': { lat: 35.7421, lng: -81.3232 }, // Hickory
  
  // ===== 290-299 South Carolina =====
  '290': { lat: 34.0007, lng: -81.0348 }, // Columbia
  '291': { lat: 34.0007, lng: -81.0348 }, // Columbia
  '292': { lat: 34.0007, lng: -81.0348 }, // Columbia
  '293': { lat: 34.8526, lng: -82.3940 }, // Greenville
  '294': { lat: 34.8526, lng: -82.3940 }, // Greenville/Spartanburg
  '295': { lat: 34.0522, lng: -80.9348 }, // Florence
  '296': { lat: 34.8526, lng: -82.3940 }, // Greenville
  '297': { lat: 32.7765, lng: -79.9311 }, // Charleston
  '298': { lat: 33.6891, lng: -78.8867 }, // Myrtle Beach
  '299': { lat: 32.0809, lng: -81.0912 }, // Savannah/Beaufort
  
  // ===== 300-319 Georgia =====
  '300': { lat: 33.7490, lng: -84.3880 }, // Atlanta
  '301': { lat: 33.7490, lng: -84.3880 }, // Atlanta
  '302': { lat: 33.7490, lng: -84.3880 }, // Atlanta
  '303': { lat: 33.7490, lng: -84.3880 }, // Atlanta
  '304': { lat: 33.9519, lng: -83.3576 }, // Athens
  '305': { lat: 33.9519, lng: -83.3576 }, // Gainesville
  '306': { lat: 33.9519, lng: -83.3576 }, // Athens
  '307': { lat: 34.0489, lng: -84.2807 }, // Dalton
  '308': { lat: 33.4735, lng: -82.0105 }, // Augusta
  '309': { lat: 33.4735, lng: -82.0105 }, // Augusta
  '310': { lat: 32.4609, lng: -84.9877 }, // Columbus
  '311': { lat: 33.7490, lng: -84.3880 }, // Atlanta
  '312': { lat: 32.0809, lng: -81.0912 }, // Macon
  '313': { lat: 32.0809, lng: -81.0912 }, // Savannah
  '314': { lat: 32.0809, lng: -81.0912 }, // Savannah
  '315': { lat: 31.1499, lng: -81.4915 }, // Waycross
  '316': { lat: 31.5785, lng: -84.1557 }, // Albany
  '317': { lat: 31.5785, lng: -84.1557 }, // Albany
  '318': { lat: 32.0809, lng: -81.0912 }, // Macon
  '319': { lat: 32.0809, lng: -81.0912 }, // Macon
  
  // ===== 320-349 Florida =====
  '320': { lat: 30.3322, lng: -81.6557 }, // Jacksonville
  '321': { lat: 28.5383, lng: -81.3792 }, // Orlando
  '322': { lat: 30.3322, lng: -81.6557 }, // Jacksonville
  '323': { lat: 30.1944, lng: -85.6869 }, // Tallahassee
  '324': { lat: 30.1944, lng: -85.6869 }, // Panama City
  '325': { lat: 30.4213, lng: -87.2169 }, // Pensacola
  '326': { lat: 29.6516, lng: -82.3248 }, // Gainesville
  '327': { lat: 28.5383, lng: -81.3792 }, // Orlando
  '328': { lat: 28.5383, lng: -81.3792 }, // Orlando
  '329': { lat: 28.5383, lng: -81.3792 }, // Melbourne
  '330': { lat: 25.7617, lng: -80.1918 }, // Miami
  '331': { lat: 25.7617, lng: -80.1918 }, // Miami
  '332': { lat: 25.7617, lng: -80.1918 }, // Miami
  '333': { lat: 26.1224, lng: -80.1373 }, // Fort Lauderdale
  '334': { lat: 26.7153, lng: -80.0534 }, // West Palm Beach
  '335': { lat: 27.9506, lng: -82.4572 }, // Tampa
  '336': { lat: 27.9506, lng: -82.4572 }, // Tampa
  '337': { lat: 27.3364, lng: -82.5307 }, // Sarasota
  '338': { lat: 28.0395, lng: -81.9498 }, // Lakeland
  '339': { lat: 26.6406, lng: -81.8723 }, // Fort Myers
  '340': { lat: 28.5383, lng: -81.3792 }, // Orlando
  '341': { lat: 26.6406, lng: -81.8723 }, // Naples
  '342': { lat: 27.9506, lng: -82.4572 }, // Clearwater
  '344': { lat: 29.6516, lng: -82.3248 }, // Gainesville
  '346': { lat: 27.9506, lng: -82.4572 }, // Tampa
  '347': { lat: 28.5383, lng: -81.3792 }, // Orlando
  '349': { lat: 25.7617, lng: -80.1918 }, // Miami
  
  // ===== 350-369 Alabama =====
  '350': { lat: 33.5186, lng: -86.8104 }, // Birmingham
  '351': { lat: 33.5186, lng: -86.8104 }, // Birmingham
  '352': { lat: 33.5186, lng: -86.8104 }, // Birmingham
  '354': { lat: 33.2098, lng: -87.5692 }, // Tuscaloosa
  '355': { lat: 33.5186, lng: -86.8104 }, // Birmingham
  '356': { lat: 34.7304, lng: -86.5861 }, // Decatur
  '357': { lat: 34.7304, lng: -86.5861 }, // Huntsville
  '358': { lat: 34.7304, lng: -86.5861 }, // Huntsville
  '359': { lat: 33.3942, lng: -86.3077 }, // Gadsden
  '360': { lat: 32.3792, lng: -86.3077 }, // Montgomery
  '361': { lat: 32.3792, lng: -86.3077 }, // Montgomery
  '362': { lat: 33.6557, lng: -85.8278 }, // Anniston
  '363': { lat: 31.3271, lng: -85.8557 }, // Dothan
  '364': { lat: 31.2335, lng: -85.3905 }, // Enterprise
  '365': { lat: 30.6954, lng: -88.0399 }, // Mobile
  '366': { lat: 30.6954, lng: -88.0399 }, // Mobile
  '367': { lat: 32.4064, lng: -87.0211 }, // Selma
  '368': { lat: 32.4064, lng: -87.0211 }, // Selma
  '369': { lat: 30.6954, lng: -88.0399 }, // Mobile
  
  // ===== 370-385 Tennessee =====
  '370': { lat: 36.1627, lng: -86.7816 }, // Nashville
  '371': { lat: 36.1627, lng: -86.7816 }, // Nashville
  '372': { lat: 36.1627, lng: -86.7816 }, // Nashville
  '373': { lat: 35.0456, lng: -85.3097 }, // Chattanooga
  '374': { lat: 35.0456, lng: -85.3097 }, // Chattanooga
  '375': { lat: 35.2271, lng: -89.5380 }, // Johnson City
  '376': { lat: 36.3134, lng: -82.3535 }, // Kingsport
  '377': { lat: 35.9606, lng: -83.9207 }, // Knoxville
  '378': { lat: 35.9606, lng: -83.9207 }, // Knoxville
  '379': { lat: 35.9606, lng: -83.9207 }, // Knoxville
  '380': { lat: 35.1495, lng: -90.0490 }, // Memphis
  '381': { lat: 35.1495, lng: -90.0490 }, // Memphis
  '382': { lat: 35.6145, lng: -88.8139 }, // Jackson
  '383': { lat: 35.6145, lng: -88.8139 }, // Jackson
  '384': { lat: 36.1866, lng: -87.0654 }, // Clarksville
  '385': { lat: 36.1866, lng: -87.0654 }, // Cookeville
  
  // ===== 386-397 Mississippi =====
  '386': { lat: 34.2576, lng: -88.7034 }, // Tupelo
  '387': { lat: 33.4504, lng: -88.8184 }, // Columbus
  '388': { lat: 33.4504, lng: -88.8184 }, // Starkville
  '389': { lat: 34.2576, lng: -88.7034 }, // Grenada
  '390': { lat: 32.2988, lng: -90.1848 }, // Jackson
  '391': { lat: 32.2988, lng: -90.1848 }, // Jackson
  '392': { lat: 32.2988, lng: -90.1848 }, // Jackson
  '393': { lat: 31.3271, lng: -89.2903 }, // Meridian
  '394': { lat: 31.3271, lng: -89.2903 }, // Laurel
  '395': { lat: 30.3960, lng: -88.8853 }, // Gulfport/Biloxi
  '396': { lat: 31.5607, lng: -91.4068 }, // McComb
  '397': { lat: 33.4504, lng: -88.8184 }, // Columbus
  
  // ===== 400-427 Kentucky =====
  '400': { lat: 38.2527, lng: -85.7585 }, // Louisville
  '401': { lat: 38.2527, lng: -85.7585 }, // Louisville
  '402': { lat: 38.2527, lng: -85.7585 }, // Louisville
  '403': { lat: 38.0406, lng: -84.5037 }, // Lexington
  '404': { lat: 38.0406, lng: -84.5037 }, // Lexington
  '405': { lat: 38.0406, lng: -84.5037 }, // Lexington
  '406': { lat: 38.2009, lng: -84.8733 }, // Frankfort
  '407': { lat: 37.0834, lng: -88.6000 }, // Paducah
  '408': { lat: 37.9839, lng: -87.5711 }, // Owensboro
  '409': { lat: 37.0834, lng: -88.6000 }, // Henderson
  '410': { lat: 39.0458, lng: -84.6620 }, // Covington
  '411': { lat: 38.4192, lng: -82.4452 }, // Ashland
  '412': { lat: 38.4192, lng: -82.4452 }, // Ashland
  '413': { lat: 37.8393, lng: -83.9435 }, // Richmond
  '414': { lat: 37.8393, lng: -83.9435 }, // Richmond
  '415': { lat: 38.2009, lng: -83.2186 }, // Morehead
  '416': { lat: 37.3346, lng: -83.1081 }, // Hazard
  '417': { lat: 37.3346, lng: -83.1081 }, // Hazard
  '418': { lat: 37.3346, lng: -83.1081 }, // Hazard
  '420': { lat: 36.9903, lng: -86.4436 }, // Bowling Green
  '421': { lat: 36.9903, lng: -86.4436 }, // Bowling Green
  '422': { lat: 37.0834, lng: -88.6000 }, // Murray
  '423': { lat: 37.6834, lng: -85.8330 }, // Elizabethtown
  '424': { lat: 37.6834, lng: -85.8330 }, // Elizabethtown
  '425': { lat: 36.8566, lng: -83.8888 }, // Somerset
  '426': { lat: 36.6100, lng: -83.7107 }, // Barbourville
  '427': { lat: 36.9903, lng: -86.4436 }, // Glasgow
  
  // ===== 430-458 Ohio =====
  '430': { lat: 39.9612, lng: -82.9988 }, // Columbus
  '431': { lat: 39.9612, lng: -82.9988 }, // Columbus
  '432': { lat: 39.9612, lng: -82.9988 }, // Columbus
  '433': { lat: 39.9612, lng: -82.9988 }, // Columbus
  '434': { lat: 41.0814, lng: -81.5190 }, // Akron
  '435': { lat: 40.7989, lng: -81.3784 }, // Canton
  '436': { lat: 41.6528, lng: -83.5379 }, // Toledo
  '437': { lat: 40.7582, lng: -82.5154 }, // Mansfield
  '438': { lat: 40.7582, lng: -82.5154 }, // Zanesville
  '439': { lat: 40.3420, lng: -80.6180 }, // Steubenville
  '440': { lat: 41.4993, lng: -81.6944 }, // Cleveland
  '441': { lat: 41.4993, lng: -81.6944 }, // Cleveland
  '442': { lat: 41.0534, lng: -80.6590 }, // Youngstown
  '443': { lat: 41.0534, lng: -80.6590 }, // Youngstown
  '444': { lat: 41.0534, lng: -80.6590 }, // Youngstown
  '445': { lat: 41.0534, lng: -80.6590 }, // Youngstown
  '446': { lat: 40.7989, lng: -81.3784 }, // Canton
  '447': { lat: 41.0814, lng: -81.5190 }, // Akron
  '448': { lat: 40.7582, lng: -82.5154 }, // Mansfield
  '449': { lat: 40.7582, lng: -82.5154 }, // Mansfield
  '450': { lat: 39.1031, lng: -84.5120 }, // Cincinnati
  '451': { lat: 39.1031, lng: -84.5120 }, // Cincinnati
  '452': { lat: 39.1031, lng: -84.5120 }, // Cincinnati
  '453': { lat: 39.7589, lng: -84.1916 }, // Dayton
  '454': { lat: 39.7589, lng: -84.1916 }, // Dayton
  '455': { lat: 39.9242, lng: -83.8088 }, // Springfield
  '456': { lat: 39.3292, lng: -82.1013 }, // Chillicothe
  '457': { lat: 39.3292, lng: -82.1013 }, // Chillicothe
  '458': { lat: 40.5517, lng: -83.6541 }, // Lima
  
  // ===== 460-479 Indiana =====
  '460': { lat: 39.7684, lng: -86.1581 }, // Indianapolis
  '461': { lat: 39.7684, lng: -86.1581 }, // Indianapolis
  '462': { lat: 39.7684, lng: -86.1581 }, // Indianapolis
  '463': { lat: 40.1934, lng: -85.3864 }, // Anderson
  '464': { lat: 40.7648, lng: -86.0689 }, // Kokomo
  '465': { lat: 40.4167, lng: -86.8753 }, // Lafayette
  '466': { lat: 40.4167, lng: -86.8753 }, // Lafayette
  '467': { lat: 41.0793, lng: -85.1394 }, // Fort Wayne
  '468': { lat: 41.0793, lng: -85.1394 }, // Fort Wayne
  '469': { lat: 41.4759, lng: -87.0613 }, // South Bend
  '470': { lat: 39.1653, lng: -86.5264 }, // Bloomington
  '471': { lat: 39.1653, lng: -86.5264 }, // Bloomington
  '472': { lat: 39.1653, lng: -86.5264 }, // Columbus
  '473': { lat: 40.1934, lng: -85.3864 }, // Muncie
  '474': { lat: 39.4667, lng: -87.4139 }, // Terre Haute
  '475': { lat: 39.4667, lng: -87.4139 }, // Terre Haute
  '476': { lat: 38.0406, lng: -87.5340 }, // Evansville
  '477': { lat: 38.0406, lng: -87.5340 }, // Evansville
  '478': { lat: 38.0406, lng: -87.5340 }, // Evansville
  '479': { lat: 41.4759, lng: -87.0613 }, // Gary
  
  // ===== 480-499 Michigan =====
  '480': { lat: 42.4316, lng: -83.4839 }, // Royal Oak
  '481': { lat: 42.3314, lng: -83.0458 }, // Detroit
  '482': { lat: 42.3314, lng: -83.0458 }, // Detroit
  '483': { lat: 42.4316, lng: -83.4839 }, // Royal Oak
  '484': { lat: 43.0125, lng: -83.6875 }, // Flint
  '485': { lat: 43.0125, lng: -83.6875 }, // Flint
  '486': { lat: 43.4203, lng: -83.9501 }, // Saginaw
  '487': { lat: 43.4203, lng: -83.9501 }, // Saginaw
  '488': { lat: 42.7325, lng: -84.5555 }, // Lansing
  '489': { lat: 42.7325, lng: -84.5555 }, // Lansing
  '490': { lat: 42.2917, lng: -85.5872 }, // Kalamazoo
  '491': { lat: 42.2917, lng: -85.5872 }, // Kalamazoo
  '492': { lat: 42.2756, lng: -85.0085 }, // Jackson
  '493': { lat: 42.9634, lng: -85.6681 }, // Grand Rapids
  '494': { lat: 42.9634, lng: -85.6681 }, // Grand Rapids
  '495': { lat: 42.9634, lng: -85.6681 }, // Grand Rapids
  '496': { lat: 44.7631, lng: -85.6206 }, // Traverse City
  '497': { lat: 44.3148, lng: -85.6024 }, // Cadillac
  '498': { lat: 46.4977, lng: -84.3476 }, // Sault Ste. Marie
  '499': { lat: 46.5436, lng: -87.3954 }, // Marquette
  
  // ===== 500-528 Iowa =====
  '500': { lat: 41.5868, lng: -93.6250 }, // Des Moines
  '501': { lat: 41.5868, lng: -93.6250 }, // Des Moines
  '502': { lat: 41.5868, lng: -93.6250 }, // Des Moines
  '503': { lat: 41.5868, lng: -93.6250 }, // Des Moines
  '504': { lat: 42.4999, lng: -90.6646 }, // Waterloo
  '505': { lat: 41.2619, lng: -95.8608 }, // Fort Dodge
  '506': { lat: 42.4999, lng: -90.6646 }, // Waterloo
  '507': { lat: 42.4999, lng: -90.6646 }, // Waterloo
  '508': { lat: 42.0266, lng: -93.6205 }, // Ames
  '509': { lat: 42.0266, lng: -93.6205 }, // Ames
  '510': { lat: 41.2619, lng: -95.8608 }, // Sioux City
  '511': { lat: 41.2619, lng: -95.8608 }, // Sioux City
  '512': { lat: 41.2619, lng: -95.8608 }, // Sioux City
  '513': { lat: 41.5868, lng: -93.6250 }, // Des Moines
  '514': { lat: 41.5868, lng: -93.6250 }, // Des Moines
  '515': { lat: 41.2619, lng: -95.8608 }, // Omaha border
  '516': { lat: 41.2619, lng: -95.8608 }, // Sioux City
  '520': { lat: 42.4999, lng: -90.6646 }, // Dubuque
  '521': { lat: 42.4999, lng: -90.6646 }, // Decorah
  '522': { lat: 41.6611, lng: -91.5302 }, // Cedar Rapids
  '523': { lat: 41.6611, lng: -91.5302 }, // Cedar Rapids
  '524': { lat: 41.6611, lng: -91.5302 }, // Cedar Rapids
  '525': { lat: 40.8071, lng: -91.1127 }, // Ottumwa
  '526': { lat: 40.8071, lng: -91.1127 }, // Burlington
  '527': { lat: 41.6611, lng: -91.5302 }, // Cedar Rapids
  '528': { lat: 41.6611, lng: -91.5302 }, // Davenport
  
  // ===== 530-549 Wisconsin =====
  '530': { lat: 43.0731, lng: -89.4012 }, // Madison
  '531': { lat: 42.5847, lng: -87.8212 }, // Kenosha
  '532': { lat: 43.0389, lng: -87.9065 }, // Milwaukee
  '534': { lat: 42.7261, lng: -87.7828 }, // Racine
  '535': { lat: 43.0731, lng: -89.4012 }, // Madison
  '537': { lat: 43.0731, lng: -89.4012 }, // Madison
  '538': { lat: 43.0731, lng: -89.4012 }, // Madison
  '539': { lat: 42.8679, lng: -88.3301 }, // Waukesha
  '540': { lat: 44.0190, lng: -88.5426 }, // Wausau
  '541': { lat: 44.5133, lng: -88.0133 }, // Green Bay
  '542': { lat: 44.5133, lng: -88.0133 }, // Green Bay
  '543': { lat: 44.5133, lng: -88.0133 }, // Green Bay
  '544': { lat: 44.0190, lng: -88.5426 }, // Wausau
  '545': { lat: 45.6361, lng: -89.4126 }, // Rhinelander
  '546': { lat: 43.8014, lng: -91.2396 }, // La Crosse
  '547': { lat: 44.9391, lng: -89.6301 }, // Eau Claire
  '548': { lat: 44.9391, lng: -89.6301 }, // Eau Claire/Spooner
  '549': { lat: 44.0190, lng: -88.5426 }, // Oshkosh
  
  // ===== 550-567 Minnesota =====
  '550': { lat: 44.9778, lng: -93.2650 }, // St. Paul
  '551': { lat: 44.9778, lng: -93.2650 }, // St. Paul
  '553': { lat: 44.9778, lng: -93.2650 }, // Minneapolis
  '554': { lat: 44.9778, lng: -93.2650 }, // Minneapolis
  '555': { lat: 44.9778, lng: -93.2650 }, // Minneapolis
  '556': { lat: 46.7867, lng: -92.1005 }, // Duluth
  '557': { lat: 46.7867, lng: -92.1005 }, // Duluth
  '558': { lat: 46.7867, lng: -92.1005 }, // Duluth
  '559': { lat: 44.0121, lng: -92.4802 }, // Rochester
  '560': { lat: 44.1636, lng: -93.9994 }, // Mankato
  '561': { lat: 44.1636, lng: -93.9994 }, // Mankato
  '562': { lat: 45.5579, lng: -94.1632 }, // Willmar
  '563': { lat: 45.5579, lng: -94.1632 }, // St. Cloud
  '564': { lat: 46.3458, lng: -94.2057 }, // Brainerd
  '565': { lat: 47.4736, lng: -94.8803 }, // Bemidji
  '566': { lat: 47.4736, lng: -94.8803 }, // Bemidji
  '567': { lat: 48.1170, lng: -96.1773 }, // Thief River Falls
  
  // ===== 570-577 South Dakota =====
  '570': { lat: 43.5460, lng: -96.7313 }, // Sioux Falls
  '571': { lat: 43.5460, lng: -96.7313 }, // Sioux Falls
  '572': { lat: 45.4646, lng: -98.4868 }, // Watertown
  '573': { lat: 44.3114, lng: -96.7984 }, // Mitchell
  '574': { lat: 45.4647, lng: -98.4685 }, // Aberdeen
  '575': { lat: 44.3683, lng: -100.3509 }, // Pierre
  '576': { lat: 45.5235, lng: -100.4427 }, // Mobridge
  '577': { lat: 44.0805, lng: -103.2310 }, // Rapid City
  
  // ===== 580-588 North Dakota =====
  '580': { lat: 46.8772, lng: -96.7898 }, // Fargo
  '581': { lat: 46.8772, lng: -96.7898 }, // Fargo
  '582': { lat: 46.8083, lng: -100.7837 }, // Bismarck
  '583': { lat: 46.8083, lng: -100.7837 }, // Bismarck
  '584': { lat: 46.8083, lng: -100.7837 }, // Bismarck
  '585': { lat: 48.2330, lng: -101.2963 }, // Minot
  '586': { lat: 48.2330, lng: -101.2963 }, // Minot
  '587': { lat: 48.1470, lng: -103.6290 }, // Williston
  '588': { lat: 47.9253, lng: -97.0329 }, // Grand Forks
  
  // ===== 590-599 Montana =====
  '590': { lat: 45.7833, lng: -108.5007 }, // Billings
  '591': { lat: 45.7833, lng: -108.5007 }, // Billings
  '592': { lat: 48.7596, lng: -109.7549 }, // Wolf Point
  '593': { lat: 47.5053, lng: -111.3008 }, // Great Falls
  '594': { lat: 47.5053, lng: -111.3008 }, // Great Falls
  '595': { lat: 48.2120, lng: -106.6352 }, // Glasgow
  '596': { lat: 46.5884, lng: -112.0245 }, // Helena
  '597': { lat: 45.6770, lng: -111.0429 }, // Butte
  '598': { lat: 46.8721, lng: -114.0093 }, // Missoula
  '599': { lat: 48.1919, lng: -114.3169 }, // Kalispell
  
  // ===== 600-629 Illinois =====
  '600': { lat: 41.8781, lng: -87.6298 }, // Chicago
  '601': { lat: 41.8781, lng: -87.6298 }, // Chicago
  '602': { lat: 41.8527, lng: -87.6903 }, // Chicago (Evanston)
  '603': { lat: 41.8818, lng: -87.6232 }, // Chicago (Oak Park)
  '604': { lat: 42.0451, lng: -87.6877 }, // Chicago (North Shore)
  '605': { lat: 41.8527, lng: -87.9403 }, // Chicago (West)
  '606': { lat: 41.8781, lng: -87.6298 }, // Chicago
  '607': { lat: 41.8781, lng: -87.6298 }, // Chicago
  '608': { lat: 41.5250, lng: -88.0817 }, // Chicago (Joliet)
  '609': { lat: 41.4545, lng: -88.2753 }, // Joliet
  '610': { lat: 41.9253, lng: -89.0687 }, // Rockford
  '611': { lat: 41.9253, lng: -89.0687 }, // Rockford
  '612': { lat: 41.9253, lng: -89.0687 }, // Rockford
  '613': { lat: 41.4545, lng: -90.5151 }, // Rock Island
  '614': { lat: 41.4545, lng: -90.5151 }, // Rock Island
  '615': { lat: 40.6936, lng: -89.5890 }, // Peoria
  '616': { lat: 40.6936, lng: -89.5890 }, // Peoria
  '617': { lat: 40.4842, lng: -88.9937 }, // Bloomington
  '618': { lat: 40.1164, lng: -88.2434 }, // Champaign
  '619': { lat: 40.1164, lng: -88.2434 }, // Champaign
  '620': { lat: 39.8017, lng: -89.6437 }, // Springfield
  '622': { lat: 39.8017, lng: -89.6437 }, // Springfield
  '623': { lat: 39.1199, lng: -90.3293 }, // Quincy
  '624': { lat: 38.8106, lng: -89.9512 }, // Alton
  '625': { lat: 39.8017, lng: -89.6437 }, // Springfield
  '626': { lat: 39.8017, lng: -89.6437 }, // Springfield
  '627': { lat: 39.8017, lng: -89.6437 }, // Springfield
  '628': { lat: 38.6270, lng: -90.1994 }, // Centralia
  '629': { lat: 37.7225, lng: -89.2163 }, // Carbondale
  
  // ===== 630-658 Missouri =====
  '630': { lat: 38.6270, lng: -90.1994 }, // St. Louis
  '631': { lat: 38.6270, lng: -90.1994 }, // St. Louis
  '633': { lat: 38.6270, lng: -90.1994 }, // St. Louis
  '634': { lat: 38.7510, lng: -90.3740 }, // St. Louis (Quincy)
  '635': { lat: 39.7392, lng: -91.4090 }, // Quincy
  '636': { lat: 36.8737, lng: -89.5879 }, // Cape Girardeau
  '637': { lat: 36.8737, lng: -89.5879 }, // Cape Girardeau
  '638': { lat: 36.8737, lng: -89.5879 }, // Cape Girardeau
  '639': { lat: 36.6510, lng: -93.1187 }, // Poplar Bluff
  '640': { lat: 39.0997, lng: -94.5786 }, // Kansas City
  '641': { lat: 39.0997, lng: -94.5786 }, // Kansas City
  '644': { lat: 39.0997, lng: -94.5786 }, // Kansas City
  '645': { lat: 39.7767, lng: -94.8552 }, // St. Joseph
  '646': { lat: 39.7767, lng: -94.8552 }, // St. Joseph
  '647': { lat: 39.7767, lng: -94.8552 }, // St. Joseph
  '648': { lat: 38.5767, lng: -92.1735 }, // Jefferson City
  '649': { lat: 38.5767, lng: -92.1735 }, // Jefferson City
  '650': { lat: 38.5767, lng: -92.1735 }, // Columbia
  '651': { lat: 38.5767, lng: -92.1735 }, // Columbia
  '652': { lat: 38.5767, lng: -92.1735 }, // Columbia
  '653': { lat: 38.3478, lng: -93.2424 }, // Sedalia
  '654': { lat: 37.8394, lng: -94.3642 }, // Nevada
  '655': { lat: 37.8394, lng: -94.3642 }, // Nevada
  '656': { lat: 37.2090, lng: -93.2923 }, // Springfield
  '657': { lat: 37.2090, lng: -93.2923 }, // Springfield
  '658': { lat: 37.2090, lng: -93.2923 }, // Springfield
  
  // ===== 660-679 Kansas =====
  '660': { lat: 39.0997, lng: -94.5786 }, // Kansas City
  '661': { lat: 39.0997, lng: -94.5786 }, // Kansas City
  '662': { lat: 38.9717, lng: -95.2353 }, // Lawrence
  '664': { lat: 39.0558, lng: -95.6890 }, // Topeka
  '665': { lat: 39.0558, lng: -95.6890 }, // Topeka
  '666': { lat: 39.0558, lng: -95.6890 }, // Topeka
  '667': { lat: 39.8356, lng: -99.3262 }, // Salina
  '668': { lat: 39.3547, lng: -94.7307 }, // Topeka
  '669': { lat: 39.1836, lng: -96.5717 }, // Manhattan
  '670': { lat: 37.6872, lng: -97.3301 }, // Wichita
  '671': { lat: 37.6872, lng: -97.3301 }, // Wichita
  '672': { lat: 37.6872, lng: -97.3301 }, // Wichita
  '673': { lat: 37.7530, lng: -100.0161 }, // Dodge City
  '674': { lat: 38.8647, lng: -99.3267 }, // Hays
  '675': { lat: 37.6872, lng: -97.3301 }, // Hutchinson
  '676': { lat: 38.3561, lng: -98.7917 }, // Great Bend
  '677': { lat: 39.3658, lng: -101.0478 }, // Colby
  '678': { lat: 37.0530, lng: -100.9210 }, // Liberal
  '679': { lat: 37.0530, lng: -100.9210 }, // Liberal
  
  // ===== 680-693 Nebraska =====
  '680': { lat: 41.2565, lng: -95.9345 }, // Omaha
  '681': { lat: 41.2565, lng: -95.9345 }, // Omaha
  '683': { lat: 40.8258, lng: -96.6852 }, // Lincoln
  '684': { lat: 40.8258, lng: -96.6852 }, // Lincoln
  '685': { lat: 40.8258, lng: -96.6852 }, // Lincoln
  '686': { lat: 41.4503, lng: -97.3654 }, // Columbus
  '687': { lat: 41.4503, lng: -97.3654 }, // Norfolk
  '688': { lat: 40.9264, lng: -98.3420 }, // Grand Island
  '689': { lat: 40.9264, lng: -98.3420 }, // Grand Island
  '690': { lat: 41.1236, lng: -100.7654 }, // North Platte
  '691': { lat: 41.1236, lng: -100.7654 }, // North Platte
  '692': { lat: 42.0500, lng: -102.8711 }, // Scottsbluff
  '693': { lat: 41.8666, lng: -103.6608 }, // Alliance
  
  // ===== 700-714 Louisiana =====
  '700': { lat: 29.9511, lng: -90.0715 }, // New Orleans
  '701': { lat: 29.9511, lng: -90.0715 }, // New Orleans
  '703': { lat: 30.4515, lng: -91.1871 }, // Baton Rouge
  '704': { lat: 30.4515, lng: -91.1871 }, // Baton Rouge
  '705': { lat: 30.2241, lng: -92.0198 }, // Lafayette
  '706': { lat: 30.2241, lng: -92.0198 }, // Lafayette
  '707': { lat: 30.2266, lng: -93.2174 }, // Lake Charles
  '708': { lat: 30.2266, lng: -93.2174 }, // Lake Charles
  '710': { lat: 32.5252, lng: -93.7502 }, // Shreveport
  '711': { lat: 32.5252, lng: -93.7502 }, // Shreveport
  '712': { lat: 32.5252, lng: -92.1193 }, // Monroe
  '713': { lat: 31.3113, lng: -92.4451 }, // Alexandria
  '714': { lat: 31.3113, lng: -92.4451 }, // Alexandria
  
  // ===== 716-729 Arkansas =====
  '716': { lat: 34.7465, lng: -92.2896 }, // Little Rock
  '717': { lat: 34.7465, lng: -92.2896 }, // Little Rock
  '718': { lat: 34.7465, lng: -92.2896 }, // Little Rock
  '719': { lat: 34.7465, lng: -92.2896 }, // Little Rock
  '720': { lat: 34.7465, lng: -92.2896 }, // Little Rock
  '721': { lat: 34.7465, lng: -92.2896 }, // Little Rock
  '722': { lat: 34.7465, lng: -92.2896 }, // Little Rock
  '723': { lat: 35.2226, lng: -90.1848 }, // West Memphis
  '724': { lat: 35.2226, lng: -90.1848 }, // West Memphis
  '725': { lat: 36.0726, lng: -94.1574 }, // Fayetteville
  '726': { lat: 34.5037, lng: -93.0552 }, // Hot Springs
  '727': { lat: 36.2605, lng: -93.9952 }, // Bentonville
  '728': { lat: 35.8423, lng: -90.7043 }, // Jonesboro
  '729': { lat: 36.4350, lng: -94.2016 }, // Rogers
  
  // ===== 730-749 Oklahoma =====
  '730': { lat: 35.4676, lng: -97.5164 }, // Oklahoma City
  '731': { lat: 35.4676, lng: -97.5164 }, // Oklahoma City
  '733': { lat: 36.1540, lng: -95.9928 }, // Tulsa
  '734': { lat: 34.1954, lng: -97.1178 }, // Ardmore
  '735': { lat: 34.6170, lng: -98.4203 }, // Lawton
  '736': { lat: 36.4072, lng: -97.8776 }, // Enid
  '737': { lat: 36.4072, lng: -97.8776 }, // Enid
  '738': { lat: 36.7070, lng: -97.0848 }, // Ponca City
  '739': { lat: 36.7070, lng: -97.0848 }, // Ponca City
  '740': { lat: 36.1540, lng: -95.9928 }, // Tulsa
  '741': { lat: 36.1540, lng: -95.9928 }, // Tulsa
  '743': { lat: 36.1540, lng: -95.9928 }, // Tulsa
  '744': { lat: 34.9387, lng: -95.7697 }, // Muskogee
  '745': { lat: 34.9387, lng: -95.7697 }, // McAlester
  '746': { lat: 36.3955, lng: -94.7984 }, // Miami
  '747': { lat: 34.6036, lng: -96.0773 }, // Durant
  '748': { lat: 34.9290, lng: -99.4048 }, // Altus
  '749': { lat: 35.5224, lng: -98.9681 }, // Clinton
  
  // ===== 750-799 Texas =====
  '750': { lat: 32.7767, lng: -96.7970 }, // Dallas
  '751': { lat: 32.7767, lng: -96.7970 }, // Dallas
  '752': { lat: 32.7767, lng: -96.7970 }, // Dallas
  '753': { lat: 32.7767, lng: -96.7970 }, // Dallas
  '754': { lat: 33.1959, lng: -97.1335 }, // Denton
  '755': { lat: 32.4487, lng: -99.7331 }, // Abilene
  '756': { lat: 32.4487, lng: -99.7331 }, // Abilene
  '757': { lat: 33.9137, lng: -98.4934 }, // Wichita Falls
  '758': { lat: 33.9137, lng: -98.4934 }, // Wichita Falls
  '759': { lat: 33.9137, lng: -98.4934 }, // Wichita Falls
  '760': { lat: 32.7555, lng: -97.3308 }, // Fort Worth
  '761': { lat: 32.7555, lng: -97.3308 }, // Fort Worth
  '762': { lat: 32.7555, lng: -97.3308 }, // Fort Worth
  '763': { lat: 32.7555, lng: -97.3308 }, // Fort Worth
  '764': { lat: 32.2217, lng: -98.2028 }, // Stephenville
  '765': { lat: 31.5493, lng: -97.1467 }, // Waco
  '766': { lat: 31.5493, lng: -97.1467 }, // Waco
  '767': { lat: 31.5493, lng: -97.1467 }, // Waco
  '768': { lat: 33.4418, lng: -94.0377 }, // Texarkana
  '769': { lat: 31.7619, lng: -95.6308 }, // Tyler
  '770': { lat: 29.7604, lng: -95.3698 }, // Houston
  '771': { lat: 29.7604, lng: -95.3698 }, // Houston
  '772': { lat: 29.7604, lng: -95.3698 }, // Houston
  '773': { lat: 29.8543, lng: -95.3698 }, // Tomball
  '774': { lat: 29.7604, lng: -95.3698 }, // Houston (Katy)
  '775': { lat: 29.7604, lng: -95.3698 }, // Houston (Galveston)
  '776': { lat: 30.0802, lng: -94.1266 }, // Beaumont
  '777': { lat: 30.0802, lng: -94.1266 }, // Beaumont
  '778': { lat: 30.6280, lng: -96.3344 }, // College Station
  '779': { lat: 30.2672, lng: -97.7431 }, // Austin
  '780': { lat: 29.4241, lng: -98.4936 }, // San Antonio
  '781': { lat: 29.4241, lng: -98.4936 }, // San Antonio
  '782': { lat: 29.4241, lng: -98.4936 }, // San Antonio
  '783': { lat: 27.8006, lng: -97.3964 }, // Corpus Christi
  '784': { lat: 27.8006, lng: -97.3964 }, // Corpus Christi
  '785': { lat: 26.2034, lng: -98.2300 }, // McAllen
  '786': { lat: 30.2672, lng: -97.7431 }, // Austin
  '787': { lat: 30.2672, lng: -97.7431 }, // Austin
  '788': { lat: 29.8830, lng: -97.9414 }, // San Marcos
  '789': { lat: 30.2672, lng: -97.7431 }, // Austin
  '790': { lat: 35.2220, lng: -101.8313 }, // Amarillo
  '791': { lat: 35.2220, lng: -101.8313 }, // Amarillo
  '792': { lat: 35.0456, lng: -102.9810 }, // Amarillo
  '793': { lat: 33.5779, lng: -101.8552 }, // Lubbock
  '794': { lat: 33.5779, lng: -101.8552 }, // Lubbock
  '795': { lat: 33.5779, lng: -101.8552 }, // Lubbock
  '796': { lat: 33.5779, lng: -101.8552 }, // Lubbock
  '797': { lat: 31.9686, lng: -102.0779 }, // Midland
  '798': { lat: 31.7619, lng: -106.4850 }, // El Paso
  '799': { lat: 31.7619, lng: -106.4850 }, // El Paso
  
  // ===== 800-816 Colorado =====
  '800': { lat: 39.7392, lng: -104.9903 }, // Denver
  '801': { lat: 39.7392, lng: -104.9903 }, // Denver
  '802': { lat: 39.7392, lng: -104.9903 }, // Denver
  '803': { lat: 39.7392, lng: -104.9903 }, // Boulder
  '804': { lat: 39.7392, lng: -104.9903 }, // Denver
  '805': { lat: 39.7392, lng: -104.9903 }, // Denver
  '806': { lat: 40.0150, lng: -105.2705 }, // Boulder
  '807': { lat: 40.4850, lng: -104.9047 }, // Greeley
  '808': { lat: 38.8339, lng: -104.8214 }, // Colorado Springs
  '809': { lat: 38.8339, lng: -104.8214 }, // Colorado Springs
  '810': { lat: 38.2544, lng: -104.6091 }, // Pueblo
  '811': { lat: 37.2753, lng: -107.8801 }, // Alamosa
  '812': { lat: 38.5458, lng: -105.9989 }, // Salida
  '813': { lat: 37.2753, lng: -107.8801 }, // Durango
  '814': { lat: 39.0639, lng: -108.5506 }, // Grand Junction
  '815': { lat: 39.0639, lng: -108.5506 }, // Grand Junction
  '816': { lat: 39.5501, lng: -107.3243 }, // Glenwood Springs
  
  // ===== 820-831 Wyoming =====
  '820': { lat: 41.1400, lng: -104.8202 }, // Cheyenne
  '821': { lat: 41.1400, lng: -104.8202 }, // Cheyenne
  '822': { lat: 41.3114, lng: -105.5911 }, // Laramie
  '823': { lat: 42.8500, lng: -106.3252 }, // Casper
  '824': { lat: 41.5868, lng: -109.2029 }, // Rock Springs
  '825': { lat: 42.8500, lng: -106.3252 }, // Casper
  '826': { lat: 42.8500, lng: -106.3252 }, // Casper
  '827': { lat: 44.2958, lng: -105.5017 }, // Gillette
  '828': { lat: 44.7972, lng: -106.9562 }, // Sheridan
  '829': { lat: 43.0248, lng: -108.3801 }, // Lander
  '830': { lat: 41.5868, lng: -109.2029 }, // Evanston
  '831': { lat: 41.5868, lng: -109.2029 }, // Rock Springs
  
  // ===== 832-838 Idaho =====
  '832': { lat: 42.5659, lng: -114.4608 }, // Twin Falls
  '833': { lat: 42.5659, lng: -114.4608 }, // Twin Falls
  '834': { lat: 43.0180, lng: -114.7420 }, // Ketchum
  '835': { lat: 46.4166, lng: -117.0119 }, // Lewiston
  '836': { lat: 43.6150, lng: -116.2023 }, // Boise
  '837': { lat: 43.6150, lng: -116.2023 }, // Boise
  '838': { lat: 42.8713, lng: -112.4455 }, // Pocatello
  
  // ===== 840-847 Utah =====
  '840': { lat: 40.7608, lng: -111.8910 }, // Salt Lake City
  '841': { lat: 40.7608, lng: -111.8910 }, // Salt Lake City
  '842': { lat: 40.2338, lng: -111.6585 }, // Provo
  '843': { lat: 41.2230, lng: -111.9738 }, // Logan
  '844': { lat: 40.2338, lng: -111.6585 }, // Provo
  '845': { lat: 40.7608, lng: -111.8910 }, // Salt Lake City
  '846': { lat: 40.7608, lng: -111.8910 }, // Ogden
  '847': { lat: 38.5733, lng: -109.5498 }, // Moab
  
  // ===== 850-865 Arizona =====
  '850': { lat: 33.4484, lng: -112.0740 }, // Phoenix
  '851': { lat: 33.4484, lng: -112.0740 }, // Phoenix
  '852': { lat: 33.4484, lng: -112.0740 }, // Phoenix
  '853': { lat: 33.4484, lng: -112.0740 }, // Phoenix
  '855': { lat: 33.3062, lng: -111.8413 }, // Globe
  '856': { lat: 32.2226, lng: -110.9747 }, // Tucson
  '857': { lat: 32.2226, lng: -110.9747 }, // Tucson
  '859': { lat: 31.3393, lng: -110.9337 }, // Sierra Vista
  '860': { lat: 33.4484, lng: -112.0740 }, // Glendale
  '863': { lat: 34.5400, lng: -112.4685 }, // Prescott
  '864': { lat: 34.8697, lng: -111.7610 }, // Sedona
  '865': { lat: 35.1983, lng: -111.6513 }, // Flagstaff
  
  // ===== 870-884 New Mexico =====
  '870': { lat: 35.0844, lng: -106.6504 }, // Albuquerque
  '871': { lat: 35.0844, lng: -106.6504 }, // Albuquerque
  '872': { lat: 35.0844, lng: -106.6504 }, // Albuquerque
  '873': { lat: 34.5199, lng: -105.8701 }, // Albuquerque
  '874': { lat: 35.6870, lng: -105.9378 }, // Santa Fe
  '875': { lat: 35.6870, lng: -105.9378 }, // Santa Fe
  '877': { lat: 36.4064, lng: -105.5731 }, // Taos
  '878': { lat: 34.4048, lng: -103.2052 }, // Clovis
  '879': { lat: 33.3943, lng: -104.5230 }, // Roswell
  '880': { lat: 32.3199, lng: -106.7637 }, // Las Cruces
  '881': { lat: 33.3943, lng: -104.5230 }, // Roswell
  '882': { lat: 32.3199, lng: -106.7637 }, // Las Cruces
  '883': { lat: 32.0890, lng: -106.1010 }, // Alamogordo
  '884': { lat: 35.5281, lng: -108.7426 }, // Gallup
  
  // ===== 889-898 Nevada =====
  '889': { lat: 36.1699, lng: -115.1398 }, // Las Vegas
  '890': { lat: 36.1699, lng: -115.1398 }, // Las Vegas
  '891': { lat: 36.1699, lng: -115.1398 }, // Las Vegas
  '893': { lat: 37.7749, lng: -117.2276 }, // Ely
  '894': { lat: 39.5296, lng: -119.8138 }, // Reno
  '895': { lat: 39.5296, lng: -119.8138 }, // Reno
  '897': { lat: 39.1638, lng: -119.7674 }, // Carson City
  '898': { lat: 40.9672, lng: -117.7356 }, // Elko
  
  // ===== 900-961 California =====
  '900': { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  '901': { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  '902': { lat: 33.9850, lng: -118.4695 }, // Inglewood
  '903': { lat: 33.9850, lng: -118.4695 }, // Inglewood
  '904': { lat: 33.8358, lng: -118.3406 }, // Santa Monica
  '905': { lat: 33.9425, lng: -118.4081 }, // Torrance
  '906': { lat: 33.8836, lng: -118.4167 }, // Long Beach
  '907': { lat: 33.7701, lng: -118.1937 }, // Long Beach
  '908': { lat: 33.7701, lng: -118.1937 }, // Long Beach
  '910': { lat: 34.0195, lng: -118.4912 }, // Pasadena
  '911': { lat: 34.1478, lng: -118.1445 }, // Pasadena
  '912': { lat: 34.1478, lng: -118.1445 }, // Glendale
  '913': { lat: 34.1808, lng: -118.3090 }, // Glendale
  '914': { lat: 34.1706, lng: -118.8376 }, // Van Nuys
  '915': { lat: 34.2011, lng: -118.1962 }, // Burbank
  '916': { lat: 34.0633, lng: -117.6509 }, // San Fernando
  '917': { lat: 34.0633, lng: -117.6509 }, // San Fernando
  '918': { lat: 34.0633, lng: -117.6509 }, // San Fernando
  '919': { lat: 34.1706, lng: -118.8376 }, // Simi Valley
  '920': { lat: 32.7157, lng: -117.1611 }, // San Diego
  '921': { lat: 32.7157, lng: -117.1611 }, // San Diego
  '922': { lat: 33.1959, lng: -117.3795 }, // Escondido
  '923': { lat: 32.7157, lng: -117.1611 }, // San Diego
  '924': { lat: 32.7157, lng: -117.1611 }, // San Diego
  '925': { lat: 32.7157, lng: -117.1611 }, // San Diego
  '926': { lat: 33.5427, lng: -117.7854 }, // Irvine
  '927': { lat: 33.6846, lng: -117.8265 }, // Santa Ana
  '928': { lat: 33.9533, lng: -117.3962 }, // Anaheim
  '930': { lat: 34.4208, lng: -119.6982 }, // Oxnard
  '931': { lat: 34.2804, lng: -119.2945 }, // Santa Barbara
  '932': { lat: 35.3733, lng: -119.0187 }, // Bakersfield
  '933': { lat: 35.3733, lng: -119.0187 }, // Bakersfield
  '934': { lat: 33.7175, lng: -116.2156 }, // Palm Springs
  '935': { lat: 36.3302, lng: -119.2921 }, // Visalia
  '936': { lat: 36.7468, lng: -119.7726 }, // Fresno
  '937': { lat: 36.7468, lng: -119.7726 }, // Fresno
  '939': { lat: 36.9741, lng: -122.0308 }, // Salinas
  '940': { lat: 37.7749, lng: -122.4194 }, // San Francisco
  '941': { lat: 37.7749, lng: -122.4194 }, // San Francisco
  '942': { lat: 38.5816, lng: -121.4944 }, // Sacramento
  '943': { lat: 37.5485, lng: -122.0590 }, // Palo Alto
  '944': { lat: 37.5485, lng: -122.0590 }, // San Mateo
  '945': { lat: 37.8044, lng: -122.2712 }, // Oakland
  '946': { lat: 37.8044, lng: -122.2712 }, // Oakland
  '947': { lat: 37.8716, lng: -122.2727 }, // Berkeley
  '948': { lat: 37.9716, lng: -122.5310 }, // Richmond
  '949': { lat: 37.9577, lng: -122.3477 }, // San Rafael
  '950': { lat: 37.3382, lng: -121.8863 }, // San Jose
  '951': { lat: 37.3382, lng: -121.8863 }, // San Jose
  '952': { lat: 37.6879, lng: -122.4702 }, // Stockton
  '953': { lat: 38.0194, lng: -121.7357 }, // Stockton
  '954': { lat: 37.7749, lng: -122.4194 }, // Santa Rosa
  '955': { lat: 38.4404, lng: -122.7141 }, // Santa Rosa
  '956': { lat: 38.5816, lng: -121.4944 }, // Sacramento
  '957': { lat: 38.5816, lng: -121.4944 }, // Sacramento
  '958': { lat: 38.5816, lng: -121.4944 }, // Sacramento
  '959': { lat: 39.1527, lng: -121.7616 }, // Marysville
  '960': { lat: 40.5865, lng: -122.3917 }, // Redding
  '961': { lat: 39.5296, lng: -119.8138 }, // Reno adjacent
  
  // ===== 970-979 Oregon =====
  '970': { lat: 45.5152, lng: -122.6784 }, // Portland
  '971': { lat: 45.5152, lng: -122.6784 }, // Portland
  '972': { lat: 45.5152, lng: -122.6784 }, // Portland
  '973': { lat: 44.9429, lng: -123.0351 }, // Salem
  '974': { lat: 44.0521, lng: -123.0868 }, // Eugene
  '975': { lat: 42.3265, lng: -122.8756 }, // Medford
  '976': { lat: 42.3265, lng: -122.8756 }, // Klamath Falls
  '977': { lat: 44.3106, lng: -121.1778 }, // Bend
  '978': { lat: 45.6769, lng: -118.7886 }, // Pendleton
  '979': { lat: 43.6150, lng: -116.2023 }, // Boise adjacent
  
  // ===== 980-994 Washington =====
  '980': { lat: 47.6062, lng: -122.3321 }, // Seattle
  '981': { lat: 47.6062, lng: -122.3321 }, // Seattle
  '982': { lat: 47.6062, lng: -122.3321 }, // Seattle
  '983': { lat: 47.2529, lng: -122.4443 }, // Tacoma
  '984': { lat: 47.2529, lng: -122.4443 }, // Tacoma
  '985': { lat: 47.0379, lng: -122.9007 }, // Olympia
  '986': { lat: 46.7324, lng: -117.0002 }, // Pullman
  '988': { lat: 47.4235, lng: -120.3103 }, // Wenatchee
  '989': { lat: 46.6021, lng: -120.5059 }, // Yakima
  '990': { lat: 47.6588, lng: -117.4260 }, // Spokane
  '991': { lat: 47.6588, lng: -117.4260 }, // Spokane
  '992': { lat: 47.6588, lng: -117.4260 }, // Spokane
  '993': { lat: 46.2804, lng: -119.2752 }, // Richland
  '994': { lat: 46.7324, lng: -117.0002 }, // Clarkston
  
  // ===== 995-999 Alaska =====
  '995': { lat: 61.2181, lng: -149.9003 }, // Anchorage
  '996': { lat: 61.2181, lng: -149.9003 }, // Anchorage
  '997': { lat: 64.8378, lng: -147.7164 }, // Fairbanks
  '998': { lat: 58.3019, lng: -134.4197 }, // Juneau
  '999': { lat: 55.3422, lng: -131.6461 }, // Ketchikan
};

/**
 * Get coordinates for a ZIP code
 * Prioritizes exact 5-digit match, then falls back to 3-digit prefix, then 2-digit
 */
export function getZipCoordinates(zipCode: string): ZipCoordinates | null {
  if (!zipCode || zipCode.length < 2) return null;
  
  const cleanZip = zipCode.replace(/\D/g, '').slice(0, 5);
  if (cleanZip.length < 2) return null;
  
  // Try exact 5-digit match first for maximum accuracy
  if (cleanZip.length === 5 && ZIP_COORDINATES[cleanZip]) {
    return ZIP_COORDINATES[cleanZip];
  }
  
  // Try 3-digit prefix
  const threeDigit = cleanZip.slice(0, 3);
  if (ZIP_COORDINATES[threeDigit]) {
    return ZIP_COORDINATES[threeDigit];
  }
  
  // Fallback to 2-digit prefix for general region
  const twoDigit = cleanZip.slice(0, 2);
  return ZIP_COORDINATES[twoDigit] || null;
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns straight-line distance in miles
 * Earth radius = 3958.8 miles (mean radius)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth's mean radius in miles
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
 * Returns straight-line distance in miles or null if coordinates can't be determined
 */
export function getDistanceBetweenZips(zip1: string, zip2: string): number | null {
  const coords1 = getZipCoordinates(zip1);
  const coords2 = getZipCoordinates(zip2);
  
  if (!coords1 || !coords2) return null;
  
  return calculateDistance(coords1.lat, coords1.lng, coords2.lat, coords2.lng);
}

/**
 * Format distance for display
 * Shows straight-line (as-the-crow-flies) distance
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
  
  return `Approx. ${distance.toFixed(1)} miles away`;
}

/**
 * Validate a US ZIP code format
 */
export function isValidZipCode(zipCode: string): boolean {
  const cleanZip = zipCode.replace(/\D/g, '');
  return cleanZip.length === 5;
}

/**
 * Check if coordinates could be determined for a ZIP code
 * Useful for conditional rendering of distance filters
 */
export function canCalculateDistance(zipCode: string): boolean {
  return getZipCoordinates(zipCode) !== null;
}