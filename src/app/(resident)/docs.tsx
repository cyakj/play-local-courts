import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle, CheckCircle2, Download, Eye, File as FileIcon, FileImage, FileSpreadsheet,
  FileText, FolderOpen, RefreshCw, Search, X,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
import { useActiveCommunity } from '@/hooks/useActiveCommunity';
import { useTheme } from '@/context/ThemeContext';
import type { ThemeTokens } from '@/constants/theme-tokens';
import {
  DOCUMENT_CATEGORIES,
  categoryLabel,
  failureMessage,
  fileKind,
  formatBytes,
  type FileKind,
} from '@/lib/communityDocuments';
import { downloadDocument, viewDocument } from '@/lib/communityDocumentActions';

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

const KIND_ICON: Record<FileKind, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  sheet: FileSpreadsheet,
  image: FileImage,
  file: FileIcon,
};

type Busy = { id: string; action: 'view' | 'download' } | null;
type Notice = { tone: 'success' | 'error'; title: string; body: string } | null;

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DocsScreen() {
  const { theme } = useTheme();
  const styles = useStyles(theme);
  const { community, loading: communityLoading } = useActiveCommunity();
  const hoaId = community?.hoaId;

  const [docs, setDocs] = useState<HoaDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const load = useCallback(async () => {
    if (!hoaId) return;
    setLoading(true);
    setLoadError(false);
    // Scoped to the active community; RLS additionally limits residents to
    // `all_residents` documents of communities they are an approved member of.
    const { data, error } = await supabase
      .from('hoa_documents')
      .select('id, hoa_id, title, category, file_name, file_url, file_size_bytes, created_at')
      .eq('hoa_id', hoaId)
      .eq('visibility', 'all_residents')
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError(true);
      setDocs([]);
    } else {
      setDocs((data ?? []) as HoaDocument[]);
    }
    setLoading(false);
  }, [hoaId]);

  useEffect(() => {
    if (communityLoading) return;
    if (!hoaId) { setLoading(false); return; }
    load();
  }, [communityLoading, hoaId, load]);

  async function run(doc: HoaDocument, action: 'view' | 'download') {
    if (busy) return;
    setBusy({ id: doc.id, action });
    setNotice(null);
    const result = action === 'view' ? await viewDocument(doc) : await downloadDocument(doc);
    setBusy(null);
    if (!result.ok) {
      const m = failureMessage(result.failure);
      setNotice({ tone: 'error', title: m.title, body: `${doc.title}: ${m.body}` });
    } else if (action === 'download') {
      setNotice({
        tone: 'success',
        title: 'Document ready',
        body: `Use “Save to Files” in the share sheet to keep ${doc.title} on this device.`,
      });
    }
  }

  const presentCategories = useMemo(
    () => DOCUMENT_CATEGORIES.filter((c) => docs.some((d) => d.category === c.key)),
    [docs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (category && d.category !== category) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q)
        || (d.file_name ?? '').toLowerCase().includes(q)
        || categoryLabel(d.category).toLowerCase().includes(q);
    });
  }, [docs, search, category]);

  const grouped = useMemo(() => {
    const keys = [...new Set(filtered.map((d) => d.category))];
    keys.sort((a, b) => {
      const ia = DOCUMENT_CATEGORIES.findIndex((c) => c.key === a);
      const ib = DOCUMENT_CATEGORIES.findIndex((c) => c.key === b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return keys.map((key) => ({ key, label: categoryLabel(key), docs: filtered.filter((d) => d.category === key) }));
  }, [filtered]);

  return (
    <View style={styles.screen}>
      <Header variant="resident" />

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>DOCUMENTS</Text>
        <Text testID="docs-heading" style={styles.heroTitle}>Community Documents</Text>
        <Text testID="doc-count" style={styles.heroSub}>
          {docs.length} document{docs.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          <View style={styles.searchRow}>
            <Search color={theme.textMuted} size={18} strokeWidth={1.75} />
            <TextInput
              testID="search-input"
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search documents"
              placeholderTextColor={theme.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search documents"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                accessibilityLabel="Clear search"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={theme.textMuted} size={18} strokeWidth={1.75} />
              </TouchableOpacity>
            )}
          </View>

          {presentCategories.length > 1 && (
            <View style={styles.chipRow} testID="category-filters">
              {[{ key: null as string | null, label: 'All' }, ...presentCategories].map((c) => {
                const active = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key ?? 'all'}
                    testID={`category-chip-${c.key ?? 'all'}`}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategory(c.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {notice && (
            <View
              testID="doc-notice"
              style={[styles.notice, notice.tone === 'error' ? styles.noticeError : styles.noticeSuccess]}>
              {notice.tone === 'error'
                ? <AlertCircle color={Colors.negative} size={20} strokeWidth={1.75} />
                : <CheckCircle2 color={Colors.positive} size={20} strokeWidth={1.75} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                <Text style={styles.noticeBody}>{notice.body}</Text>
              </View>
              <TouchableOpacity onPress={() => setNotice(null)} accessibilityLabel="Dismiss message"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X color={theme.textSecondary} size={18} strokeWidth={1.75} />
              </TouchableOpacity>
            </View>
          )}

          {loading || communityLoading ? (
            <View testID="docs-loading" style={styles.stateBox}>
              <ActivityIndicator color={theme.cyanOnLight} size="large" />
              <Text style={styles.stateBody}>Loading documents…</Text>
            </View>
          ) : loadError ? (
            <View testID="docs-error" style={styles.stateBox}>
              <AlertCircle color={Colors.negative} size={36} strokeWidth={1.5} />
              <Text style={styles.stateTitle}>Couldn’t load documents</Text>
              <Text style={styles.stateBody}>Check your connection and try again.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={load} accessibilityRole="button">
                <RefreshCw color={theme.cyanOnLight} size={16} strokeWidth={1.75} />
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.length === 0 ? (
            <View testID="docs-empty" style={styles.stateBox}>
              <FolderOpen color={theme.textMuted} size={36} strokeWidth={1.5} />
              <Text style={styles.stateTitle}>
                {docs.length === 0 ? 'No documents yet' : 'No matching documents'}
              </Text>
              <Text style={styles.stateBody}>
                {docs.length === 0
                  ? 'Your community hasn’t shared any documents yet.'
                  : 'Try a different search or category.'}
              </Text>
            </View>
          ) : (
            grouped.map((group) => (
              <View key={group.key} testID="category-section" style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text testID="category-label" style={styles.sectionLabel}>{group.label.toUpperCase()}</Text>
                  <Text style={styles.sectionCount}>{group.docs.length}</Text>
                </View>

                {group.docs.map((doc) => {
                  const { kind, label: typeLabel } = fileKind(doc.file_name);
                  const Icon = KIND_ICON[kind];
                  const size = formatBytes(doc.file_size_bytes);
                  const viewing = busy?.id === doc.id && busy.action === 'view';
                  const downloading = busy?.id === doc.id && busy.action === 'download';
                  const disabled = !!busy;
                  return (
                    <View key={doc.id} testID="doc-card" style={styles.card}>
                      <View style={styles.cardTop}>
                        <View style={styles.fileIconBox}>
                          <Icon color={theme.cyanOnLight} size={22} strokeWidth={1.6} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.docTitle} numberOfLines={2} ellipsizeMode="tail">{doc.title}</Text>
                          <View style={styles.metaRow}>
                            <Text style={styles.typeTag}>{typeLabel}</Text>
                            {!!size && <Text style={styles.docMeta}>{size}</Text>}
                            <Text style={styles.docMeta}>{formatDate(doc.created_at)}</Text>
                            {isNew(doc.created_at) && <Text style={styles.newTag}>NEW</Text>}
                          </View>
                        </View>
                      </View>

                      <View style={styles.actions}>
                        <TouchableOpacity
                          testID="doc-eye-btn"
                          style={[styles.actionBtn, styles.viewBtn, disabled && styles.actionDisabled]}
                          onPress={() => run(doc, 'view')}
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${doc.title}`}>
                          {viewing
                            ? <ActivityIndicator size="small" color={theme.cyanOnLight} />
                            : <Eye color={theme.cyanOnLight} size={18} strokeWidth={1.75} />}
                          <Text style={styles.viewText}>{viewing ? 'Opening…' : 'View'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          testID="doc-download-btn"
                          style={[styles.actionBtn, styles.downloadBtn, disabled && styles.actionDisabled]}
                          onPress={() => run(doc, 'download')}
                          disabled={disabled}
                          accessibilityRole="button"
                          accessibilityLabel={`Download ${doc.title}`}>
                          {downloading
                            ? <ActivityIndicator size="small" color={Colors.white} />
                            : <Download color={Colors.white} size={18} strokeWidth={1.75} />}
                          <Text style={styles.downloadText}>{downloading ? 'Downloading…' : 'Download'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(theme: ThemeTokens) {
  return useMemo(() => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.pageBg },

  hero: {
    backgroundColor: theme.headerBg,
    paddingHorizontal: Spacing.pagePx,
    paddingTop: 12,
    paddingBottom: 24,
  },
  heroLabel: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: Colors.cyan,
    letterSpacing: 2,
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: FontFamily.spaceGroteskBold,
    fontSize: 32,
    color: '#FFFFFF',
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  heroSub: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
  },

  content: { padding: Spacing.pagePx, paddingBottom: 96 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.cardBg,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: theme.textPrimary,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: Radius.chip,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardBg,
  },
  chipActive: { borderColor: theme.selectedBorder, backgroundColor: theme.selectedBg },
  chipText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: theme.textSecondary },
  chipTextActive: { color: theme.cyanOnLight },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  noticeError: { backgroundColor: 'rgba(255,92,107,0.10)', borderColor: 'rgba(255,92,107,0.40)' },
  noticeSuccess: { backgroundColor: 'rgba(47,217,139,0.10)', borderColor: 'rgba(47,217,139,0.40)' },
  noticeTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body, color: theme.textPrimary },
  noticeBody: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: theme.textSecondary, marginTop: 2, lineHeight: 20 },

  stateBox: { alignItems: 'center', paddingVertical: 56, gap: 10 },
  stateTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.cardTitle, color: theme.textPrimary, textAlign: 'center' },
  stateBody: {
    fontFamily: FontFamily.manropeMedium,
    fontSize: FontSize.body,
    color: theme.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: theme.selectedBorder,
  },
  retryText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: theme.cyanOnLight },

  section: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: theme.textMuted,
    letterSpacing: 1.8,
  },
  sectionCount: { fontFamily: FontFamily.jetbrainsMonoSemiBold, fontSize: FontSize.eyebrow, color: theme.textMuted },

  card: {
    backgroundColor: theme.cardBg,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadowCard,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: { fontFamily: FontFamily.manropeBold, fontSize: FontSize.body, color: theme.textPrimary, lineHeight: 22 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, marginTop: 6 },
  typeTag: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: theme.cyanOnLight,
    letterSpacing: 1,
  },
  docMeta: { fontFamily: FontFamily.manropeMedium, fontSize: FontSize.label, color: theme.textMuted },
  newTag: {
    fontFamily: FontFamily.jetbrainsMonoSemiBold,
    fontSize: FontSize.eyebrow,
    color: theme.cyanOnLight,
    letterSpacing: 1,
  },

  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.button,
  },
  actionDisabled: { opacity: 0.55 },
  viewBtn: { borderWidth: 1, borderColor: theme.selectedBorder, backgroundColor: theme.selectedBg },
  viewText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: theme.cyanOnLight },
  downloadBtn: { backgroundColor: Colors.blue },
  downloadText: { fontFamily: FontFamily.manropeSemiBold, fontSize: FontSize.label, color: Colors.white },
}), [theme]);
}
