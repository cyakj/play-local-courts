import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { platformAlert } from '@/lib/platformAlert';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { Header } from '@/components/ui/Header';
import { HeaderSaveButton } from '@/components/ui/HeaderSaveButton';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { hasUnsavedChanges } from '@/lib/unsavedChanges';
import {
  ALWAYS_ON_IN_APP, DEFAULT_TOGGLES, ESSENTIAL_NOTE, NOTIFICATION_TOGGLES, PUSH_NOTE,
  type ToggleKey, type ToggleState,
} from '@/lib/notificationPrefs';
import { loadToggles, saveToggles } from '@/lib/notificationPrefsApi';

export default function SettingsNotificationsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [prefs, setPrefs] = useState<ToggleState>(DEFAULT_TOGGLES);
  // Last persisted value: dirty means "differs from this", not "was touched".
  const [saved, setSaved] = useState<ToggleState>(DEFAULT_TOGGLES);
  const [userId, setUserId] = useState<string | null>(null);
  const [rowExists, setRowExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setLoading(false); return; }
      try {
        const loaded = await loadToggles(user.id);
        if (cancelled) return;
        setUserId(user.id);
        setRowExists(loaded.rowExists);
        setPrefs(loaded.toggles);
        setSaved(loaded.toggles);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function toggle(key: ToggleKey) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const dirty = hasUnsavedChanges(prefs, saved);

  // Persist without navigating; resolves true only when EVERY write succeeded.
  async function persist(): Promise<boolean> {
    if (!userId) return false;
    setSaving(true);
    const result = await saveToggles(userId, saved, prefs, rowExists);
    setSaving(false);
    if (result.rowCreated) setRowExists(true); // the default row exists now, even if a later update failed
    if (!result.ok) {
      // Keep the screen honest: whatever did not save snaps back to its stored value.
      const reverted = { ...prefs };
      for (const f of result.failed) reverted[f.key] = saved[f.key];
      setPrefs(reverted);
      setSaved({ ...reverted });
      platformAlert('Some settings were not saved', 'Please check your connection and try again.');
      return false;
    }
    setSaved(prefs);
    setRowExists(true);
    return true;
  }

  const guard = useUnsavedChangesGuard({
    dirty,
    save: persist,
    discard: () => setPrefs(saved),
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
        title="Notifications"
        onBack={goBack}
        rightIcon={<HeaderSaveButton onPress={save} saving={saving} disabled={loading || !dirty || !userId} />}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loadError && (
            <Text testID="notif-load-error" style={[styles.note, { color: Colors.negative, marginBottom: 12 }]}>
              Your saved settings could not be loaded, so they cannot be changed right now. Please try again later.
            </Text>
          )}

          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>EMAIL PREFERENCES</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {NOTIFICATION_TOGGLES.map(({ key, label, desc }, i) => (
              <View key={key}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
                    <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{desc}</Text>
                  </View>
                  <Switch
                    testID={`notif-toggle-${key}`}
                    value={!loading && prefs[key]}
                    onValueChange={() => toggle(key)}
                    trackColor={{ false: theme.border, true: 'rgba(45,224,255,0.40)' }}
                    thumbColor={prefs[key] ? Colors.cyan : theme.textMuted}
                    disabled={loading || loadError || !userId || saving}
                    accessibilityLabel={label}
                  />
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 28 }]}>ALWAYS ON · IN-APP</Text>
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {ALWAYS_ON_IN_APP.map(({ label, desc }, i) => (
              <View key={label}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
                    <Text style={[styles.rowDesc, { color: theme.textMuted }]}>{desc}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
          <Text style={[styles.note, { color: theme.textMuted }]}>
            These appear in the Notifications list inside the app and cannot be switched off yet.
          </Text>
          <Text testID="notif-essential-note" style={[styles.note, { color: theme.textMuted }]}>{ESSENTIAL_NOTE}</Text>
          <Text testID="notif-push-note" style={[styles.note, { color: theme.textMuted }]}>{PUSH_NOTE}</Text>
        </View>
      </ScrollView>
      {guard.dialog}
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },
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
      marginTop: 12, lineHeight: 20,
    },
  }), [theme]);
}
