import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus, Droplet, Zap, Building2, Wrench, AlertTriangle,
  HelpCircle, ChevronRight, X, Camera, ImageIcon, ArrowLeft,
  Grid3x3, Minus, DoorOpen, Trash2, Package,
  Dumbbell, Thermometer, Tv, Shield, Waves, Layers, Sparkles,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'plumbing',            label: 'Water & Plumbing',       Icon: Droplet },
  { key: 'electrical',          label: 'Lighting & Electrical',  Icon: Zap },
  { key: 'structural',          label: 'Buildings & Structures', Icon: Building2 },
  { key: 'grounds',             label: 'Grounds',                Icon: Layers },
  { key: 'equipment',           label: 'Equipment',              Icon: Wrench },
  { key: 'safety',              label: 'Safety',                 Icon: Shield },
  { key: 'other',               label: 'Other',                  Icon: HelpCircle },
] as const;
// Facility-specific categories — selected by court_type param
const TENNIS_CATEGORIES = [
  { key: 'surface',     label: 'Surface',      Icon: Grid3x3 },
  { key: 'net',         label: 'Net',          Icon: Minus },
  { key: 'lighting',    label: 'Lighting',     Icon: Zap },
  { key: 'fence_gate',  label: 'Fence / Gate', Icon: DoorOpen },
  { key: 'cleanliness', label: 'Cleanliness',  Icon: Sparkles },
  { key: 'equipment',   label: 'Equipment',    Icon: Package },
  { key: 'other',       label: 'Other',        Icon: HelpCircle },
] as const;

const POOL_CATEGORIES = [
  { key: 'water_quality', label: 'Water Quality', Icon: Waves },
  { key: 'deck_area',     label: 'Deck Area',     Icon: Layers },
  { key: 'furniture',     label: 'Furniture',     Icon: Package },
  { key: 'equipment',     label: 'Equipment',     Icon: Wrench },
  { key: 'safety',        label: 'Safety',        Icon: Shield },
  { key: 'cleanliness',   label: 'Cleanliness',   Icon: Sparkles },
  { key: 'other',         label: 'Other',         Icon: HelpCircle },
] as const;

const GYM_CATEGORIES = [
  { key: 'equipment',       label: 'Equipment',       Icon: Dumbbell },
  { key: 'climate_control', label: 'Climate Control', Icon: Thermometer },
  { key: 'cleanliness',     label: 'Cleanliness',     Icon: Sparkles },
  { key: 'safety',          label: 'Safety',          Icon: Shield },
  { key: 'tv_audio',        label: 'TV / Audio',      Icon: Tv },
  { key: 'other',           label: 'Other',           Icon: HelpCircle },
] as const;

const GENERAL_AMENITY_CATEGORIES = [
  { key: 'cleanliness', label: 'Cleanliness', Icon: Sparkles },
  { key: 'equipment',   label: 'Equipment',   Icon: Wrench },
  { key: 'access',      label: 'Access',       Icon: DoorOpen },
  { key: 'safety',      label: 'Safety',       Icon: Shield },
  { key: 'lighting',    label: 'Lighting',     Icon: Zap },
  { key: 'other',       label: 'Other',        Icon: HelpCircle },
] as const;

type FacilityCategories = typeof TENNIS_CATEGORIES | typeof POOL_CATEGORIES | typeof GYM_CATEGORIES | typeof GENERAL_AMENITY_CATEGORIES | typeof CATEGORIES;

function getCategoriesForFacilityType(facilityType: string | null): FacilityCategories {
  const t = (facilityType ?? '').toLowerCase();
  if (['tennis', 'pickleball', 'basketball'].includes(t)) return TENNIS_CATEGORIES;
  if (t === 'pool') return POOL_CATEGORIES;
  if (t === 'gym') return GYM_CATEGORIES;
  return GENERAL_AMENITY_CATEGORIES;
}

