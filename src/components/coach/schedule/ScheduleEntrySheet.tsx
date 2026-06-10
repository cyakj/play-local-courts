import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { DAY_NAMES } from '@/types/coachSchedule';

interface SheetProps {
  visible: boolean;
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
}

export function ScheduleEntrySheet({
  visible,
  title,
  children,
  onCancel,
  onSave,
  saveDisabled = false,
}: SheetProps) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onCancel} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity style={styles.iconButton} onPress={onCancel} activeOpacity={0.7}>
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saveDisabled && styles.disabled]}
              onPress={onSave}
              disabled={saveDisabled}
              activeOpacity={0.85}>
              <Text style={styles.saveLabel}>Add to Schedule Draft</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ScheduleField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  privateField = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  privateField?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {privateField && <Text style={styles.privateLabel}>PRIVATE</Text>}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textDisabled}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

export function DayPicker({
  selected,
  onChange,
  single = false,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
  single?: boolean;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{single ? 'DAY' : 'DAYS OF WEEK'}</Text>
      <View style={styles.dayRow}>
        {DAY_NAMES.map((day, index) => {
          const active = selected.includes(index);
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayChip, active && styles.dayChipActive]}
              onPress={() => {
                if (single) onChange([index]);
                else onChange(active ? selected.filter(item => item !== index) : [...selected, index].sort());
              }}
              activeOpacity={0.75}>
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day.slice(0, 2)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map(option => {
          const active = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.choiceChip, active && styles.choiceChipActive]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.75}>
              <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function VisibilityToggle({
  value,
  onChange,
  publicLabel = 'Publicly bookable',
  privateLabel = 'Private / internal',
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  publicLabel?: string;
  privateLabel?: string;
}) {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>VISIBILITY</Text>
      <View style={styles.visibilityRow}>
        <TouchableOpacity
          style={[styles.visibilityOption, value && styles.visibilityPublic]}
          onPress={() => onChange(true)}
          activeOpacity={0.75}>
          <Text style={[styles.visibilityText, value && styles.visibilityPublicText]}>{publicLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.visibilityOption, !value && styles.visibilityPrivate]}
          onPress={() => onChange(false)}
          activeOpacity={0.75}>
          <Text style={styles.visibilityText}>{privateLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.backdrop,
    },
    sheet: {
      maxHeight: '92%',
      minHeight: '58%',
      backgroundColor: theme.sheetBg,
      borderTopLeftRadius: Radius.xl,
      borderTopRightRadius: Radius.xl,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.shadowSheet,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 18,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      flex: 1,
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textPrimary,
    },
    iconButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      padding: Spacing.pagePx,
      gap: 18,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      padding: Spacing.pagePx,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    cancelButton: {
      flex: 1,
      height: 48,
      borderRadius: Radius.button,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    saveButton: {
      flex: 2,
      height: 48,
      borderRadius: Radius.button,
      backgroundColor: Colors.blue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: '#FFFFFF',
    },
    disabled: { opacity: 0.4 },
    field: { gap: 8 },
    fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.2,
    },
    privateLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.volt,
      letterSpacing: 1,
    },
    input: {
      minHeight: 48,
      borderRadius: Radius.input,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
      paddingHorizontal: 14,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    multiline: { minHeight: 88, paddingTop: 12 },
    dayRow: { flexDirection: 'row', gap: 6 },
    dayChip: {
      flex: 1,
      height: 42,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayChipActive: {
      backgroundColor: theme.selectedBg,
      borderColor: theme.selectedBorder,
    },
    dayLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      color: theme.textMuted,
    },
    dayLabelActive: { color: theme.selectedBorder },
    choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choiceChip: {
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    choiceChipActive: {
      backgroundColor: theme.selectedBg,
      borderColor: theme.selectedBorder,
    },
    choiceLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    choiceLabelActive: { color: theme.selectedBorder },
    visibilityRow: { flexDirection: 'row', gap: 8 },
    visibilityOption: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 10,
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    visibilityPublic: {
      borderWidth: 2,
      borderColor: Colors.cyan,
      backgroundColor: 'rgba(45,224,255,0.08)',
    },
    visibilityPrivate: {
      backgroundColor: theme.surface2,
      opacity: 0.72,
    },
    visibilityText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
    },
    visibilityPublicText: { color: theme.cyanOnLight },
  }), [theme]);
}
