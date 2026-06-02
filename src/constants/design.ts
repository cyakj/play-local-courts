import { StyleSheet } from 'react-native';

// ─── Colors ───────────────────────────────────────────────────────────────────
// TenisX Design System v1.0 — Dark-first canvas
// Source of truth: TenisX Design System (standalone).html

export const Colors = {
  // ── Canvas / Backgrounds ──
  midnight:     '#080A11',   // --ink-950 / deepest bg
  pageBg:       '#0C0F18',   // --bg · page canvas (was #F9FAFB)
  bgElevated:   '#11141F',   // --bg-elevated · floating panels
  cardBg:       '#161A26',   // --surface · cards, sheets (was #FFFFFF)
  surface2:     '#1B2030',   // --surface-2 · nested surfaces

  // ── Borders ──
  border:       '#232838',   // --border (was rgba(15,31,61,0.08))
  borderStrong: '#333A4D',   // --border-strong
  borderGlow:   'rgba(45,224,255,0.35)', // active card ring

  // ── Brand Blues ──
  courtBlue:    '#0F2A57',   // header base
  courtBlue2:   '#103A78',
  blue:         '#2D6BFF',   // --action · primary CTAs
  blueHi:       '#5B8CFF',   // hover/pressed
  cyan:         '#2DE0FF',   // --accent · active/live/connected (was #00D4FF)
  cyanHi:       '#7FF0FF',   // glow highlight
  aiGlow:       '#BFFCFF',   // AI glow tint

  // ── Athletic ──
  volt:         '#D6FF3D',   // --warning · live sessions, go-live
  voltLo:       '#A8CC1F',
  positive:     '#2FD98B',   // --positive · confirmed / success
  negative:     '#FF5C6B',   // --negative · error / missed (was coral + red)

  // ── Foreground Text (on dark) ──
  white:        '#F5F8FF',   // --fg · primary text (was #FFFFFF)
  fg2:          '#9AA3B8',   // --fg-2 · secondary text
  fg3:          '#7A839A',   // --fg-3 · muted / minimum readable text
  fgDisabled:   '#5A6379',   // --fg-disabled · NEVER for readable text

  // ── Legacy aliases — preserved for non-refactored screens ──
  // These resolve to dark-system values so light screens get better defaults too
  headerBg:     '#0F2A57',
  navy:         '#0F1F3D',
  accentCyan:   '#2DE0FF',   // updated: was #00D4FF
  textPrimary:  '#F5F8FF',   // updated: was #0F1F3D
  textMuted:    '#7A839A',   // updated: was #6B7280
  textSubtle:   '#9AA3B8',   // updated: was #4B5563
  textPlaceholder: '#5A6379',
  coral:        '#FF5C6B',   // updated: was #F97066
  red:          '#FF5C6B',   // updated: was #EF4444
  optimalBg:    'rgba(47,217,139,0.15)',
  attentionBg:  'rgba(255,92,107,0.15)',
  criticalBg:   'rgba(255,92,107,0.12)',
  blueMid:      '#2FD98B',   // updated: was #0369A1
} as const;

// ─── Font Families ────────────────────────────────────────────────────────────
// Space Grotesk  → display, headlines, big numbers
// Manrope        → body copy, UI labels, buttons
// JetBrains Mono → data chips, eyebrows, status pills, court codes

export const FontFamily = {
  // ── New design system fonts ──
  spaceGroteskBold:      'SpaceGrotesk-Bold',       // headlines, page titles, stats
  manropeBold:           'Manrope-Bold',             // card titles, section titles
  manropeExtraBold:      'Manrope-ExtraBold',        // strong UI emphasis
  manropeSemiBold:       'Manrope-SemiBold',         // buttons, labels (replaces interSemiBold)
  manropeMedium:         'Manrope-Medium',           // body copy (replaces interRegular)
  jetbrainsMonoSemiBold: 'JetBrainsMono-SemiBold',  // chips, eyebrows, status, codes

  // ── Legacy aliases — map to closest Manrope equivalent ──
  manropeBlack:  'Manrope-Black',
  interSemiBold: 'Manrope-SemiBold',  // backward compat — avoid new usages
  interRegular:  'Manrope-Medium',    // backward compat — avoid new usages
} as const;

// ─── Font Sizes ───────────────────────────────────────────────────────────────

export const FontSize = {
  display:      36,   // --t-h1  · hero/greeting
  pageTitle:    32,   // large page greetings
  sectionTitle: 22,   // --t-h3  · section headers (min 22px)
  cardTitle:    18,   // --t-h4  · card titles (min 18px)
  keyMetric:    40,   // big stat numbers
  statValue:    24,
  body:         16,   // --t-body · all readable body text (min 16px)
  uiLabel:      15,
  label:        14,   // --t-sm   · buttons, row labels (min 14px)
  metadata:     12,   // --t-xs   · non-readable decorative only
  eyebrow:      11,   // --t-eyebrow · JetBrains Mono ALL CAPS chips
  min:          12,
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const Radius = {
  xs:     6,    // --r-xs · small tags
  sm:     10,   // --r-sm · inputs, buttons
  card:   14,   // --r-md · default card radius (was 16)
  lg:     20,   // --r-lg · large cards, sheets
  xl:     28,   // --r-xl · bottom sheet top corners
  modal:  20,
  button: 10,   // --r-sm (was 12)
  chip:   12,   // --r-chip · interactive filter chips, date/duration/segmented controls
  pill:   999,  // --r-pill · status badges only (NOT for interactive chips)
  input:  10,
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const Spacing = {
  // 4px base grid — s-1 through s-20
  s1:  4,
  s2:  8,
  s3:  12,
  s4:  16,
  s5:  20,
  s6:  24,
  s8:  32,
  s10: 40,
  s12: 48,
  s16: 64,
  s20: 80,

  // Semantic layout tokens
  pagePx:           20,   // horizontal page padding
  cardGap:          16,   // gap between stacked cards
  sectionGap:       24,   // gap between sections
  cardPadding:      20,   // internal card padding
  headerPt:         48,   // top padding (clears iOS status bar)
  tapTarget:        48,   // button minimum height
  iconTapTarget:    44,   // icon-button minimum touch zone
  listRowHeight:    56,   // minimum tappable list row
  quickActionHeight:72,   // quick action button height
  bottomNavHeight:  76,   // total bottom nav bar height
} as const;

export const MaxWidth = 480;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const Shadow = StyleSheet.create({
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 6,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 3,
  },
}).card;

export const CyanGlow = StyleSheet.create({
  glow: {
    shadowColor: '#2DE0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 6,
  },
}).glow;

// ─── Gradients ────────────────────────────────────────────────────────────────
// For use with expo-linear-gradient or as fallback solid colors

export const GradientColors = {
  court: ['#0F2A57', '#081427', '#080A11'] as const, // --grad-court
  signal: ['#2D6BFF', '#2DE0FF'] as const,           // --grad-signal
} as const;

// ─── Motion ───────────────────────────────────────────────────────────────────

export const Motion = {
  fast: 140,   // tap feedback, state toggles
  base: 220,   // card transitions
  slow: 420,   // sheet/modal entrance
} as const;

// ─── Health Score ─────────────────────────────────────────────────────────────

export function getHealthColor(score: number): string {
  if (score >= 70) return Colors.cyan;      // optimal
  if (score >= 40) return Colors.volt;      // warning
  return Colors.negative;                   // critical
}

export function getHealthAccent(score: number): 'optimal' | 'attention' | 'critical' {
  if (score >= 70) return 'optimal';
  if (score >= 40) return 'attention';
  return 'critical';
}
