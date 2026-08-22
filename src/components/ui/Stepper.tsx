import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

interface StepperProps {
  value: number | null;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string;
  theme: ThemeTokens;
  testID?: string;
}

export function Stepper({ value, onChange, min, max, step = 1, unit, label, theme, testID }: StepperProps) {
  const current = value ?? min;
  const dec = () => onChange(Math.max(min, current - step));
  const inc = () => onChange(Math.min(max, current + step));

  return (
    <View>
      <Text style={styles(theme).fieldLabel}>{label}</Text>
      <View style={styles(theme).row} testID={testID}>
        <TouchableOpacity
          style={[styles(theme).btn, current <= min && styles(theme).btnDisabled]}
          onPress={dec}
          disabled={current <= min}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Minus color={current <= min ? theme.textMuted : theme.textPrimary} size={18} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles(theme).value}>{current}{unit ? ` ${unit}` : ''}</Text>
        <TouchableOpacity
          style={[styles(theme).btn, current >= max && styles(theme).btnDisabled]}
          onPress={inc}
          disabled={current >= max}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Plus color={current >= max ? theme.textMuted : theme.textPrimary} size={18} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function styles(theme: ThemeTokens) {
  return StyleSheet.create({
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata,
      color: theme.textMuted, letterSpacing: 1.2, marginBottom: 8,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: theme.border, borderRadius: Radius.input,
      paddingHorizontal: 12, minHeight: Spacing.tapTarget, backgroundColor: theme.pageBg,
    },
    btn: {
      width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.surface2,
    },
    btnDisabled: { opacity: 0.35 },
    value: {
      fontFamily: FontFamily.manropeBold, fontSize: FontSize.body, color: theme.textPrimary,
    },
  });
}
