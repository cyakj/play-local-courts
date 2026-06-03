// TenisX Semantic Theme Tokens
// Brand colors (cyan, blue, volt, positive, negative) live in design.ts and
// never change between modes. These tokens cover surfaces, text, and structural UI.

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface ThemeTokens {
  // ── Canvas / Surfaces ──
  pageBg: string;
  cardBg: string;
  bgElevated: string;
  surface2: string;

  // ── Borders ──
  border: string;
  borderStrong: string;

  // ── Header — stays dark navy in both modes (brand identity) ──
  headerBg: string;
  headerBorder: string;

  // ── Text ──
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;

  // ── Bottom Nav ──
  navBg: string;
  navBorder: string;

  // ── Sheets / Modals ──
  sheetBg: string;
  backdrop: string;

  // ── Inputs / nested surfaces ──
  inputBg: string;

  // ── Hero section (below sticky header) ──
  heroBg: string;

  // ── Shadow system — navy-tinted, mode-calibrated ──
  shadowCard: ShadowStyle;      // standard content cards
  shadowElevated: ShadowStyle;  // floating/weather/calendar cards
  shadowSheet: ShadowStyle;     // bottom sheets (upward shadow)
  shadowNav: ShadowStyle;       // bottom navigation bar

  // ── Semantic light-context colors ──
  cyanOnLight: string;     // cyan substitute for live/status on light bg (#1A7FBF, 4.6:1)
  selectedBg: string;      // selected slot/row/chip background
  selectedBorder: string;  // selected state border color
  chipActiveBg: string;    // active filter chip background (header navy echo)

  // ── Schedule grid slot backgrounds ──
  schedAvailBg: string;   // available slot — green tint
  schedMineBg: string;    // my booking slot — volt tint
  schedMaintBg: string;   // maintenance slot — red tint
}

export type ThemeMode = 'light' | 'dark';

// Light mode: premium athletic — Apple Fitness / Whoop quality
// Rule: #2DE0FF (electric cyan) never touches white or #F0F4FA — use cyanOnLight instead
export const lightTheme: ThemeTokens = {
  pageBg:      '#F0F4FA',   // blue-cool tint — sports-tech, not generic SaaS
  cardBg:      '#FFFFFF',   // white cards pop against tinted bg
  bgElevated:  '#FFFFFF',   // elevation from shadows, not bg color (light mode pattern)
  surface2:    '#E8EDF5',   // chips, slot rows, nested surfaces — material presence

  border:       'rgba(15,31,61,0.14)',   // ~#DCDFE8 — visible cool-navy card edges
  borderStrong: 'rgba(15,31,61,0.28)',   // ~#BAC0CE — clear structural hierarchy step

  headerBg:     '#0F2A57',              // dark navy — NEVER CHANGE, brand identity
  headerBorder: 'rgba(45,224,255,0.18)', // cyan glow — lives in dark context, correct

  textPrimary:   '#0C0F18',  // midnight navy — max contrast, brand character
  textSecondary: '#3D4A5C',  // navy-slate — premium secondary
  textMuted:     '#556070',  // cool-navy-shifted — purges Tailwind gray-500 genericness
  textDisabled:  '#A8B2C0',  // cool-shifted disabled — brand temperature consistent

  navBg:     'rgba(255,255,255,0.94)',   // frosted-material feel
  navBorder: 'rgba(15,31,61,0.12)',      // visible top edge for nav layer

  sheetBg:  '#FFFFFF',                   // white sheet on navy backdrop
  backdrop: 'rgba(15,31,61,0.45)',       // navy-tinted dim — brand temperature

  inputBg: '#ECF0F7',   // "well" pattern — recessed inputs inside cards

  heroBg: '#E6ECF5',   // atmospheric hero zone — scroll depth vs card layer

  // Shadows: navy-tinted, calibrated for white surfaces
  shadowCard: {
    shadowColor: '#0C1A3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  shadowElevated: {
    shadowColor: '#0C1A3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },
  shadowSheet: {
    shadowColor: '#0C1A3A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
  shadowNav: {
    shadowColor: '#0C1A3A',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },

  cyanOnLight:    '#1A7FBF',              // live/status — calibrated for white bg
  selectedBg:     'rgba(45,107,255,0.10)', // selected state tint
  selectedBorder: '#2D6BFF',              // selected border = primary blue
  chipActiveBg:   '#0F2A57',              // active chip = header navy echo

  schedAvailBg:  'rgba(47,217,139,0.09)',  // available = green tint
  schedMineBg:   'rgba(214,255,61,0.14)',  // mine = volt tint
  schedMaintBg:  'rgba(255,92,107,0.09)',  // maintenance = red tint
};

// Dark mode: current TenisX design — mirrors design.ts Colors exactly
export const darkTheme: ThemeTokens = {
  pageBg:     '#0C0F18',
  cardBg:     '#161A26',
  bgElevated: '#11141F',
  surface2:   '#1B2030',

  border:       '#232838',
  borderStrong: '#333A4D',

  headerBg:     '#0F2A57',
  headerBorder: 'rgba(45,224,255,0.18)',

  textPrimary:   '#F5F8FF',
  textSecondary: '#9AA3B8',
  textMuted:     '#7A839A',
  textDisabled:  '#5A6379',

  navBg:     'rgba(12,15,24,0.92)',
  navBorder: '#232838',

  sheetBg:  '#161A26',
  backdrop: 'rgba(0,0,0,0.70)',

  inputBg: '#11141F',

  heroBg: '#0A1628',   // dark header-bleed for courts/home hero sections

  // Dark mode shadows: heavy, appropriate for lifting elements above dark canvas
  shadowCard: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 3,
  },
  shadowElevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.50,
    shadowRadius: 20,
    elevation: 5,
  },
  shadowSheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.60,
    shadowRadius: 24,
    elevation: 12,
  },
  shadowNav: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 8,
  },

  cyanOnLight:    '#2DE0FF',              // in dark mode, full cyan is correct
  selectedBg:     'rgba(45,224,255,0.10)', // dark selected = cyan tint
  selectedBorder: '#2DE0FF',              // dark selected border = cyan
  chipActiveBg:   '#2D6BFF',              // dark active chip = blue

  schedAvailBg:  'rgba(45,224,255,0.08)',  // available = cyan tint in dark
  schedMineBg:   'rgba(214,255,61,0.14)',  // mine = volt tint (same both modes)
  schedMaintBg:  'rgba(255,92,107,0.09)',  // maintenance = red tint (same both modes)
};
