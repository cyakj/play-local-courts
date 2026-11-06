import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontFamily, Radius } from '@/constants/design';
import { durationLabel } from '@/lib/bookingDurations';
import type { ThemeTokens } from '@/constants/theme-tokens';

/** Lengths an HOA administrator can offer. Multi-select: residents see exactly the chosen set. */
export const DURATION_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240] as const;

interface Props {
  label: string;
  hint?: string;
  value: number[];
  onChange: (next: number[]) => void;
  theme: ThemeTokens;
  testID?: string;
}

export function DurationChips({ label, hint, value, onChange, theme, testID }: Props) {
  const s = makeStyles(theme);
  // A previously saved length outside the standard choices is still shown (and removable) so it is never silently dropped.
  const choices = Array.from(new Set<number>([...DURATION_CHOICES, ...value])).sort((a, b) => a - b);
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b));
  return (
    <View testID={testID}>
      <Text style={s.label}>{label}</Text>
      <View style={s.wrap}>
        {choices.map((d) => {
          const on = value.includes(d);
          return (
            <TouchableOpacity
              key={d}
              testID={testID ? `${testID}-${d}` : undefined}
              style={[s.chip, on && s.chipOn]}
              onPress={() => toggle(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${durationLabel(d)}${on ? ', allowed' : ', not allowed'}`}
              activeOpacity={0.7}>
              <Text style={[s.chipText, on && s.chipTextOn]}>{durationLabel(d)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

function makeStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    label: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 1.2, color: theme.textMuted, marginBottom: 8 },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: Radius.chip, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' },
    chipOn: { backgroundColor: theme.selectedBg, borderColor: theme.selectedBorder },
    chipText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 12, color: theme.textSecondary, letterSpacing: 0.3 },
    chipTextOn: { color: theme.selectedBorder },
    hint: { fontFamily: FontFamily.manropeMedium, fontSize: 12, color: theme.textMuted, marginTop: 6 },
  });
}
