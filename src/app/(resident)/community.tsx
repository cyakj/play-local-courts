import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  AlertTriangle, FileText, Mail, MapPin, Megaphone, Phone,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useTheme } from '@/context/ThemeContext';

interface Announcement { id: string; title: string; body: string; created_at: string | null; }
interface HoaInfo {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CommunityScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const [hoa, setHoa] = useState<HoaInfo | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [docCount, setDocCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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

      const hoaId = membership?.hoa_id;
      if (!hoaId) { setLoading(false); return; }

      const [hoaRes, annRes, docRes] = await Promise.all([
        supabase.from('hoas').select('name, address, phone, email, description').eq('id', hoaId).single(),
        supabase.from('hoa_announcements').select('id, title, body, created_at').eq('hoa_id', hoaId).order('created_at', { ascending: false }).limit(5),
        supabase.from('hoa_documents').select('id', { count: 'exact', head: true }).eq('hoa_id', hoaId).eq('visibility', 'all_residents'),
      ]);

      setHoa(hoaRes.data ?? null);
      setAnnouncements(annRes.data ?? []);
      setDocCount(docRes.count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  const contactRows = useMemo(() => {
    if (!hoa) return [];
    return [
      hoa.address ? { Icon: MapPin, label: hoa.address, onPress: undefined } : null,
      hoa.phone ? { Icon: Phone, label: hoa.phone, onPress: () => Linking.openURL(`tel:${hoa.phone}`) } : null,
      hoa.email ? { Icon: Mail, label: hoa.email, onPress: () => Linking.openURL(`mailto:${hoa.email}`) } : null,
    ].filter(Boolean) as { Icon: typeof MapPin; label: string; onPress?: () => void }[];
  }, [hoa]);

  return (
    <View style={styles.screen}>
      <Header variant="resident" communityName={hoa?.name} />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>COMMUNITY</Text>
        <Text style={styles.heroTitle}>{hoa?.name || 'Your Community'}</Text>
        {hoa?.description ? <Text style={styles.heroSub}>{hoa.description}</Text> : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator size="large" /></View>
          ) : (
            <>
              <View style={styles.sectionHeaderRow}>
                <Megaphone color={theme.textMuted} size={16} strokeWidth={1.5} />
                <Text style={styles.sectionTitle}>Announcements</Text>
              </View>

              {announcements.length === 0 ? (
                <Text style={styles.emptyText}>No announcements yet.</Text>
              ) : announcements.map((a) => (
                <View key={a.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.cardBody} numberOfLines={2}>{a.body}</Text>
                  <Text style={styles.cardTime}>{timeAgo(a.created_at)}</Text>
                </View>
              ))}

              <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/announcements' as any)}>
                <Text style={styles.linkRowLabel}>View all announcements →</Text>
              </TouchableOpacity>

              <View style={[styles.sectionHeaderRow, { marginTop: 24 }]}>
                <FileText color={theme.textMuted} size={16} strokeWidth={1.5} />
                <Text style={styles.sectionTitle}>Documents & Rules</Text>
              </View>
              <TouchableOpacity style={styles.card} onPress={() => router.push('/(resident)/docs' as any)} activeOpacity={0.8}>
                <Text style={styles.cardTitle}>{docCount} document{docCount === 1 ? '' : 's'} available</Text>
                <Text style={styles.cardBody}>Bylaws, meeting minutes, financial statements, and more.</Text>
              </TouchableOpacity>

              {contactRows.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 8 }]}>Contact</Text>
                  {contactRows.map((row, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.contactRow}
                      disabled={!row.onPress}
                      onPress={row.onPress}
                      activeOpacity={row.onPress ? 0.7 : 1}>
                      <row.Icon color={theme.textMuted} size={16} strokeWidth={1.5} />
                      <Text style={styles.contactLabel}>{row.label}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              <TouchableOpacity
                style={[styles.contactRow, { marginTop: contactRows.length > 0 ? 16 : 24 }]}
                onPress={() => router.push('/(resident)/report' as any)}
                activeOpacity={0.7}>
                <AlertTriangle color={theme.textMuted} size={16} strokeWidth={1.5} />
                <Text style={styles.contactLabel}>Report an Issue</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ReturnType<typeof useTheme>['theme']) {
  return useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.pageBg },
    hero: { backgroundColor: theme.headerBg, paddingHorizontal: Spacing.pagePx, paddingTop: 8, paddingBottom: 20 },
    heroLabel: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.metadata, color: theme.selectedBorder, letterSpacing: 2, marginBottom: 4 },
    heroTitle: { fontFamily: FontFamily.spaceGroteskBold, fontSize: 28, color: '#FFFFFF', lineHeight: 32 },
    heroSub: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: 'rgba(255,255,255,0.75)', marginTop: 6 },

    content: { padding: Spacing.pagePx, paddingBottom: 80 },
    loadingBox: { alignItems: 'center', paddingVertical: 60 },

    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionTitle: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.uiLabel, color: theme.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },

    emptyText: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textMuted, marginBottom: 12 },

    card: {
      backgroundColor: theme.cardBg, borderRadius: Radius.card, padding: 16, marginBottom: 10,
      borderWidth: 1, borderColor: theme.border, ...theme.shadowCard,
    },
    cardTitle: { fontFamily: FontFamily.manropeSemiBold, fontSize: 15, color: theme.textPrimary, marginBottom: 4 },
    cardBody: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textSecondary, lineHeight: 20 },
    cardTime: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: 11, color: theme.textMuted, marginTop: 8 },

    linkRow: { alignItems: 'flex-end', marginBottom: 4 },
    linkRowLabel: { fontFamily: FontFamily.manropeSemiBold, fontSize: 13, color: theme.selectedBorder },

    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    contactLabel: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.body, color: theme.textPrimary },
  }), [theme]);
}
