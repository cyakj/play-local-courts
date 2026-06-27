import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Package, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import { useMyLessonPackages, type LessonPackage, type PackageInsert } from '@/hooks/useLessonPackages';

const LESSON_TYPE_OPTIONS = [
  { value: 'private',      label: 'Private'      },
  { value: 'semi-private', label: 'Semi-Private'  },
  { value: 'group',        label: 'Group'         },
  { value: 'junior',       label: 'Junior'        },
];

const DURATION_OPTIONS = [
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '60 min' },
  { value: 90,  label: '90 min' },
];

const SESSION_OPTIONS = [1, 2, 4, 6, 8, 10];

function formatPrice(price: number): string {
  return `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`;
}

// ── Package Form Modal ────────────────────────────────────────────────────────

interface PackageFormState {
  title: string;
  lessonType: string | null;
  durationMin: number;
  price: string;
  numSessions: number;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: PackageFormState = {
  title:       '',
  lessonType:  null,
  durationMin: 60,
  price:       '',
  numSessions: 1,
  description: '',
  isActive:    true,
};

function formFromPackage(pkg: LessonPackage): PackageFormState {
  return {
    title:       pkg.title,
    lessonType:  pkg.lessonType,
    durationMin: pkg.durationMin,
    price:       pkg.price % 1 === 0 ? String(pkg.price) : pkg.price.toFixed(2),
    numSessions: pkg.numSessions,
    description: pkg.description ?? '',
    isActive:    pkg.isActive,
  };
}

interface PackageModalProps {
  visible: boolean;
  editing: LessonPackage | null;
  onClose: () => void;
  onCreate: (pkg: PackageInsert) => Promise<string | null>;
  onUpdate: (id: string, pkg: Partial<PackageInsert>) => Promise<string | null>;
}

function PackageModal({ visible, editing, onClose, onCreate, onUpdate }: PackageModalProps) {
  const { theme } = useTheme();
  const styles = useModalStyles(theme);

  const [form, setForm] = useState<PackageFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useMemo(() => {
    if (visible) {
      setForm(editing ? formFromPackage(editing) : EMPTY_FORM);
      setFormError(null);
    }
  }, [visible, editing]);

  function set<K extends keyof PackageFormState>(key: K, val: PackageFormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    const price = parseFloat(form.price);
    if (!form.title.trim())    { setFormError('Title is required.'); return; }
    if (isNaN(price) || price < 0) { setFormError('Enter a valid price (0 or more).'); return; }

    setSaving(true);
    setFormError(null);

    const payload: PackageInsert = {
      title:       form.title.trim(),
      lessonType:  form.lessonType,
      durationMin: form.durationMin,
      price,
      numSessions: form.numSessions,
      description: form.description.trim() || null,
      isActive:    form.isActive,
    };

    const err = editing
      ? await onUpdate(editing.id, payload)
      : await onCreate(payload);

    setSaving(false);
    if (err) { setFormError(err); return; }
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.modal, { backgroundColor: theme.pageBg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} strokeWidth={2} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            {editing ? 'Edit Package' : 'New Package'}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {formError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorTxt}>{formError}</Text>
            </View>
          )}