const SEVERITY_LEVELS = [
  { key: 'low',      label: 'Low',      color: '#10B981' },
  { key: 'medium',   label: 'Medium',   color: '#F59E0B' },
  { key: 'high',     label: 'High',     color: '#F97066' },
  { key: 'critical', label: 'Critical', color: '#EF4444' },
] as const;
type SeverityKey = (typeof SEVERITY_LEVELS)[number]['key'];

function getCategoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.key === cat)?.label
    ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

function getStatusLabel(status: string): string {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'resolved' || status === 'completed') return 'Resolved';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Report {
  id: string;
  category: string;
  description: string;
  status: string;
  priority: string | null;
  photo_url: string | null;
  created_at: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  // Facility pre-fill params (when navigated from court/amenity card)
  const params = useLocalSearchParams<{ courtId?: string; courtName?: string; facilityType?: string; returnTo?: string }>();
  const returnTo = params.returnTo ?? null;
  const prefilledCourtId = params.courtId ?? null;
  const prefilledCourtName = params.courtName ?? null;
  const prefilledFacilityType = params.facilityType ?? null;
  const isCourtReport = !!prefilledCourtId;
  const facilityCategories = getCategoriesForFacilityType(prefilledFacilityType);

  const [userId, setUserId] = useState('');
  const [hoaId, setHoaId] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all' | 'resolved'>('active');

  // Form state
  const [showForm, setShowForm] = useState(isCourtReport);
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<string>(isCourtReport ? facilityCategories[0].key : 'plumbing');
  const [severity, setSeverity] = useState<SeverityKey>('medium');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Web file input ref
  const fileInputRef = useRef<any>(null);

  async function load() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data: membership } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .limit(1)
        .single();

      const hId = membership?.hoa_id ?? '';
      setHoaId(hId);

      if (hId) {
        const { data } = await supabase
          .from('maintenance_reports')
          .select('id, category, description, status, priority, photo_url, created_at')
          .eq('reporter_id', user.id)
          .eq('hoa_id', hId)
          .order('created_at', { ascending: false });
        setReports(data ?? []);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => {
    load();
    if (prefilledCourtId) {
      const cats = getCategoriesForFacilityType(prefilledFacilityType);
      setShowForm(true);
      setStep(1);
      setCategory(cats[0].key);
      setSeverity('medium');
      setDescription('');
      setPhotoUri(null);
      setSubmitSuccess(false);
      setSubmitError(null);
      setSubmitting(false);
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        (fileInputRef.current as any).__file = undefined;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledCourtId, prefilledFacilityType]));

  const activeReports = reports.filter((r) => ['open', 'in_progress', 'accepted', 'reopened'].includes(r.status));
  const resolvedReports = reports.filter((r) => ['resolved', 'completed', 'closed'].includes(r.status));
  const filteredReports = filter === 'active' ? activeReports
    : filter === 'resolved' ? resolvedReports
    : reports;

  // ─── Photo picker ───────────────────────────────────────────────────────────

  async function pickPhoto(source: 'gallery' | 'camera' = 'gallery') {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setSubmitError('Camera permission is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setSubmitError('Photo library permission is required to attach a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
  }

  function handleWebFileChange(e: any) {
    const file: File = e.target?.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUri(url);
    // store the File object for upload
    (fileInputRef.current as any).__file = file;
  }

  async function uploadPhoto(reportId: string): Promise<string | null> {
    if (!photoUri) return null;
    setUploading(true);
    try {
      const ext = 'jpg';
      const path = `${userId}/${reportId}.${ext}`;

      if (Platform.OS === 'web') {
        // On web, use the File object stored from file input
        const file: File | undefined = (fileInputRef.current as any)?.__file;
        if (!file) return null;
        const { error } = await supabase.storage
          .from('report-photos')
          .upload(path, file, { upsert: true, contentType: file.type });
        if (error) { setSubmitError('Photo upload failed: ' + error.message); return null; }
      } else {
        const resp = await fetch(photoUri);
        const blob = await resp.blob();
        const { error } = await supabase.storage
          .from('report-photos')
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
        if (error) { setSubmitError('Photo upload failed: ' + error.message); return null; }
      }

      const { data } = supabase.storage.from('report-photos').getPublicUrl(path);
      return data.publicUrl;
    } catch (e: any) {
      setSubmitError('Photo upload failed: ' + (e?.message ?? 'Unknown error'));
      return null;
    } finally {
      setUploading(false);
    }
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!description.trim() || !userId || !hoaId) return;
    setSubmitting(true);
    setSubmitError(null);

    // Insert report first to get the ID
    const { data: inserted, error } = await supabase.from('maintenance_reports').insert({
      category,
      description: description.trim(),
      hoa_id: hoaId,
      reporter_id: userId,
      status: 'open',
      priority: severity,
      report_type: 'maintenance',
      is_urgent: severity === 'high' || severity === 'critical',
      // Pre-fill court context when reported from a court card
      ...(prefilledCourtId ? { amenity_id: prefilledCourtId } : {}),
      ...(prefilledCourtName ? { location_text: prefilledCourtName } : {}),
    }).select('id').single();

    if (error || !inserted) {
      setSubmitError(error?.message ?? 'Submission failed.');
      setSubmitting(false);
      return;
    }

    // Upload photo if selected, then update record
    if (photoUri) {
      const photoUrl = await uploadPhoto(inserted.id);
      if (photoUrl) {
        await supabase.from('maintenance_reports')
          .update({ photo_url: photoUrl })
          .eq('id', inserted.id);
      }
    }

    setSubmitSuccess(true);
    await load();
    setTimeout(() => {
      if (isCourtReport) {
        goBack();
      } else {
        setShowForm(false);
        resetForm();
      }
    }, 1500);
  }

  function resetForm() {
    setStep(1);
    setCategory(isCourtReport ? facilityCategories[0].key : 'plumbing');
    setSeverity('medium');
    setDescription('');
    setPhotoUri(null);
    setSubmitSuccess(false);
    setSubmitError(null);
    setSubmitting(false);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      (fileInputRef.current as any).__file = undefined;
    }
  }

  function openForm() {
    resetForm();
    setShowForm(true);
  }

  function goBack() {
    if (returnTo) {
      router.replace(returnTo as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(resident)/courts');
    }
  }

  function closeForm() {
    if (isCourtReport) {
      goBack();
    } else {
      setShowForm(false);
      resetForm();
    }
  }

  const FILTER_TABS = [
    { key: 'active',   label: 'Active',   count: activeReports.length },
    { key: 'all',      label: 'All',      count: reports.length },
    { key: 'resolved', label: 'Resolved', count: resolvedReports.length },
  ] as const;

  const isActive = (status: string) => ['open', 'in_progress', 'accepted', 'reopened'].includes(status);

  // ── Facility issue: clean form-only screen (no reports list behind it) ──
  if (isCourtReport) {
    return (
      <View style={styles.screen}>
        {/* Inner header — back + facility name */}
        <View testID="court-issue-header" style={styles.courtIssueHeader}>
          <TouchableOpacity onPress={closeForm} style={styles.courtIssueBackBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft color={Colors.white} size={22} strokeWidth={1.5} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>REPORT ISSUE</Text>
            <Text style={styles.heroTitle}>{prefilledCourtName ?? 'Facility'}</Text>
          </View>
        </View>

        {/* Form rendered directly as main content */}
        {submitSuccess ? (
          <View testID="submit-success" style={styles.successBox}>
            <Text style={styles.successText}>✓ Report submitted!</Text>
            <Text style={styles.successSub}>Your issue has been reported.</Text>
          </View>
        ) : step === 1 ? (
          <ScrollView contentContainerStyle={[styles.formBody, { paddingTop: 24 }]} keyboardShouldPersistTaps="handled">
            <View testID="form-progress" style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '50%' }]} />
            </View>
            <Text style={[styles.stepIndicator, { marginHorizontal: 0, marginBottom: 20 }]}>Step 1 of 2</Text>

            <Text style={styles.formSectionLabel}>SELECT CATEGORY</Text>
            <View testID="category-grid" style={styles.categoryGrid}>
              {facilityCategories.map(({ key, label, Icon }) => {
                const sel = category === key;
                return (
                  <TouchableOpacity key={key} testID="category-tile"
                    onPress={() => setCategory(key)}
                    style={[styles.categoryTile, sel && styles.categoryTileActive]}
                    activeOpacity={0.8}>
                    <Icon color={sel ? Colors.white : Colors.fg2} size={22} strokeWidth={1.5} />
                    <Text style={[styles.categoryTileLabel, sel && styles.categoryTileLabelActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.formSectionLabel, { marginTop: 20 }]}>SEVERITY</Text>
            <View testID="severity-selector" style={styles.severityRow}>
              {SEVERITY_LEVELS.map(({ key, label, color }) => {
                const sel = severity === key;
                return (
                  <TouchableOpacity key={key} testID={`severity-${key}`}
                    onPress={() => setSeverity(key)}
                    style={[styles.severityBtn, sel && { backgroundColor: color, borderColor: color }]}
                    activeOpacity={0.8}>
                    <Text style={[styles.severityLabel, sel && { color: Colors.white }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity testID="next-step-btn" style={styles.primaryBtn}
              onPress={() => setStep(2)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnLabel}>Next Step →</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.formBody, { paddingTop: 24 }]} keyboardShouldPersistTaps="handled">
            <View testID="form-progress" style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '100%' }]} />
            </View>
            <Text style={[styles.stepIndicator, { marginHorizontal: 0, marginBottom: 20 }]}>Step 2 of 2</Text>

            <Text style={styles.formSectionLabel}>DESCRIPTION</Text>
            <TextInput
              testID="description-input"
              style={styles.descInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue in detail…"
              placeholderTextColor={Colors.fgDisabled}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />

            <Text style={[styles.formSectionLabel, { marginTop: 16 }]}>PHOTO (OPTIONAL)</Text>

            {photoUri ? (
              <View style={styles.photoPreviewWrap} testID="photo-preview">
                <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                <TouchableOpacity testID="remove-photo-btn" style={styles.removePhotoBtn}
                  onPress={() => {
                    setPhotoUri(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                      (fileInputRef.current as any).__file = undefined;
                    }
                  }}>
                  <X color={Colors.white} size={14} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ) : Platform.OS === 'web' ? (
              <TouchableOpacity testID="photo-upload-area" style={styles.photoUpload}
                onPress={() => pickPhoto('gallery')} activeOpacity={0.85}>
                <View style={styles.photoUploadIconWrap}>
                  <Camera color={Colors.cyan} size={30} strokeWidth={1.75} />
                </View>
                <Text style={styles.photoUploadLabel}>Add a Photo</Text>
                <Text style={styles.photoUploadSub}>Tap to upload · JPG, PNG or WEBP</Text>
              </TouchableOpacity>
            ) : (
              <View testID="photo-upload-area" style={styles.photoPickerRow}>
                <TouchableOpacity testID="photo-gallery-btn" style={[styles.photoPickerBtn, { flex: 1 }]}
                  onPress={() => pickPhoto('gallery')} activeOpacity={0.85}>
                  <View style={styles.photoPickerIconWrap}>
                    <ImageIcon color={Colors.cyan} size={24} strokeWidth={1.75} />
                  </View>
                  <Text style={styles.photoUploadLabel}>Gallery</Text>
                  <Text style={styles.photoUploadSub}>Choose existing</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="photo-camera-btn" style={[styles.photoPickerBtn, { flex: 1 }]}
                  onPress={() => pickPhoto('camera')} activeOpacity={0.85}>
                  <View style={styles.photoPickerIconWrap}>
                    <Camera color={Colors.cyan} size={24} strokeWidth={1.75} />
                  </View>
                  <Text style={styles.photoUploadLabel}>Camera</Text>
                  <Text style={styles.photoUploadSub}>Take a photo</Text>
                </TouchableOpacity>
              </View>
            )}

            {Platform.OS === 'web' && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                data-testid="photo-file-input"
                onChange={handleWebFileChange}
              />
            )}

            {submitError ? (
              <View testID="submit-error" style={styles.errorBox}>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}

            <View style={styles.formBtnRow}>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.secondaryBtn} activeOpacity={0.85}>
                <Text style={styles.secondaryBtnLabel}>← Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="submit-btn"
                style={[styles.submitBtn, (!description.trim() || submitting || uploading) && styles.primaryBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting || uploading || !description.trim()}
                activeOpacity={0.85}>
                <Text style={styles.primaryBtnLabel}>
                  {uploading ? 'Uploading…' : submitting ? 'Submitting…' : 'Submit Report'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header variant="resident" />

      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.heroLabel}>MAINTENANCE</Text>
          <Text style={styles.heroTitle}>{isCourtReport ? `${prefilledCourtName ?? 'Court'}` : 'My Reports'}</Text>
          <Text style={styles.heroSub}>{isCourtReport ? 'Report an issue with this court.' : 'Track and submit maintenance issues in your community.'}</Text>
        </View>
        <TouchableOpacity testID="new-report-btn" style={styles.newReportBtn}
          onPress={openForm} activeOpacity={0.85}>
          <Plus color={Colors.navy} size={22} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* ── Filter tabs ── */}
      <View testID="filter-tabs" style={styles.filterRow}>
        {FILTER_TABS.map(({ key, label, count }) => {
          const active = filter === key;
          return (
            <TouchableOpacity
              key={key}
              testID={`filter-${key}`}
              onPress={() => setFilter(key)}
              style={[styles.filterTab, active && styles.filterTabActive]}>
              <Text style={[styles.filterTabLabel, active && styles.filterTabLabelActive]}>
                {label}
              </Text>
              {!loading && (
                <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Reports list ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>
          {loading ? (
            <View style={styles.loadingBox} />
          ) : filteredReports.length === 0 ? (
            <View testID="reports-empty" style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptySub}>Tap "+" to submit a new maintenance issue.</Text>
            </View>
          ) : (
            filteredReports.map((r) => {
              const catConfig = CATEGORIES.find((c) => c.key === r.category);
              const Icon = catConfig?.Icon ?? AlertTriangle;
              const active = isActive(r.status);
              return (
                <TouchableOpacity
                  key={r.id}
                  testID="report-card"
                  style={styles.reportCard}
                  onPress={() => router.push(`/report-detail/${r.id}` as any)}
                  activeOpacity={0.8}>
                  {/* Left status accent bar */}
                  <View style={[styles.cardAccentBar, { backgroundColor: active ? Colors.accentCyan : '#10B981' }]} />
                  <View style={[styles.reportIconWrap, { backgroundColor: active ? 'rgba(45,224,255,0.12)' : 'rgba(47,217,139,0.12)' }]}>
                    <Icon color={active ? Colors.cyan : Colors.positive} size={20} strokeWidth={1.5} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.reportCategory} numberOfLines={1}>{getCategoryLabel(r.category)}</Text>
                      <View style={[styles.statusPill, {
                        backgroundColor: active ? 'rgba(45,224,255,0.12)' : 'rgba(47,217,139,0.12)',
                        borderWidth: 1,
                        borderColor: active ? 'rgba(45,224,255,0.35)' : 'rgba(47,217,139,0.35)',
                      }]}>
                        <Text style={[styles.statusText, { color: active ? Colors.cyan : Colors.positive }]}>
                          {getStatusLabel(r.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.reportDesc} numberOfLines={2}>{r.description}</Text>
                    <View style={styles.cardBottomRow}>
                      <Text style={styles.reportTime}>{fmtDate(r.created_at)}</Text>
                      <ChevronRight
                        color={Colors.textMuted}
                        size={16}
                        strokeWidth={2.5}
                        testID="report-card-chevron"
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── 2-step form overlay ── */}
      {showForm && (
        <View testID="report-form" style={styles.formOverlay}>
          <TouchableOpacity style={styles.formBackdrop} onPress={closeForm} activeOpacity={1} />
          <View style={styles.formSheet}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>New Report</Text>
              <TouchableOpacity onPress={closeForm} style={styles.formCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color={Colors.textMuted} size={16} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            <View testID="form-progress" style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
            </View>
            <Text style={styles.stepIndicator}>Step {step} of 2</Text>

            {submitSuccess ? (
              <View testID="submit-success" style={styles.successBox}>
                <Text style={styles.successText}>✓ Report submitted!</Text>
                <Text style={styles.successSub}>{isCourtReport ? 'Your issue has been reported.' : 'Your HOA admin has been notified.'}</Text>
              </View>
            ) : step === 1 ? (
              /* ── Step 1: category + severity ── */
              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
                {isCourtReport && prefilledCourtName && (
                  <View testID="court-context-banner" style={styles.courtContextBanner}>
                    <Text style={styles.courtContextText}>Court: {prefilledCourtName}</Text>
                  </View>
                )}
                <Text style={styles.formSectionLabel}>SELECT CATEGORY</Text>
                <View testID="category-grid" style={styles.categoryGrid}>
                  {(isCourtReport ? facilityCategories : CATEGORIES).map(({ key, label, Icon }) => {
                    const sel = category === key;
                    return (
                      <TouchableOpacity key={key} testID="category-tile"
                        onPress={() => setCategory(key)}
                        style={[styles.categoryTile, sel && styles.categoryTileActive]}
                        activeOpacity={0.8}>
                        <Icon color={sel ? Colors.white : Colors.fg2} size={22} strokeWidth={1.5} />
                        <Text style={[styles.categoryTileLabel, sel && styles.categoryTileLabelActive]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.formSectionLabel, { marginTop: 20 }]}>SEVERITY</Text>
                <View testID="severity-selector" style={styles.severityRow}>
                  {SEVERITY_LEVELS.map(({ key, label, color }) => {
                    const sel = severity === key;
                    return (
                      <TouchableOpacity key={key} testID={`severity-${key}`}
                        onPress={() => setSeverity(key)}
                        style={[styles.severityBtn, sel && { backgroundColor: color, borderColor: color }]}
                        activeOpacity={0.8}>
                        <Text style={[styles.severityLabel, sel && { color: Colors.white }]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity testID="next-step-btn" style={styles.primaryBtn}
                  onPress={() => setStep(2)} activeOpacity={0.85}>
                  <Text style={styles.primaryBtnLabel}>Next Step →</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* ── Step 2: description + photo ── */
              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">
                <Text style={styles.formSectionLabel}>DESCRIPTION</Text>
                <TextInput
                  testID="description-input"
                  style={styles.descInput}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the issue in detail…"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />

                <Text style={[styles.formSectionLabel, { marginTop: 16 }]}>PHOTO (OPTIONAL)</Text>

                {photoUri ? (
                  /* Photo preview */
                  <View style={styles.photoPreviewWrap} testID="photo-preview">
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                    <TouchableOpacity testID="remove-photo-btn" style={styles.removePhotoBtn}
                      onPress={() => {
                        setPhotoUri(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                          (fileInputRef.current as any).__file = undefined;
                        }
                      }}>
                      <X color={Colors.white} size={14} strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                ) : Platform.OS === 'web' ? (
                  <TouchableOpacity testID="photo-upload-area" style={styles.photoUpload}
                    onPress={() => pickPhoto('gallery')} activeOpacity={0.85}>
                    <View style={styles.photoUploadIconWrap}>
                      <Camera color={Colors.accentCyan} size={30} strokeWidth={1.75} />
                    </View>
                    <Text style={styles.photoUploadLabel}>Add a Photo</Text>
                    <Text style={styles.photoUploadSub}>Tap to upload · JPG, PNG or WEBP · max 10 MB</Text>
                  </TouchableOpacity>
                ) : (
                  <View testID="photo-upload-area" style={styles.photoPickerRow}>
                    <TouchableOpacity testID="photo-gallery-btn" style={[styles.photoPickerBtn, { flex: 1 }]}
                      onPress={() => pickPhoto('gallery')} activeOpacity={0.85}>
                      <View style={styles.photoPickerIconWrap}>
                        <ImageIcon color={Colors.accentCyan} size={24} strokeWidth={1.75} />
                      </View>
                      <Text style={styles.photoUploadLabel}>Gallery</Text>
                      <Text style={styles.photoUploadSub}>Choose existing</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="photo-camera-btn" style={[styles.photoPickerBtn, { flex: 1 }]}
                      onPress={() => pickPhoto('camera')} activeOpacity={0.85}>
                      <View style={styles.photoPickerIconWrap}>
                        <Camera color={Colors.accentCyan} size={24} strokeWidth={1.75} />
                      </View>
                      <Text style={styles.photoUploadLabel}>Camera</Text>
                      <Text style={styles.photoUploadSub}>Take a new photo</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Hidden file input for web */}
                {Platform.OS === 'web' && (
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    data-testid="photo-file-input"
                    onChange={handleWebFileChange}
                  />
                )}

                {submitError ? (
                  <View testID="submit-error" style={styles.errorBox}>
                    <Text style={styles.errorText}>{submitError}</Text>
                  </View>
                ) : null}

                <View style={styles.formBtnRow}>
                  <TouchableOpacity onPress={() => setStep(1)} style={styles.secondaryBtn} activeOpacity={0.85}>
                    <Text style={styles.secondaryBtnLabel}>← Previous</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="submit-btn"
                    style={[styles.submitBtn, (!description.trim() || submitting || uploading) && styles.primaryBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting || uploading || !description.trim()}
                    activeOpacity={0.85}>
                    <Text style={styles.primaryBtnLabel}>
                      {uploading ? 'Uploading…' : submitting ? 'Submitting…' : 'Submit Report'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function useStyles(t: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.pageBg },

  // Court-issue direct form header
  courtIssueHeader: {
    backgroundColor: t.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 48,
    paddingBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  courtIssueBackBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    flexShrink: 0,
  },

  hero: {
    backgroundColor: t.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 16,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroContent: { flex: 1 },
  heroLabel: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 11,
    color: Colors.cyan,
    letterSpacing: 2.2,
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 32,
    color: Colors.white,    // always white — on dark header bg
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 10,
    lineHeight: 22,
  },
  newReportBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexShrink: 0,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },

  filterRow: {
    flexDirection: 'row',
    backgroundColor: t.pageBg,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
    paddingHorizontal: Spacing.pagePx,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: { borderBottomColor: Colors.accentCyan },
  filterTabLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textMuted,
  },
  filterTabLabelActive: { color: Colors.white, fontFamily: FontFamily.manropeBold },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: t.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeActive: { backgroundColor: Colors.cyan },
  countText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: Colors.fg3 },
  countTextActive: { color: Colors.midnight },

  body: { paddingHorizontal: Spacing.pagePx, paddingTop: 20, paddingBottom: 100 },
  loadingBox: { height: 80, backgroundColor: t.surface2, borderRadius: Radius.card },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: t.textPrimary },
  emptySub: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: t.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  reportCard: {
    backgroundColor: t.cardBg,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: t.border,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 0,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 3,
  },
  cardAccentBar: {
    width: 4,
    borderRadius: 0,
    flexShrink: 0,
  },
  reportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  reportCategory: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: FontSize.cardTitle,
    color: t.textPrimary,
    flex: 1,
    letterSpacing: -0.2,
  },
  reportDesc: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: t.textMuted,
    lineHeight: 22,
  },
  reportTime: {
    fontFamily: FontFamily.interRegular,
    fontSize: 12,
    color: Colors.textMuted,
  },
  statusPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 0,
  },
  statusText: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, letterSpacing: 0.5 },

  formOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  formBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  formSheet: {
    backgroundColor: t.cardBg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: 1,
    borderColor: t.border,
    maxHeight: '90%',
    minHeight: '60%',
    overflow: 'hidden',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  formTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 20, color: t.textPrimary },
  formCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: t.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: t.surface2,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: Colors.accentCyan, borderRadius: 2 },
  stepIndicator: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: 11,
    color: t.textMuted,
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  courtContextBanner: { backgroundColor: 'rgba(45,224,255,0.1)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(45,224,255,0.25)' },
  courtContextText: { fontFamily: FontFamily.interSemiBold, fontSize: 13, color: '#2DE0FF', letterSpacing: 0.5 },
  formBody: { padding: 20, paddingBottom: 36 },
  formSectionLabel: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: t.textMuted,
    letterSpacing: 1.8,
    marginBottom: 12,
  },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryTile: {
    width: '30%',
    height: 92,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  categoryTileActive: { backgroundColor: Colors.blue, borderColor: Colors.cyan },
  categoryTileLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: 11,
    color: t.textSecondary,
    textAlign: 'center',
  },
  categoryTileLabelActive: { color: Colors.white },

  severityRow: { flexDirection: 'row', gap: 8 },
  severityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface2,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  severityLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.fg3 },

  descInput: {
    borderWidth: 1.5,
    borderColor: t.border,
    borderRadius: Radius.card,
    padding: 16,
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: t.textPrimary,
    backgroundColor: t.inputBg,
    minHeight: 120,
  },

  photoPreviewWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  photoPreview: { width: '100%', height: 180, borderRadius: 12 },
  removePhotoBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoUpload: {
    borderWidth: 1,
    borderColor: 'rgba(45,224,255,0.35)',
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(45,224,255,0.05)',
  },
  photoUploadIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(45,224,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(45,224,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  photoPickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoPickerBtn: {
    borderWidth: 1,
    borderColor: 'rgba(45,224,255,0.35)',
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(45,224,255,0.05)',
    gap: 6,
  },
  photoPickerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(45,224,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(45,224,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  photoUploadLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.body,
    color: t.textPrimary,
  },
  photoUploadSub: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.label,
    color: t.textMuted,
    textAlign: 'center',
  },

  backLink: { marginTop: 12, alignItems: 'center' },
  backLinkText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: t.textMuted,
  },

  errorBox: {
    marginTop: 12,
    backgroundColor: 'rgba(255,92,107,0.10)',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: 'rgba(255,92,107,0.35)',
    padding: 12,
  },
  errorText: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.negative,
    textAlign: 'center',
  },

  formBtnRow: { flexDirection: 'row', gap: 10, marginTop: 28 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: t.surface2,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: t.border,
  },
  secondaryBtnLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.fg2 },
  submitBtn: {
    flex: 2,
    backgroundColor: Colors.blue,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: Colors.blue,
    borderRadius: Radius.button,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnLabel: {
    fontFamily: FontFamily.manropeSemiBold,
    fontSize: FontSize.label,
    color: Colors.white,
  },

  successBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 32,
  },
  successText: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 22, color: Colors.positive },
  successSub: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: t.textMuted,
    textAlign: 'center',
  },
  }), [t]);
}
