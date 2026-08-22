import { useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { formatTime12h } from '@/lib/format';
import { TimeSlotWheel } from './TimeSlotWheel';

function buildSlots(stepMinutes: number): string[] {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return slots;
}

interface TimePickerProps {
  value: string | null;
  onChange: (v: string) => void;
  theme: ThemeTokens;
  label: string;
  stepMinutes?: number;
  testID?: string;
}

export function TimePicker({ value, onChange, theme, label, stepMinutes = 30, testID }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(value);
  const slots = useMemo(() => buildSlots(stepMinutes), [stepMinutes]);
  const s = useStyles(theme);

  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={s.trigger}
        onPress={() => { setDraft(value); setOpen(true); }}
        testID={testID}>
        <Text style={s.triggerText}>{value ? formatTime12h(value) : 'Select time'}</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={theme.textMuted} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
          <View style={{ padding: Spacing.pagePx }}>
            <TimeSlotWheel
              slots={slots}
              selectedSlot={draft}
              onSelectSlot={(slot) => setDraft(slot)}
              weather={null}
              outdoor={false}
              sheetDate={new Date()}
              now={new Date()}
              theme={theme}
            />
            <TouchableOpacity
              style={s.confirmBtn}
              onPress={() => { if (draft) { onChange(draft); } setOpen(false); }}>
              <Text style={s.confirmText}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.metadata,
      color: theme.textMuted,
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    trigger: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: Radius.input,
      padding: 14,
      backgroundColor: theme.pageBg,
      minHeight: Spacing.tapTarget,
      justifyContent: 'center',
    },
    triggerText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    modal: { flex: 1, backgroundColor: theme.cardBg },
    modalHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: Spacing.pagePx, borderBottomWidth: 1, borderBottomColor: theme.border,
    },
    modalTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: FontSize.sectionTitle, color: theme.textPrimary },
    confirmBtn: {
      marginTop: 16, backgroundColor: Colors.blue, borderRadius: Radius.button,
      paddingVertical: 14, alignItems: 'center', minHeight: Spacing.tapTarget, justifyContent: 'center',
    },
    confirmText: { fontFamily: FontFamily.manropeSemiBold, fontSize: 16, color: Colors.white },
  });
}
