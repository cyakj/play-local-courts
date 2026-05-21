import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, Trash2, Dumbbell, Waves, Building2, Flame, X } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors,
  FontFamily,
  FontSize,
  Radius,
  Spacing,
  MaxWidth,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Database } from '@/lib/types';

type Court = Database['public']['Tables']['courts']['Row'];

const COURT_TYPES = [
  'tennis',
  'pickleball',
  'pool',
  'gym',
  'clubhouse',
  'barbecue',
  'jacuzzi',
] as const;

type CourtTypeValue = (typeof COURT_TYPES)[number];

function getTypeIcon(courtType: string) {
  switch (courtType) {
    case 'tennis':
    case 'pickleball':
    case 'gym':
      return <Dumbbell color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    case 'pool':
    case 'jacuzzi':
      return <Waves color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    case 'clubhouse':
      return <Building2 color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    case 'barbecue':
      return <Flame color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
    default:
      return <Dumbbell color={Colors.accentCyan} size={20} strokeWidth={1.5} />;
  }
}

export default function ManageAmenitiesScreen() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CourtTypeValue>('tennis');
  const [saving, setSaving] = useState(false);

  async function loadCourts() {
    setLoading(true);
    const { data } = await supabase
      .from('courts')
      .select('*')
      .order('name', { ascending: true });
    setCourts(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadCourts();
  }, []);

  function confirmDelete(court: Court) {
    Alert.alert(
      'Delete Amenity',
      `Are you sure you want to delete "${court.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCourt(court.id),
        },
      ],
    );
  }

  async function deleteCourt(id: string) {
    await supabase.from('courts').delete().eq('id', id);
    loadCourts();
  }

  async function addCourt() {
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from('courts').insert({
      name: newName.trim(),
      court_type: newType,
      hoa_id: '',
    });
    setSaving(false);
    setModalVisible(false);
    setNewName('');
    setNewType('tennis');
    loadCourts();
  }

  const plusButton = (
    <TouchableOpacity
      onPress={() => setModalVisible(true)}
      style={styles.plusBtn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Plus color="#FFFFFF" size={22} strokeWidth={1.5} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <Header
        variant="inner"
        title="Manage Amenities"
        onBack={() => router.back()}
        rightIcon={plusButton}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {!loading && courts.length === 0 && (
            <EmptyState
              icon={<Building2 color={Colors.textMuted} size={48} strokeWidth={1.5} />}
              title="No amenities yet"
              subtitle="Add your first amenity using the + button above."
            />
          )}

          {courts.map((court) => (
            <Card key={court.id} style={styles.courtCard}>
              <View style={styles.courtRow}>
                <View style={styles.typeIconWrap}>{getTypeIcon(court.court_type)}</View>
                <View style={styles.courtInfo}>
                  <Text style={styles.courtName}>{court.name}</Text>
                  <Text style={styles.courtType}>{court.court_type.toUpperCase()}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => confirmDelete(court)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 color={Colors.red} size={18} strokeWidth={1.5} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Add Amenity Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Amenity</Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color={Colors.textMuted} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Court 1, Main Pool…"
              placeholderTextColor={Colors.textPlaceholder}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>TYPE</Text>
            <View style={styles.typeGrid}>
              {COURT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typePill, newType === t && styles.typePillActive]}
                  onPress={() => setNewType(t)}>
                  <Text style={[styles.typePillLabel, newType === t && styles.typePillLabelActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                variant="accent"
                label="Add Amenity"
                onPress={addCourt}
                loading={saving}
                fullWidth
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },
  scroll: { flex: 1 },
  content: { padding: Spacing.pagePx, gap: Spacing.cardGap, paddingBottom: 100 },
  plusBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtCard: { padding: 16 },
  courtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,212,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtInfo: { flex: 1 },
  courtName: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.cardTitle,
    color: Colors.textPrimary,
  },
  courtType: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal
  modal: { flex: 1, backgroundColor: Colors.cardBg },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.pagePx,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.textPrimary,
  },
  modalScroll: { flex: 1 },
  modalContent: {
    padding: Spacing.pagePx,
    paddingBottom: 40,
  },
  fieldLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.input,
    padding: 14,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.pageBg,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typePill: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.cardBg,
  },
  typePillActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  typePillLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  typePillLabelActive: {
    color: Colors.white,
  },
  modalActions: {
    marginTop: 32,
  },
});
