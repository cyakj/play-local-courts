import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';

type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'destructive';

interface ButtonProps {
  variant?: ButtonVariant;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  label,
  onPress,
  loading = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const { theme } = useTheme();

  // Matches DESIGN.md "Buttons" spec exactly — brand colors stay constant
  // across themes, neutrals (ghost) adapt via theme tokens.
  const variantStyles: Record<ButtonVariant, { bg: string; text: string; borderColor?: string; borderWidth?: number }> = {
    primary:     { bg: Colors.blue,       text: Colors.white },
    accent:      { bg: Colors.volt,       text: '#11140A' },
    ghost:       { bg: 'transparent',     text: theme.textPrimary, borderColor: theme.borderStrong },
    destructive: { bg: 'transparent',     text: Colors.negative, borderColor: Colors.negative, borderWidth: 1.5 },
  };
  const v = variantStyles[variant];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.borderColor ?? 'transparent',
          borderWidth: v.borderColor ? (v.borderWidth ?? 1) : 0,
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
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: 16,
  },
});
