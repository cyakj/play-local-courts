import { StyleSheet } from 'react-native';

export const Colors = {
  pageBg: '#F9FAFB',
  cardBg: '#FFFFFF',
  headerBg: '#0F1F3D',
  accentCyan: '#00D4FF',
  navy: '#0F1F3D',
  border: 'rgba(15,31,61,0.08)',
  coral: '#F97066',
  red: '#EF4444',
  textPrimary: '#0F1F3D',
  textMuted: '#8892A4',
  textSubtle: '#4B5563',
  textPlaceholder: '#9CA3AF',
  optimalBg: '#E0F9FF',
  attentionBg: '#FFF5F5',
  criticalBg: '#FEF2F2',
  blueMid: '#0369A1',
  white: '#FFFFFF',
} as const;

export const FontFamily = {
  manropeBlack: 'Manrope-Black',
  manropeExtraBold: 'Manrope-ExtraBold',
  manropeBold: 'Manrope-Bold',
  interRegular: 'Inter-Regular',
  interSemiBold: 'Inter-SemiBold',
} as const;

export const FontSize = {
  pageTitle: 32,
  sectionTitle: 18,
  cardTitle: 16,
  keyMetric: 40,
  statValue: 24,
  body: 15,
  uiLabel: 13,
  metadata: 11,
  min: 12,
} as const;

export const Radius = {
  card: 16,
  button: 12,
  pill: 99,
  input: 8,
  modal: 20,
} as const;

export const Spacing = {
  pagePx: 20,
  cardGap: 12,
  sectionGap: 16,
  cardPadding: 20,
  headerPt: 48,
  tapTarget: 44,
} as const;

export const MaxWidth = 480;

export const Shadow = StyleSheet.create({
  card: {
    shadowColor: '#0F1F3D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
}).card;

export const CyanGlow = StyleSheet.create({
  glow: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 4,
  },
}).glow;

export function getHealthColor(score: number): string {
  if (score >= 70) return Colors.accentCyan;
  if (score >= 40) return Colors.coral;
  return Colors.red;
}

export function getHealthAccent(score: number): 'optimal' | 'attention' | 'critical' {
  if (score >= 70) return 'optimal';
  if (score >= 40) return 'attention';
  return 'critical';
}
