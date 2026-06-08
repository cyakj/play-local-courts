import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import { useCoachStudents } from '@/hooks/useCoachStudents';
import type { CoachStudent } from '@/hooks/useCoachStudents';
import { CoachStudentRow } from '@/components/coach/CoachStudentRow';
import { CoachStudentDetail } from '@/components/coach/CoachStudentDetail';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import type { ThemeTokens } from '@/constants/theme-tokens';

export default function CoachStudentsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState<CoachStudent | null>(null);
  const { students, loading, saveNotes }  = useCoachStudents();

  const filtered = useMemo(() =>
    students.filter(s =>
      (s.playerName ?? '').toLowerCase().includes(search.toLowerCase()),
    ),
    [students, search],
  );

  async function handleSaveNotes(notes: string): Promise<string | null> {
    if (!selected) return null;
    return saveNotes(selected.playerId, notes);
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header variant="coach" />

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Search size={15} color={theme.textMuted} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search students…"
          placeholderTextColor={Colors.fgDisabled}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {search ? 'No results' : 'No students yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try a different name.' : 'Students will appear after you accept lesson requests.'}
            </Text>
          </View>
        ) : (
          filtered.map(s => (
            <CoachStudentRow
              key={s.playerId}
              student={s}
              onPress={() => setSelected(s)}
            />
          ))
        )}
      </ScrollView>

      <CoachStudentDetail
        student={selected}
        visible={selected !== null}
        onClose={() => setSelected(null)}
        onSaveNotes={handleSaveNotes}
      />
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 12,
    },
    searchInput: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
      color: theme.textPrimary,
    },
    content: {
      padding: Spacing.pagePx,
      paddingBottom: 100,
      gap: Spacing.cardGap,
    },
    emptyText: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
      paddingTop: 40,
    },
    emptyState: {
      paddingTop: 60,
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
      color: theme.textSecondary,
      letterSpacing: -0.2,
    },
    emptySubtitle: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      textAlign: 'center',
    },
  }), [theme]);
}
