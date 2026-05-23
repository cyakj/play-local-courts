import { useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft, ChevronDown, ChevronRight, Download, Eye, Search,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface HoaDocument {
  id: string;
  hoa_id: string;
  title: string;
  category: string;
  file_name: string | null;
  file_url: string | null;
  file_size_bytes: number | null;
  created_at: string;
}

const CATEGORIES = [
  { key: 'rules_bylaws', label: 'Rules & Bylaws' },
  { key: 'meeting_minutes', label: 'Meeting Minutes' },
  { key: 'financial_statements', label: 'Financial Statements' },
  { key: 'maintenance_records', label: 'Maintenance Records' },
  { key: 'forms_applications', label: 'Forms & Applications' },
];

const FILE_EMOJI: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝',
  xls: '📊', xlsx: '📊', csv: '📊',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️',
};

function getFileEmoji(fileName: string | null): string {
  if (!fileName) return '📄';
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return FILE_EMOJI[ext] ?? '📄';
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocsScreen() {
  const insets = useSafeAreaInsets();
  const [docs, setDocs] = useState<HoaDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(CATEGORIES.map((c) => c.key)));

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: membership } = await supabase
        .from('hoa_members')
        .select('hoa_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single();

      const hoaId = membership?.hoa_id;
      if (!hoaId) { setLoading(false); return; }

      const { data } = await supabase
        .from('hoa_documents')
        .select('id, hoa_id, title, category, file_name, file_url, file_size_bytes, created_at')
        .eq('hoa_id', hoaId)
        .eq('visibility', 'all_residents')
        .order('created_at', { ascending: false });

      setDocs((data ?? []) as HoaDocument[]);
      setLoading(false);
    }
    load();
  }, []);

  function toggleCat(key: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function openDoc(doc: HoaDocument) {
    if (!doc.file_url) return;
    const canOpen = await Linking.canOpenURL(doc.file_url);
    if (canOpen) Linking.openURL(doc.file_url);
  }

  const filtered = docs.filter(
    (d) => !search || d.title.toLowerCase().includes(search.toLowerCase()),
  );

  const groupedCats = CATEGORIES.map((cat) => ({
    ...cat,
    docs: filtered.filter((d) => d.category === cat.key),
  })).filter((cat) => cat.docs.length > 0);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 24) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={Colors.white} size={20} strokeWidth={1.5} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Community Documents</Text>
          <Text style={styles.headerSub}>{docs.length} document{docs.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Search */}
          <View style={styles.searchRow}>
            <Search color={Colors.textMuted} size={16} strokeWidth={1.5} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search documents…"
              placeholderTextColor={Colors.textPlaceholder}
            />
          </View>

          {loading ? (
            <><CardSkeleton /><CardSkeleton /></>
          ) : filtered.length === 0 ? (
            <EmptyState icon={null} title="No documents" subtitle="Your HOA hasn't uploaded any documents yet." />
          ) : (
            groupedCats.map((cat) => {
              const isExpanded = expandedCats.has(cat.key);
              return (
                <View key={cat.key} style={styles.catSection}>
                  {/* Category header */}
                  <TouchableOpacity style={styles.catHeader} onPress={() => toggleCat(cat.key)}>
                    <View style={styles.catAccentBar} />
                    <Text style={styles.catLabel}>{cat.label}</Text>
                    <View style={styles.catCountPill}>
                      <Text style={styles.catCountText}>{cat.docs.length}</Text>
                    </View>
                    {isExpanded
                      ? <ChevronDown color={Colors.textMuted} size={16} strokeWidth={1.5} />
                      : <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.5} />}
                  </TouchableOpacity>

                  {/* Document rows */}
                  {isExpanded && cat.docs.map((doc) => (
                    <TouchableOpacity key={doc.id} style={styles.docRow} onPress={() => openDoc(doc)} activeOpacity={0.7}>
                      {/* File type icon */}
                      <View style={styles.fileIconBox}>
                        <Text style={styles.fileIconEmoji}>{getFileEmoji(doc.file_name)}</Text>
                      </View>

                      {/* Title + meta */}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle} numberOfLines={2}>{doc.title}</Text>
                        <Text style={styles.docMeta}>
                          {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {doc.file_size_bytes ? ` · ${formatBytes(doc.file_size_bytes)}` : ''}
                        </Text>
                      </View>

                      {/* Open + Download buttons */}
                      <TouchableOpacity
                        style={styles.docActionBtn}
                        onPress={() => openDoc(doc)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                        <Eye color={Colors.accentCyan} size={16} strokeWidth={1.5} />
                      </TouchableOpacity>
                      {doc.file_url && (
                        <TouchableOpacity
                          style={[styles.docActionBtn, styles.docDownloadBtn]}
                          onPress={() => openDoc(doc)}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                          <Download color={Colors.accentCyan} size={16} strokeWidth={1.5} />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  header: {
    backgroundColor: Colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.pagePx,
    paddingBottom: 16,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.manropeExtraBold, fontSize: 18, color: Colors.white },
  headerSub: { fontFamily: FontFamily.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  content: { padding: Spacing.pagePx, paddingBottom: 80 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    marginBottom: 20,
    ...Shadow,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },

  catSection: {
    backgroundColor: Colors.white,
    borderRadius: Radius.card,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  catAccentBar: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.accentCyan, flexShrink: 0 },
  catLabel: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
  },
  catCountPill: {
    backgroundColor: Colors.pageBg,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  catCountText: { fontFamily: FontFamily.interSemiBold, fontSize: 11, color: Colors.textMuted },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E0F7FA',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  fileIconEmoji: { fontSize: 18 },
  docTitle: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.uiLabel,
    color: Colors.textPrimary,
  },
  docMeta: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    marginTop: 2,
  },
  docActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docDownloadBtn: { backgroundColor: '#E0F7FA' },
});
