import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/design';

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'destructive';

interface ButtonProps {
  variant?: ButtonVariant;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; borderColor?: string }> = {
  primary:     { bg: Colors.navy,       text: Colors.white },
  accent:      { bg: Colors.accentCyan, text: Colors.navy },
  ghost:       { bg: '#F3F4F6',         text: '#6B7280', borderColor: '#E5E7EB' },
  destructive: { bg: 'transparent',     text: Colors.red, borderColor: Colors.red },
};

export function Button({
  variant = 'primary',
  label,
  onPress,
  loading = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const v = variantStyles[variant];
  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.borderColor ?? 'transparent',
          borderWidth: v.borderColor ? 1 : 0,
        },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[styles.label, { color: v.text }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Spacing.tapTarget,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 14,
    fontWeight: '600',
  },
});
