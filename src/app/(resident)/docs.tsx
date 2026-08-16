import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChevronDown, ChevronRight, Download, Eye, Search,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useCommunityName } from '@/hooks/useCommunityName';

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

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

export default function DocsScreen() {
  const communityName = useCommunityName();
  const [docs, setDocs] = useState<HoaDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(CATEGORIES.map((c) => c.key)),
  );

  useEffect(() => {
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
      } catch {
        setLoading(false);
      }
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
    (d) => !search
      || d.title.toLowerCase().includes(search.toLowerCase())
      || d.category.toLowerCase().includes(search.toLowerCase()),
  );

  const groupedCats = CATEGORIES.map((cat) => ({
    ...cat,
    docs: filtered.filter((d) => d.category === cat.key),
  })).filter((cat) => cat.docs.length > 0);

  return (
    <View style={styles.screen}>

      <Header variant="resident" communityName={communityName} />

      {/* ── Hero title ──────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>DOCUMENTS</Text>
        <Text testID="docs-heading" style={styles.heroTitle}>Community Documents</Text>
        <Text testID="doc-count" style={styles.heroSub}>
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Search */}
          <View style={styles.searchRow}>
            <Search color={Colors.textMuted} size={16} strokeWidth={1.5} />
            <TextInput
              testID="search-input"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search documents…"
              placeholderTextColor={Colors.textPlaceholder}
            />
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={Colors.accentCyan} size="large" />
            </View>
          ) : filtered.length === 0 ? (
            <View testID="docs-empty" style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No documents</Text>
              <Text style={styles.emptySubtitle}>
                Your HOA hasn't uploaded any documents yet.
              </Text>
            </View>
          ) : (
            groupedCats.map((cat) => {
              const newCount = cat.docs.filter((d) => isNew(d.created_at)).length;
              const isExpanded = expandedCats.has(cat.key);
              return (
                <View key={cat.key} testID="category-section" style={styles.catSection}>

                  {/* Category header */}
                  <TouchableOpacity
                    style={styles.catHeader}
                    onPress={() => toggleCat(cat.key)}>
                    <View style={styles.catAccentBar} />
                    <Text testID="category-label" style={styles.catLabel}>{cat.label}</Text>
                    {newCount > 0 ? (
                      <View style={[styles.catCountPill, styles.catNewPill]}>
                        <Text style={styles.catNewText}>{newCount} new</Text>
                      </View>
                    ) : (
                      <View style={styles.catCountPill}>
                        <Text style={styles.catCountText}>{cat.docs.length}</Text>
                      </View>
                    )}
                    {isExpanded
                      ? <ChevronDown color={Colors.textMuted} size={16} strokeWidth={1.5} />
                      : <ChevronRight color={Colors.textMuted} size={16} strokeWidth={1.5} />}
                  </TouchableOpacity>

                  {/* Document rows */}
                  {isExpanded && cat.docs.map((doc) => (
                    <TouchableOpacity
                      key={doc.id}
                      testID="doc-card"
                      style={styles.docRow}
                      onPress={() => openDoc(doc)}
                      activeOpacity={0.7}>

                      {isNew(doc.created_at) && <View style={styles.newDot} />}

                      <View style={styles.fileIconBox}>
                        <Text style={styles.fileIconEmoji}>
                          {getFileEmoji(doc.file_name)}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle} numberOfLines={2}>
                          {doc.title}
                        </Text>
                        <Text style={styles.docMeta}>
                          {new Date(doc.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                          {doc.file_size_bytes
                            ? ` · ${formatBytes(doc.file_size_bytes)}`
                            : ''}
                        </Text>
                      </View>

                      <TouchableOpacity
                        testID="doc-eye-btn"
                        style={styles.docActionBtn}
                        onPress={() => openDoc(doc)}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                        <Eye color={Colors.accentCyan} size={16} strokeWidth={1.5} />
                      </TouchableOpacity>

                      {doc.file_url && (
                        <TouchableOpacity
                          testID="doc-download-btn"
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.pageBg },

  hero: {
    backgroundColor: Colors.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 8,
    paddingBottom: 24,
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

  loadingBox: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.sectionTitle,
    color: Colors.navy,
  },
  emptySubtitle: {
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
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
  catAccentBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: Colors.accentCyan,
    flexShrink: 0,
  },
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
  catCountText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 11,
    color: Colors.textMuted,
  },
  catNewPill: { backgroundColor: Colors.accentCyan },
  catNewText: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: 10,
    color: Colors.white,
    letterSpacing: 0.3,
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  newDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentCyan,
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