          {/* Title */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Package Title *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.border, color: theme.textPrimary }]}
            value={form.title}
            onChangeText={v => set('title', v)}
            placeholder="e.g. Beginner Starter Pack"
            placeholderTextColor={Colors.fgDisabled}
            maxLength={80}
          />

          {/* Lesson Type */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Lesson Type (optional)</Text>
          <View style={styles.chipRow}>
            {LESSON_TYPE_OPTIONS.map(lt => {
              const active = form.lessonType === lt.value;
              return (
                <TouchableOpacity
                  key={lt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => set('lessonType', active ? null : lt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{lt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Duration */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Duration Per Session *</Text>
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map(d => {
              const active = form.durationMin === d.value;
              return (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => set('durationMin', d.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Price */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Total Price (USD) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.border, color: theme.textPrimary }]}
            value={form.price}
            onChangeText={v => set('price', v)}
            placeholder="e.g. 150"
            placeholderTextColor={Colors.fgDisabled}
            keyboardType="decimal-pad"
          />

          {/* Num Sessions */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Number of Sessions *</Text>
          <View style={styles.chipRow}>
            {SESSION_OPTIONS.map(n => {
              const active = form.numSessions === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => set('numSessions', n)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline, { backgroundColor: theme.border, color: theme.textPrimary }]}
            value={form.description}
            onChangeText={v => set('description', v)}
            placeholder="What players get, goals, any details…"
            placeholderTextColor={Colors.fgDisabled}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={400}
          />

          {/* Active toggle */}
          <TouchableOpacity
            style={[styles.toggleRow, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={() => set('isActive', !form.isActive)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleLabel, { color: theme.textPrimary }]}>Active (visible to players)</Text>
            <View style={[styles.toggle, form.isActive && styles.toggleOn]}>
              <View style={[styles.toggleThumb, form.isActive && styles.toggleThumbOn]} />
            </View>
          </TouchableOpacity>

          {/* Price per session callout */}
          {(() => {
            const price = parseFloat(form.price);
            if (!isNaN(price) && price > 0 && form.numSessions > 1) {
              const perSession = price / form.numSessions;
              return (
                <View style={styles.perSessionRow}>
                  <Text style={styles.perSessionTxt}>
                    {formatPrice(perSession)} per session · {form.numSessions} × {form.durationMin} min
                  </Text>
                </View>
              );
            }
            return null;
          })()}
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={styles.saveBtnLabel}>{editing ? 'Save Changes' : 'Create Package'}</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Package Row ───────────────────────────────────────────────────────────────

interface PackageRowProps {
  pkg: LessonPackage;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function PackageRow({ pkg, onEdit, onToggle, onDelete }: PackageRowProps) {
  const { theme } = useTheme();
  const styles = useRowStyles(theme);

  const typeLabel = LESSON_TYPE_OPTIONS.find(o => o.value === pkg.lessonType)?.label;

  return (
    <View style={[styles.row, !pkg.isActive && styles.rowInactive]}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.rowTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {pkg.title}
          </Text>
          <View style={styles.meta}>
            {typeLabel && (
              <View style={styles.typeChip}>
                <Text style={styles.typeChipTxt}>{typeLabel.toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.metaTxt}>
              {pkg.durationMin} min · {pkg.numSessions === 1 ? '1 session' : `${pkg.numSessions} sessions`}
            </Text>
          </View>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.price}>{formatPrice(pkg.price)}</Text>
          {pkg.numSessions > 1 && (
            <Text style={styles.pricePerSess}>
              {formatPrice(pkg.price / pkg.numSessions)}/ea
            </Text>
          )}
        </View>
      </View>

      {pkg.description ? (
        <Text style={styles.desc} numberOfLines={2}>{pkg.description}</Text>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.statusBadge, pkg.isActive ? styles.activeBadge : styles.inactiveBadge]}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <Text style={[styles.statusTxt, pkg.isActive ? styles.activeTxt : styles.inactiveTxt]}>
            {pkg.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </TouchableOpacity>

        <View style={styles.iconActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil size={15} strokeWidth={1.8} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={15} strokeWidth={1.8} color={Colors.negative} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LessonPackagesManager() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { packages, loading, error, refresh, create, update, toggleActive, remove } =
    useMyLessonPackages();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<LessonPackage | null>(null);

  function openCreate() {
    setEditing(null);
    setModalVisible(true);
  }

  function openEdit(pkg: LessonPackage) {
    setEditing(pkg);
    setModalVisible(true);
  }

  function closeModal() {
    setModalVisible(false);
    setEditing(null);
  }

  function handleToggle(pkg: LessonPackage) {
    const label = pkg.isActive ? 'Deactivate' : 'Activate';
    const msg = pkg.isActive
      ? 'Players will no longer see this package.'
      : 'Players will be able to see and select this package.';
    Alert.alert(label, msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          const err = await toggleActive(pkg.id, pkg.isActive);
          if (err) Alert.alert('Error', err);
        },
      },
    ]);
  }

  function handleDelete(pkg: LessonPackage) {
    Alert.alert(
      'Delete Package',
      `Remove "${pkg.title}"? Existing lesson requests that referenced it will be unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const err = await remove(pkg.id);
            if (err) Alert.alert('Error', err);
          },
        },
      ],
    );
  }

  return (
    <View>
      {/* Section header row */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLeft}>
          <Package size={14} strokeWidth={1.8} color={Colors.cyan} />
          <Text style={styles.sectionLabel}>LESSON PACKAGES</Text>
        </View>
        {!loading && packages.length > 0 && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCreate}
            activeOpacity={0.8}
          >
            <Plus size={13} strokeWidth={2.2} color={Colors.blue} />
            <Text style={styles.addBtnLabel}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={Colors.cyan} />
        </View>
      )}

      {error && (
        <View style={[styles.errorBanner, { borderColor: theme.border }]}>
          <Text style={styles.errorTxt}>{error}</Text>
          <TouchableOpacity onPress={refresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && packages.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>No packages yet</Text>
          <Text style={[styles.emptyBody, { color: theme.textMuted }]}>
            Create packages to let players book multi-session lessons at a set price.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreate} activeOpacity={0.8}>
            <Plus size={14} strokeWidth={2} color={Colors.white} />
            <Text style={styles.emptyBtnLabel}>Create First Package</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && packages.map(pkg => (
        <PackageRow
          key={pkg.id}
          pkg={pkg}
          onEdit={() => openEdit(pkg)}
          onToggle={() => handleToggle(pkg)}
          onDelete={() => handleDelete(pkg)}
        />
      ))}

      <PackageModal
        visible={modalVisible}
        editing={editing}
        onClose={closeModal}
        onCreate={create}
        onUpdate={update}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sectionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionLabel: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: FontSize.eyebrow,
      color: theme.textMuted,
      letterSpacing: 0.18,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: 'rgba(45,107,255,0.35)',
      backgroundColor: 'rgba(45,107,255,0.10)',
    },
    addBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.blue,
    },
    loadingWrap: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      borderRadius: Radius.sm,
      borderWidth: 1,
      backgroundColor: 'rgba(255,92,107,0.08)',
      borderColor: 'rgba(255,92,107,0.25)',
    },
    errorTxt: {
      flex: 1,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    retryTxt: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    emptyCard: {
      borderRadius: Radius.card,
      borderWidth: 1,
      padding: 24,
      alignItems: 'center',
      gap: 8,
    },
    emptyTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
    },
    emptyBody: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
    },
    emptyBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: Colors.white,
    },
  }), [theme]);
}

function useRowStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    row: {
      backgroundColor: theme.cardBg,
      borderRadius: Radius.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
      marginBottom: 8,
    },
    rowInactive: {
      opacity: 0.6,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    rowTitle: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: 15,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    typeChip: {
      backgroundColor: 'rgba(45,107,255,0.12)',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    typeChipTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 9,
      color: Colors.blueHi,
      letterSpacing: 0.6,
    },
    metaTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textMuted,
    },
    priceCol: {
      alignItems: 'flex-end',
      flexShrink: 0,
    },
    price: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: 18,
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    pricePerSess: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: 11,
      color: theme.textMuted,
    },
    desc: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: theme.textSecondary,
      lineHeight: 20,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radius.pill,
      borderWidth: 1,
    },
    activeBadge: {
      backgroundColor: 'rgba(47,217,139,0.10)',
      borderColor: 'rgba(47,217,139,0.30)',
    },
    inactiveBadge: {
      backgroundColor: 'rgba(90,99,121,0.12)',
      borderColor: 'rgba(90,99,121,0.25)',
    },
    statusTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 10,
      letterSpacing: 0.6,
    },
    activeTxt: { color: Colors.positive },
    inactiveTxt: { color: theme.textMuted },
    iconActions: {
      flexDirection: 'row',
      gap: 12,
    },
    iconBtn: {
      padding: 4,
    },
  }), [theme]);
}

function useModalStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
    modal: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: FontFamily.spaceGroteskBold,
      fontSize: FontSize.cardTitle,
    },
    body: {
      paddingHorizontal: Spacing.pagePx,
      paddingTop: 20,
      paddingBottom: 24,
      gap: 14,
    },
    errorBanner: {
      backgroundColor: 'rgba(255,92,107,0.10)',
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(255,92,107,0.30)',
      padding: 12,
    },
    errorTxt: {
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
      color: Colors.negative,
    },
    label: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      marginBottom: -6,
    },
    input: {
      borderRadius: Radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: FontFamily.manropeMedium,
      fontSize: FontSize.label,
    },
    multiline: {
      minHeight: 72,
      textAlignVertical: 'top' as const,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radius.chip,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardBg,
    },
    chipActive: {
      borderColor: Colors.blue,
      backgroundColor: 'rgba(45,107,255,0.15)',
    },
    chipLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
      color: theme.textSecondary,
    },
    chipLabelActive: { color: Colors.blue },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: Radius.sm,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    toggleLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.label,
    },
    toggle: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.border,
      padding: 2,
      justifyContent: 'center',
    },
    toggleOn: {
      backgroundColor: Colors.positive,
    },
    toggleThumb: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.white,
    },
    toggleThumbOn: {
      alignSelf: 'flex-end',
    },
    perSessionRow: {
      backgroundColor: 'rgba(45,224,255,0.06)',
      borderRadius: Radius.sm,
      borderWidth: 1,
      borderColor: 'rgba(45,224,255,0.15)',
      padding: 10,
      alignItems: 'center',
    },
    perSessionTxt: {
      fontFamily: FontFamily.jetbrainsMonoSemiBold,
      fontSize: 12,
      color: Colors.cyan,
      letterSpacing: 0.3,
    },
    footer: {
      paddingHorizontal: Spacing.pagePx,
      paddingVertical: 14,
      paddingBottom: 32,
      borderTopWidth: 1,
    },
    saveBtn: {
      height: 52,
      backgroundColor: Colors.blue,
      borderRadius: Radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnLabel: {
      fontFamily: FontFamily.manropeSemiBold,
      fontSize: FontSize.body,
      color: Colors.white,
    },
  }), [theme]);
}
