import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

const NTRP_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = useStyles(theme);

  const [fullName, setFullName] = useState('');
  const [ntrp, setNtrp] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [origName, setOrigName] = useState('');
  const [origNtrp, setOrigNtrp] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from('profiles')
        .select('full_name, ntrp_rating')
        .eq('id', user.id)
        .single();
      const name = data?.full_name ?? '';
      const rating = data?.ntrp_rating ?? null;
      setFullName(name);
      setNtrp(rating);
      setOrigName(name);
      setOrigNtrp(rating);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    setDirty(fullName !== origName || ntrp !== origNtrp);
  }, [fullName, ntrp, origName, origNtrp]);

  async function handleSave() {
    if (!dirty) { router.back(); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const trimmed = fullName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter your full name.');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: trimmed, ntrp_rating: ntrp })
      .eq('id', user.id);

    setSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } else {
      router.back();
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.pageBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8, backgroundColor: theme.headerBg }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {saving ? (
            <Text style={styles.saveBtnText}>Saving…</Text>
          ) : (
            <>
              <Check size={14} color={Colors.white} strokeWidth={2.5} />
              <Text style={styles.saveBtnText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Full Name */}
          <Text style={styles.fieldLabel}>FULL NAME</Text>
          <View style={[styles.inputWrap, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor={theme.textDisabled}
              autoCapitalize="words"
              autoComplete="name"
              editable={!loading}
            />
          </View>

          {/* NTRP Rating */}
          <Text style={[styles.fieldLabel, { marginTop: 28 }]}>NTRP RATING</Text>
          <Text style={styles.fieldHint}>
            National Tennis Rating Program — your self-assessed skill level.
          </Text>
          <View style={styles.ntrpGrid}>
            {NTRP_OPTIONS.map(val => {
              const active = ntrp === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.ntrpChip,
                    { borderColor: active ? Colors.blue : theme.border, backgroundColor: active ? 'rgba(45,107,255,0.12)' : theme.cardBg },
                  ]}
                  onPress={() => setNtrp(active ? null : val)}
                  activeOpacity={0.7}>
                  <Text style={[styles.ntrpChipText, { color: active ? Colors.blue : theme.textSecondary }]}>
                    {val.toFixed(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1 },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx,
      paddingBottom: 14,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 18,
      color: Colors.white,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: Colors.blue,
      borderRadius: Radius.button,
    },
    saveBtnDisabled: {
      backgroundColor: 'rgba(45,107,255,0.35)',
    },
    saveBtnText: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 13,
      color: Colors.white,
    },

    content: { padding: Spacing.pagePx, paddingBottom: 60 },

    fieldLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 1.6,
      marginBottom: 10,
    },
    fieldHint: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
      marginBottom: 14,
      lineHeight: 20,
    },
    inputWrap: {
      borderWidth: 1.5,
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    input: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.body,
    },

    ntrpGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    ntrpChip: {
      borderWidth: 1.5,
      borderRadius: Radius.chip,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minWidth: 60,
      alignItems: 'center',
    },
    ntrpChipText: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 14,
    },

  }), [theme]);
}
