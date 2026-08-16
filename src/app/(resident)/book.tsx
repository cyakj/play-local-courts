import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Volleyball, WavesLadder, WavesHorizontal, CircleParking,
  Flame, Dumbbell, Building2, LayoutGrid, X,
  Clock, Users, CalendarDays, Timer, CheckCircle2, AlertCircle,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useCommunityName } from '@/hooks/useCommunityName';
import type { Database } from '@/lib/types';

function LoadingCard() {
  return (
    <View style={loadingCardStyle}>
      <ActivityIndicator color={Colors.accentCyan} />
    </View>
  );
}
const loadingCardStyle = {
  backgroundColor: Colors.white, borderRadius: 16, padding: 32, marginBottom: 12,
  alignItems: 'center' as const, borderWidth: 1, borderColor: Colors.border,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Court = Database['public']['Tables']['courts']['Row'];
type AmenityRulesRow = Database['public']['Tables']['amenity_rules']['Row'];

type LucideIcon = React.ComponentType<{ color: string; size: number; strokeWidth: number }>;

interface AmenityIconEntry {
  Icon: LucideIcon;
  color: string;
  bg: string;
}

// ─── Icon + label config ──────────────────────────────────────────────────────

const ICON_CONFIG: Record<string, AmenityIconEntry> = {
  tennis:     { Icon: Volleyball      as LucideIcon, color: '#00D4FF', bg: '#E0F9FF' },
  pickleball: { Icon: Volleyball      as LucideIcon, color: '#10B981', bg: '#ECFDF5' },
  pool:       { Icon: WavesLadder     as LucideIcon, color: '#0369A1', bg: '#DBEAFE' },
  barbecue:   { Icon: Flame           as LucideIcon, color: '#F97066', bg: '#FFF5F5' },
  clubhouse:  { Icon: Building2       as LucideIcon, color: '#0F1F3D', bg: '#F3F4F6' },
  gym:        { Icon: Dumbbell        as LucideIcon, color: '#8892A4', bg: '#F3F4F6' },
  fitness:    { Icon: Dumbbell        as LucideIcon, color: '#8892A4', bg: '#F3F4F6' },
  jacuzzi:    { Icon: WavesHorizontal as LucideIcon, color: '#0369A1', bg: '#DBEAFE' },
  spa:        { Icon: WavesHorizontal as LucideIcon, color: '#0369A1', bg: '#DBEAFE' },
  basketball: { Icon: Volleyball      as LucideIcon, color: '#F97066', bg: '#FFF5F5' },
  parking:    { Icon: CircleParking   as LucideIcon, color: '#8892A4', bg: '#F3F4F6' },
};
const FALLBACK_ENTRY: AmenityIconEntry = {
  Icon: LayoutGrid as LucideIcon, color: '#8892A4', bg: '#F3F4F6',
};

const AMENITY_LABELS: Record<string, string> = {
  tennis: 'TENNIS COURT', pickleball: 'PICKLEBALL', pool: 'POOL', barbecue: 'BBQ AREA',
  clubhouse: 'CLUBHOUSE', gym: 'GYM', fitness: 'GYM', jacuzzi: 'SPA', spa: 'SPA',
  basketball: 'BASKETBALL', parking: 'PARKING',
};

// ─── Filter config ─────────────────────────────────────────────────────────────

const FILTER_GROUPS: Record<string, string[] | null> = {
  all:    null,
  courts: ['tennis', 'pickleball', 'basketball'],
  pools:  ['pool', 'jacuzzi', 'spa'],
  other:  ['barbecue', 'clubhouse', 'gym', 'fitness', 'parking'],
};
const FILTERS = ['all', 'courts', 'pools', 'other'];

// ─── Rules helpers ────────────────────────────────────────────────────────────

function fmtTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 || 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function fmtDuration(mins: number | null): string {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookScreen() {
  const communityName = useCommunityName();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  // Rules modal state
  const [rulesTarget, setRulesTarget] = useState<{ id: string; name: string } | null>(null);
  const [rulesData, setRulesData] = useState<AmenityRulesRow | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);

  async function load() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (!user) { setLoading(false); return; }

      const { data: membership } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .limit(1)
        .single();

      if (membership?.hoa_id) {
        const { data: courtsData } = await supabase
          .from('courts')
          .select('*')
          .eq('hoa_id', membership.hoa_id)
          .order('name');
        setCourts(courtsData ?? []);
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  async function loadRules(amenityId: string) {
    setRulesLoading(true);
    setRulesData(null);
    const { data } = await supabase
      .from('amenity_rules')
      .select('*')
      .eq('amenity_id', amenityId)
      .single();
    setRulesData(data ?? null);
    setRulesLoading(false);
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  useEffect(() => {
    if (rulesTarget) loadRules(rulesTarget.id);
  }, [rulesTarget]);

  const filtered = activeFilter === 'all'
    ? courts
    : courts.filter((c) => FILTER_GROUPS[activeFilter]?.includes(c.court_type));

  return (
    <View style={styles.screen}>
      <Header variant="resident" communityName={communityName} />

      {/* ── Hero title ──────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Book Amenity</Text>
        <Text style={styles.heroSub}>Reserve your spot instantly.</Text>
      </View>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            {FILTERS.map((f) => {
              const active = activeFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  testID={`filter-${f}`}
                  onPress={() => setActiveFilter(f)}
                  style={[styles.filterPill, active && styles.filterPillActive]}>
                  <Text style={[styles.filterPillLabel, active && styles.filterPillLabelActive]}>
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Section label */}
          <Text style={styles.sectionLabel}>AVAILABLE AMENITIES</Text>

          {/* Amenity cards */}
          {loading ? (
            <><LoadingCard /><LoadingCard /></>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No amenities available</Text>
              <Text style={styles.emptySubtitle}>Contact your HOA admin to add amenities.</Text>
            </View>
          ) : (
            filtered.map((court) => {
              const label = AMENITY_LABELS[court.court_type] ?? court.court_type.toUpperCase();
              const { Icon, color: iconColor, bg: iconBg } =
                ICON_CONFIG[court.court_type] ?? FALLBACK_ENTRY;

              return (
                <View key={court.id} testID="amenity-card" style={styles.card}>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                      <Icon color={iconColor} size={24} strokeWidth={1.8} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{court.name}</Text>
                      <Text style={styles.cardType}>{label}</Text>
                    </View>
                    <View style={styles.openBadge} testID="open-now-badge">
                      <Text style={styles.openBadgeText}>Open Now</Text>
                    </View>
                  </View>

                  {/* Action row */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      testID="book-now-btn"
                      style={styles.bookBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/amenity-book',
                          params: {
                            amenityId: court.id,
                            amenityName: court.name,
                            amenityType: court.court_type,
                          },
                        })
                      }
                      activeOpacity={0.8}>
                      <Text style={styles.bookBtnLabel}>Book Now →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="rules-btn"
                      style={styles.rulesBtn}
                      onPress={() => setRulesTarget({ id: court.id, name: court.name })}
                      activeOpacity={0.7}>
                      <Text style={styles.rulesBtnLabel}>Rules</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

        </View>
      </ScrollView>

      {/* ── Rules modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={!!rulesTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setRulesTarget(null)}>
        <View style={styles.rulesOverlay}>
          <TouchableOpacity
            style={styles.rulesBackdrop}
            activeOpacity={1}
            onPress={() => setRulesTarget(null)}
          />
          <View style={styles.rulesSheet} testID="rules-sheet">
            {/* Sheet header */}
            <View style={styles.rulesSheetHandle} />
            <View style={styles.rulesHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rulesTitle} testID="rules-title">
                  {rulesTarget?.name ?? 'Amenity'} Rules
                </Text>
                <Text style={styles.rulesSub}>Usage guidelines &amp; booking policies</Text>
              </View>
              <TouchableOpacity
                testID="rules-close-btn"
                style={styles.rulesCloseBtn}
                onPress={() => setRulesTarget(null)}>
                <X color={Colors.textMuted} size={18} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.rulesBody}
              showsVerticalScrollIndicator={false}>
              {rulesLoading ? (
                <View style={styles.rulesLoadingBox} testID="rules-loading">
                  <ActivityIndicator color={Colors.accentCyan} size="large" />
                </View>
              ) : rulesData ? (
                <View testID="rules-content">
                  {/* Hours */}
                  {(rulesData.booking_start_time || rulesData.booking_end_time) && (
                    <RulesRow
                      icon={<Clock color={Colors.accentCyan} size={16} strokeWidth={2} />}
                      label="Hours"
                      value={`${fmtTime(rulesData.booking_start_time)} – ${fmtTime(rulesData.booking_end_time)}`}
                    />
                  )}

                  {/* Max session duration */}
                  {rulesData.max_duration_minutes && (
                    <RulesRow
                      icon={<Timer color={Colors.accentCyan} size={16} strokeWidth={2} />}
                      label="Max session"
                      value={fmtDuration(rulesData.max_duration_minutes)}
                    />
                  )}

                  {/* Advance booking */}
                  {rulesData.advance_booking_days && (
                    <RulesRow
                      icon={<CalendarDays color={Colors.accentCyan} size={16} strokeWidth={2} />}
                      label="Book ahead"
                      value={`Up to ${rulesData.advance_booking_days} day${rulesData.advance_booking_days > 1 ? 's' : ''} in advance`}
                    />
                  )}

                  {/* Per-day / per-week limits */}
                  {rulesData.max_reservations_per_day && (
                    <RulesRow
                      icon={<CalendarDays color={Colors.accentCyan} size={16} strokeWidth={2} />}
                      label="Daily limit"
                      value={`${rulesData.max_reservations_per_day} reservation${rulesData.max_reservations_per_day > 1 ? 's' : ''} per day`}
                    />
                  )}
                  {rulesData.max_reservations_per_week && (
                    <RulesRow
                      icon={<CalendarDays color={Colors.accentCyan} size={16} strokeWidth={2} />}
                      label="Weekly limit"
                      value={`${rulesData.max_reservations_per_week} reservations per week`}
                    />
                  )}

                  {/* Cancellation */}
                  {rulesData.min_cancellation_hours && (
                    <RulesRow
                      icon={<AlertCircle color='#F97066' size={16} strokeWidth={2} />}
                      label="Cancellation"
                      value={`Cancel at least ${rulesData.min_cancellation_hours}h before`}
                    />
                  )}

                  {/* Guest policy */}
                  {rulesData.allow_guests !== null && (
                    <RulesRow
                      icon={<Users color={Colors.accentCyan} size={16} strokeWidth={2} />}
                      label="Guests"
                      value={rulesData.allow_guests
                        ? `Allowed${rulesData.max_guest_count ? ` (max ${rulesData.max_guest_count})` : ''}`
                        : 'Not allowed'}
                    />
                  )}

                  {/* Special flags */}
                  {rulesData.doubles_only && (
                    <RulesRow
                      icon={<CheckCircle2 color='#10B981' size={16} strokeWidth={2} />}
                      label="Play format"
                      value="Doubles only"
                    />
                  )}
                  {rulesData.singles_only && (
                    <RulesRow
                      icon={<CheckCircle2 color='#10B981' size={16} strokeWidth={2} />}
                      label="Play format"
                      value="Singles only"
                    />
                  )}
                  {rulesData.requires_admin_approval && (
                    <RulesRow
                      icon={<AlertCircle color='#F59E0B' size={16} strokeWidth={2} />}
                      label="Approval"
                      value="Admin approval required"
                    />
                  )}
                  {rulesData.requires_cleanup_agreement && (
                    <RulesRow
                      icon={<CheckCircle2 color='#10B981' size={16} strokeWidth={2} />}
                      label="Cleanup"
                      value="Cleanup required after use"
                    />
                  )}

                  {/* Custom rules free text */}
                  {rulesData.custom_rules ? (
                    <View style={styles.customRulesBlock} testID="custom-rules-text">
                      <Text style={styles.customRulesLabel}>ADDITIONAL RULES</Text>
                      <Text style={styles.customRulesText}>{rulesData.custom_rules}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={styles.rulesEmptyBox} testID="rules-empty">
                  <Text style={styles.rulesEmptyTitle}>No rules configured</Text>
                  <Text style={styles.rulesEmptyText}>
                    Contact your HOA admin for specific usage guidelines.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Rules row sub-component ──────────────────────────────────────────────────

function RulesRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.rulesRow} testID="rules-row">
      <View style={styles.rulesRowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rulesRowLabel}>{label}</Text>
        <Text style={styles.rulesRowValue}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  hero: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 16,
    paddingBottom: 24,
  },
  heroTitle: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 32,
    color: Colors.white,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 8,
    lineHeight: 20,
  },

  body: {
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 20,
    paddingBottom: 120,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingRight: 4,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.chip,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
    minHeight: 40,
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: Colors.navy,
    borderColor: Colors.navy,
  },
  filterPillLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: '#9CA3AF',
  },
  filterPillLabelActive: {
    color: Colors.white,
  },

  sectionLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 16,
    color: Colors.navy,
  },
  cardType: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  openBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    backgroundColor: '#E0F9FF',
  },
  openBadgeText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: '#0369A1',
  },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.manropeBold,
    fontSize: 18,
    color: Colors.navy,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bookBtn: {
    flex: 1,
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.button,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  bookBtnLabel: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: FontSize.uiLabel,
    color: Colors.white,
  },
  rulesBtn: {
    borderRadius: Radius.button,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: Colors.white,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  rulesBtnLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: '#4B5563',
  },

  // ── Rules modal ──────────────────────────────────────────────────────────

  rulesOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  rulesBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  rulesSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  rulesSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  rulesTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 18,
    color: Colors.navy,
  },
  rulesSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rulesCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  rulesBody: {
    padding: 20,
    paddingBottom: 8,
  },
  rulesLoadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  rulesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rulesRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rulesRowLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  rulesRowValue: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 14,
    color: Colors.navy,
  },
  customRulesBlock: {
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  customRulesLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  customRulesText: {
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: Colors.navy,
    lineHeight: 22,
  },
  rulesEmptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  rulesEmptyTitle: {
    fontFamily: FontFamily.manropeExtraBold,
    fontSize: 16,
    color: Colors.navy,
  },
  rulesEmptyText: {
    fontFamily: FontFamily.interRegular,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
