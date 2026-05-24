import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];

const CATEGORIES = [
  'plumbing', 'electrical', 'structural', 'cleanliness',
  'equipment', 'safety', 'other',
] as const;
type Category = (typeof CATEGORIES)[number];

export default function ReportScreen() {
  const [category, setCategory] = useState<Category>('other');
  const [description, setDescription] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedAmenityId, setSelectedAmenityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [userId, setUserId] = useState('');
  const [hoaId, setHoaId] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: membership } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single();

      const hId = membership?.hoa_id ?? '';
      setHoaId(hId);

      if (hId) {
        const { data } = await supabase
          .from('courts')
          .select('id, name, court_type, hoa_id, created_at, updated_at')
          .eq('hoa_id', hId)
          .order('name');
        setCourts(data ?? []);
      }
    }
    init();
  }, []);

  async function submit() {
    if (!description.trim() || !userId || !hoaId) return;
    setLoading(true);
    await supabase.from('maintenance_reports').insert({
      category,
      description: description.trim(),
      hoa_id: hoaId,
      reporter_id: userId,
      status: 'open',
      amenity_id: selectedAmenityId ?? undefined,
    });
    setLoading(false);
    setSubmitted(true);
  }

  function reset() {
    setCategory('other');
    setDescription('');
    setSelectedAmenityId(null);
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <View style={styles.screen}>
        <Header variant="resident" />
        <View style={styles.successContainer}>
          <CheckCircle color={Colors.accentCyan} size={64} strokeWidth={1.5} />
          <Text style={styles.successTitle}>Report Submitted</Text>
          <Text style={styles.successSubtitle}>
            Your HOA admin has been notified and will review the issue.
          </Text>
          <Button variant="accent" label="Submit Another" onPress={reset} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Report Issue" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Category */}
          <Text style={styles.fieldLabel}>CATEGORY</Text>
          <View style={styles.pillRow}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.pill, category === cat && styles.pillActive]}
                onPress={() => setCategory(cat)}>
                <Text style={[styles.pillLabel, category === cat && styles.pillLabelActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amenity picker */}
          {courts.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 20 }]}>LOCATION (OPTIONAL)</Text>
              <View style={styles.pillRow}>
                <TouchableOpacity
                  style={[styles.pill, !selectedAmenityId && styles.pillActive]}
                  onPress={() => setSelectedAmenityId(null)}>
                  <Text style={[styles.pillLabel, !selectedAmenityId && styles.pillLabelActive]}>
                    None
                  </Text>
                </TouchableOpacity>
                {courts.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.pill, selectedAmenityId === c.id && styles.pillActive]}
                    onPress={() => setSelectedAmenityId(c.id)}>
                    <Text style={[styles.pillLabel, selectedAmenityId === c.id && styles.pillLabelActive]}>
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Description */}
          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>DESCRIPTION</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue in detail…"
            placeholderTextColor={Colors.textPlaceholder}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <View style={styles.submitRow}>
            <Button
              variant="accent"
              label="Submit Report"
              onPress={submit}
              loading={loading}
              disabled={!description.trim()}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, paddingBottom: 60 },
  fieldLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.cardBg,
  },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  pillLabelActive: { color: Colors.white },
  textArea: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: 14,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.pageBg,
    minHeight: 120,
  },
  submitRow: { marginTop: 32 },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: Spacing.pagePx,
  },
  successTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
  },
  successSubtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
