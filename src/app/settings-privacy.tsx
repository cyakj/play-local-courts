import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, UserCircle } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { platformAlert } from '@/lib/platformAlert';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { Header } from '@/components/ui/Header';
import { HeaderSaveButton } from '@/components/ui/HeaderSaveButton';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { hasUnsavedChanges } from '@/lib/unsavedChanges';

type PrivacyState = {
  location_visible:           boolean;
  show_activity_status:       boolean;
  show_exact_distance:        boolean;
  hide_contact_until_confirmed: boolean;
};

const DEFAULT: PrivacyState = {
  location_visible:             true,
  show_activity_status:         true,
  show_exact_distance:          false,
  hide_contact_until_confirmed: true,
};

const ROWS: { key: keyof PrivacyState; label: string; desc: string }[] = [
  { key: 'location_visible',            label: 'Show Location',          desc: 'Allow others to see your general location'         },
  { key: 'show_activity_status',        label: 'Activity Status',        desc: 'Show when you were last active in the app'         },
  { key: 'show_exact_distance',         label: 'Exact Distance',         desc: 'Show exact distance instead of approximate range'  },
  { key: 'hide_contact_until_confirmed',label: 'Hide Contact Until Match',desc: 'Only share contact info after a match is confirmed'},
];

export default function SettingsPrivacyScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [state, setState]     = useState<PrivacyState>(DEFAULT);
  // Last persisted value: dirty means "differs from this", not "was touched".
  const [saved, setSaved]     = useState<PrivacyState>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('location_visible, show_activity_status, show_exact_distance, hide_contact_until_confirmed')
        .eq('id', user.id)
        .single();
      if (data) {
        const loaded: PrivacyState = {
          location_visible:             data.location_visible             ?? DEFAULT.location_visible,
          show_activity_status:         data.show_activity_status         ?? DEFAULT.show_activity_status,
          show_exact_distance:          data.show_exact_distance          ?? DEFAULT.show_exact_distance,
          hide_contact_until_confirmed: data.hide_contact_until_confirmed ?? DEFAULT.hide_contact_until_confirmed,
        };
        setState(loaded);
        setSaved(loaded);
      }
      setLoading(false);
    }
    load();
  }, []);

  function toggle(key: keyof PrivacyState) {
    setState(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const dirty = hasUnsavedChanges(state, saved);

  // Persist without navigating; resolves true only when the write succeeded.
  async function persist(): Promise<boolean> {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return false; }
    const { error } = await supabase
      .from('profiles')
      .update(state)
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      platformAlert('Error', 'Could not save privacy settings. Please try again.');
      return false;
    }
    setSaved(state);
    return true;
  }

  const guard = useUnsavedChangesGuard({
    dirty,
    save: persist,
    discard: () => setState(saved),
  });

  function goBack() {
    if (router.canGoBack()) router.back(); else router.replace('/settings' as any);
  }

  async function save() {
    if (!dirty) { goBack(); return; }
    if (await persist()) { guard.allowNavigation(); goBack(); }
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.pageBg }]}>
      <Header
        variant="inner"
        title="Privacy"
        onBack={goBack}
        rightIcon={<HeaderSaveButton onPress={save} saving={saving} disabled={loading || !dirty} />}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Profile visibility lives in Edit Profile */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PROFILE</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/edit-profile' as any)}
              activeOpacity={0.7}>
              <View style={[styles.iconBox, { backgroundColor: theme.surface2 }]}>
                <UserCircle color={theme.textMuted} size={16} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>Profile Visibility</Text>
                <Text style={[styles.rowDesc, { color: theme.textMuted }]}>Who can see your player profile</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={16} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Toggle rows */}
          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>VISIBILITY & SHARING</Text>
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
                    value={!loading && state[key]}
                    onValueChange={() => toggle(key)}
                    trackColor={{ false: theme.border, true: 'rgba(45,224,255,0.40)' }}
                    thumbColor={state[key] ? Colors.cyan : theme.textMuted}
                    disabled={loading}
                  />
                </View>
              </View>
            ))}
          </View>

        </View>
      </ScrollView>
      {guard.dialog}
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
    linkRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 14, paddingHorizontal: 16, minHeight: 56,
    },
    iconBox: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    row: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14, gap: 12, minHeight: 64,
    },
    rowLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.body },
    rowDesc:  { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, marginTop: 2 },
  }), [theme]);
}
