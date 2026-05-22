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
import {
  FileText, ChevronDown, ChevronUp, ExternalLink, Search,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import {
  Colors, FontFamily, FontSize, MaxWidth, Radius, Shadow, Spacing,
} from '@/constants/design';
import { Header } from '@/components/ui/Header';
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

const CATEGORY_LABELS: Record<string, string> = {
  rules_bylaws: 'Rules & Bylaws',
  meeting_minutes: 'Meeting Minutes',
  financial_statements: 'Financial Statements',
  maintenance_records: 'Maintenance Records',
  forms_applications: 'Forms & Applications',
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocsScreen() {
  const [docs, setDocs] = useState<HoaDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: memberships } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      const hoaId = memberships?.hoa_id;
      if (!hoaId) { setLoading(false); return; }

      const { data } = await supabase
        .from('hoa_documents')
        .select('id, hoa_id, title, category, file_name, file_url, file_size_bytes, created_at')
        .eq('hoa_id', hoaId)
        .eq('visibility', 'all_residents')
        .order('created_at', { ascending: false });

      const allDocs = (data ?? []) as HoaDocument[];
      setDocs(allDocs);

      // expand all categories that have docs
      const cats = new Set(allDocs.map((d) => d.category));
      setExpandedCategories(cats);

      setLoading(false);
    }
    load();
  }, []);

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  async function openDoc(doc: HoaDocument) {
    const url = doc.file_url;
    if (!url) return;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) Linking.openURL(url);
  }

  const filtered = docs.filter(
    (d) => !search || d.title.toLowerCase().includes(search.toLowerCase()),
  );

  const categories = Object.keys(CATEGORY_LABELS).filter((cat) =>
    filtered.some((d) => d.category === cat),
  );

  return (
    <View style={styles.screen}>
      <Header variant="inner" title="Documents" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ maxWidth: MaxWidth, width: '100%', alignSelf: 'center' }}>

          {/* Search */}
          <View style={styles.searchRow}>
            <Search color={Colors.textMuted} size={16} strokeWidth={1.5} style={styles.searchIcon} />
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
            categories.map((cat) => {
              const catDocs = filtered.filter((d) => d.category === cat);
              const isExpanded = expandedCategories.has(cat);
              return (
                <View key={cat} style={styles.categorySection}>
                  <TouchableOpacity style={styles.categoryHeader} onPress={() => toggleCategory(cat)}>
                    <Text style={styles.categoryLabel}>{CATEGORY_LABELS[cat] ?? cat}</Text>
                    <View style={styles.categoryRight}>
                      <Text style={styles.categoryCount}>{catDocs.length}</Text>
                      {isExpanded
                        ? <ChevronUp color={Colors.textMuted} size={16} strokeWidth={1.5} />
                        : <ChevronDown color={Colors.textMuted} size={16} strokeWidth={1.5} />
                      }
                    </View>
                  </TouchableOpacity>

                  {isExpanded && catDocs.map((doc) => (
                    <TouchableOpacity key={doc.id} style={styles.docRow} onPress={() => openDoc(doc)}>
                      <FileText color={Colors.navy} size={20} strokeWidth={1.5} style={styles.docIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docTitle} numberOfLines={2}>{doc.title}</Text>
                        <Text style={styles.docMeta}>
                          {doc.file_name ?? ''}
                          {doc.file_size_bytes ? `  ·  ${formatBytes(doc.file_size_bytes)}` : ''}
                        </Text>
                      </View>
                      {doc.file_url && (
                        <ExternalLink color={Colors.textMuted} size={16} strokeWidth={1.5} />
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
  content: { padding: Spacing.pagePx, paddingBottom: 80 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.input,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    marginBottom: 20,
    ...Shadow,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 44,
    fontFamily: FontFamily.interRegular,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  categorySection: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.card,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  categoryLabel: {
    fontFamily: FontFamily.manropeBold,
    fontSize: FontSize.cardTitle,
    color: Colors.navy,
  },
  categoryRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryCount: {
    fontFamily: FontFamily.interSemiBold,
    fontSize: FontSize.metadata,
    color: Colors.textMuted,
    backgroundColor: Colors.pageBg,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  docIcon: { flexShrink: 0 },
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
});
