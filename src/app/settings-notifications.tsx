import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { platformAlert } from '@/lib/platformAlert';
import type { Json } from '@/lib/types';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

type Prefs = {
  match_invitations: boolean;
  booking_confirmations: boolean;
  lesson_reminders: boolean;
  announcements: boolean;
  coach_messages: boolean;
};

const DEFAULT_PREFS: Prefs = {
  match_invitations:    true,
  booking_confirmations: true,
  lesson_reminders:     true,
  announcements:        true,
  coach_messages:       true,
};

const ROWS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: 'match_invitations',    label: 'Match Invitations',    desc: 'When another player invites you to a match'  },
  { key: 'booking_confirmations',label: 'Booking Confirmations', desc: 'Court reservation updates and reminders'    },
  { key: 'lesson_reminders',     label: 'Lesson Reminders',     desc: 'Upcoming lesson reminders from your coach'  },
  { key: 'announcements',        label: 'Announcements',        desc: 'HOA and community-wide announcements'        },
  { key: 'coach_messages',       label: 'Coach Messages',       desc: 'Direct messages and updates from coaches'   },
];

export default function SettingsNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [prefs, setPrefs]   = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();
      if (data?.notification_preferences && typeof data.notification_preferences === 'object') {
        setPrefs({ ...DEFAULT_PREFS, ...(data.notification_preferences as Partial<Prefs>) });
      }
      setLoading(false);
    }
    load();
  }, []);

  function toggle(key: keyof Prefs) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: prefs as unknown as Json })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      platformAlert('Error', 'Could not save preferences. Please try again.');
    } else {
      router.back();
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8, backgroundColor: theme.headerBg }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/settings' as any); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDim]}
          onPress={save}
          disabled={saving || loading}>
          <Text style={styles.saveBtnTxt}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ALERT PREFERENCES</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {ROWS.map(({ key, label, desc }, i) => (
              <View key={key}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
                    <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{desc}</Text>
                  </View>
                  <Switch
                    value={!loading && prefs[key]}
                    onValueChange={() => toggle(key)}
                    trackColor={{ false: theme.border, true: 'rgba(45,224,255,0.40)' }}
                    thumbColor={prefs[key] ? Colors.cyan : theme.textMuted}
                    disabled={loading}
                  />
                </View>
              </View>
            ))}
          </View>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            System notifications (security, account) are always sent.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx, paddingBottom: 14,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 18, color: Colors.white },
    saveBtn: {
      paddingHorizontal: 14, paddingVertical: 8,
      backgroundColor: Colors.blue, borderRadius: Radius.button,
    },
    saveBtnDim: { backgroundColor: 'rgba(45,107,255,0.35)' },
    saveBtnTxt: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: Colors.white },

    content: { padding: Spacing.pagePx, paddingBottom: 60 },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow,
      letterSpacing: 1.6, marginBottom: 10,
    },
    card: { borderRadius: Radius.card, borderWidth: 1, overflow: 'hidden' },
    divider: { height: 1, marginHorizontal: 16 },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12, minHeight: 64,
    },
    rowLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
    rowDesc:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2 },
    note: {
      fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label,
      marginTop: 16, lineHeight: 20,
    },
  }), [theme]);
}
