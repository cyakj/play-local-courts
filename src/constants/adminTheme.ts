// Admin light-mode semantic tokens. The Admin experience is always light,
// regardless of device appearance or the resident theme preference.
// Contrast (WCAG AA, text on its paired background):
//   text #0C1A3A / bg #FFFFFF      16.9:1     textSecondary #3D4A5C / #FFFFFF  9.0:1
//   textMuted #556070 / #FFFFFF     6.4:1     onPrimary #FFFFFF / primary #2D6BFF 4.9:1
//   successText #0F6B42 / #E3F6EC   5.9:1     warningText #7A4F00 / #FFF3D6    6.2:1
//   errorText #A81F2E / #FDE8EA     6.0:1     infoText #1C45B8 / #E6EEFF       6.6:1

export const A = {
  // Surfaces
  background: '#F4F7FB',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  surfaceAlt: '#EBF0F7',

  // Text
  text: '#0C1A3A',
  textSecondary: '#3D4A5C',
  textMuted: '#556070',
  disabled: '#A8B2C0',
  disabledBg: '#E3E8F0',

  // Actions / accents
  primary: '#2D6BFF',
  primaryPressed: '#1F55DB',
  onPrimary: '#FFFFFF',
  navy: '#0F2A57',
  accent: '#1A7FBF', // cyan, calibrated for white backgrounds
  accentBg: '#E2F4FB',

  // Structure
  border: '#DCE2EC',
  borderStrong: '#BAC3D3',
  overlay: 'rgba(12,26,58,0.45)',

  // Status (text on paired bg)
  success: '#2FD98B',
  successText: '#0F6B42',
  successBg: '#E3F6EC',
  warning: '#F2A900',
  warningText: '#7A4F00',
  warningBg: '#FFF3D6',
  error: '#E5384A',
  errorText: '#A81F2E',
  errorBg: '#FDE8EA',
  info: '#2D6BFF',
  infoText: '#1C45B8',
  infoBg: '#E6EEFF',
} as const;

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'accent';

export const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: A.surfaceAlt, fg: A.textSecondary, border: A.border },
  info: { bg: A.infoBg, fg: A.infoText, border: '#C5D6FF' },
  success: { bg: A.successBg, fg: A.successText, border: '#BFE8D2' },
  warning: { bg: A.warningBg, fg: A.warningText, border: '#F5DDA0' },
  error: { bg: A.errorBg, fg: A.errorText, border: '#F6C3C9' },
  accent: { bg: A.accentBg, fg: '#0E5E8C', border: '#B8E0F2' },
};

export const AShadow = {
  card: {
    shadowColor: '#0C1A3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  sheet: {
    shadowColor: '#0C1A3A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

/** Clearance below scrolling content so the tab bar (and any dev overlay) never covers the last row. */
export const ADMIN_BOTTOM_PAD = 112;
export const ADMIN_PAGE_PX = 16;
export const ADMIN_MAX_WIDTH = 560;

export const STATUS_TONE: Record<string, Tone> = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
  pending: 'warning',
  confirmed: 'success',
  approved: 'success',
  rejected: 'error',
  cancelled: 'error',
  canceled: 'error',
  removed: 'neutral',
  blocked: 'error',
};

export const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  pending: 'Pending',
  confirmed: 'Confirmed',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  removed: 'Deactivated',
  blocked: 'Blocked',
};
