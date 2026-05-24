import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell, Menu, Activity, Droplet, Flame, Dumbbell, Sparkles, Building2, LayoutGrid,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
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

type LucideIcon = React.ComponentType<{ color: string; size: number; strokeWidth: number }>;

interface AmenityIconEntry {
  Icon: LucideIcon;
  color: string;
  bg: string;
}

// ─── Icon + label config ──────────────────────────────────────────────────────

const ICON_CONFIG: Record<string, AmenityIconEntry> = {
  tennis:     { Icon: Activity  as LucideIcon, color: '#00D4FF', bg: '#E0F9FF' },
  pickleball: { Icon: Activity  as LucideIcon, color: '#00D4FF', bg: '#E0F9FF' },
  pool:       { Icon: Droplet   as LucideIcon, color: '#0369A1', bg: '#E0F9FF' },
  barbecue:   { Icon: Flame     as LucideIcon, color: '#F97066', bg: '#FFF5F5' },
  clubhouse:  { Icon: Building2 as LucideIcon, color: '#0F1F3D', bg: '#F3F4F6' },
  gym:        { Icon: Dumbbell  as LucideIcon, color: '#8892A4', bg: '#F3F4F6' },
  fitness:    { Icon: Dumbbell  as LucideIcon, color: '#8892A4', bg: '#F3F4F6' },
  jacuzzi:    { Icon: Sparkles  as LucideIcon, color: '#0369A1', bg: '#E0F9FF' },
  spa:        { Icon: Sparkles  as LucideIcon, color: '#0369A1', bg: '#E0F9FF' },
  basketball: { Icon: Activity  as LucideIcon, color: '#F97066', bg: '#FFF5F5' },
  parking:    { Icon: LayoutGrid as LucideIcon, color: '#8892A4', bg: '#F3F4F6' },
};
const FALLBACK_ENTRY: AmenityIconEntry = {
  Icon: LayoutGrid as LucideIcon, color: '#8892A4', bg: '#F3F4F6',
};

const AMENITY_LABELS: Record<string, string> = {
  tennis: 'COURT', pickleball: 'COURT', pool: 'POOL', barbecue: 'BBQ AREA',
  clubhouse: 'CLUBHOUSE', gym: 'GYM', fitness: 'GYM', jacuzzi: 'SPA', spa: 'SPA',
  basketball: 'COURT', parking: 'PARKING',
};

// ─── Filter config ─────────────────────────────────────────────────────────────

const FILTER_GROUPS: Record<string, string[] | null> = {
  all:    null,
  courts: ['tennis', 'pickleball', 'basketball'],
  pools:  ['pool', 'jacuzzi', 'spa'],
  other:  ['barbecue', 'clubhouse', 'gym', 'fitness', 'parking'],
};
const FILTERS = ['all', 'courts', 'pools', 'other'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookScreen() {
  const insets = useSafeAreaInsets();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: membership } = await supabase
      .from('hoa_memberships')
      .select('hoa_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
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
  }

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = activeFilter === 'all'
    ? courts
    : courts.filter((c) => FILTER_GROUPS[activeFilter]?.includes(c.court_type));

  return (
    <View style={styles.screen}>

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: Math.max(insets.top, 24) + 12 }]}>
        <View style={styles.heroTopBar}>
          <Image
            source={require('@/assets/images/TenisX_logo-removebg-preview.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <View style={styles.heroIcons}>
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Bell color={Colors.white} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Menu color={Colors.white} size={22} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.heroLabel}>AMENITIES</Text>
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
                <View key={court.id} style={styles.card}>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                      <Icon color={iconColor} size={24} strokeWidth={1.5} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{court.name}</Text>
                      <Text style={styles.cardType}>{label}</Text>
                    </View>
                    <View style={styles.openBadge}>
                      <Text style={styles.openBadgeText}>Open Now</Text>
                    </View>
                  </View>

                  {/* Action row */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
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
                    <TouchableOpacity style={styles.rulesBtn} activeOpacity={0.7}>
                      <Text style={styles.rulesBtnLabel}>Rules</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  // Hero
  hero: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 24,
  },
  heroTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroLogo: {
    height: 48,
    width: 140,
  },
  heroIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.accentCyan,
    letterSpacing: 2.2,
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: FontFamily.manropeBlack,
    fontSize: 32,
    color: Colors.white,
    lineHeight: 36,
  },
  heroSub: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: 'rgba(0,212,255,0.7)',
    marginTop: 6,
  },

  // Body
  body: {
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 20,
    paddingBottom: 120,
  },

  // Filter pills
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingRight: 4,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.pill,
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

  // Section label
  sectionLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Amenity card
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

  // Empty state
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

  // Action buttons
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
});
