import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { supabase } from '@/integrations/supabase/client';
import ResidentHeader from '@/components/resident/ResidentHeader';
import InlinePdfViewer from '@/components/documents/InlinePdfViewer';
import { useMyDocumentViews } from '@/hooks/useDocumentViews';
import { downloadDocument } from '@/lib/documentUtils';
import { ArrowLeft, Search, Download, Eye, ChevronDown, ChevronRight } from 'lucide-react';

const CATEGORIES = [
  { key: 'rules_bylaws', label: 'Rules & Bylaws', icon: '📋', color: '#8B5CF6' },
  { key: 'meeting_minutes', label: 'Meeting Minutes', icon: '📝', color: '#0A1628' },
  { key: 'financial_statements', label: 'Financial Statements', icon: '💰', color: '#2DD4BF' },
  { key: 'maintenance_records', label: 'Maintenance Records', icon: '🔧', color: '#F59E0B' },
  { key: 'forms_applications', label: 'Forms & Applications', icon: '📄', color: '#00B4D8' },
];

const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  doc: '📝',
  docx: '📝',
  xls: '📊',
  xlsx: '📊',
  csv: '📊',
  png: '🖼️',
  jpg: '🖼️',
  jpeg: '🖼️',
};

interface DocumentItem {
  id: string;
  title: string;
  category: string;
  file_name: string;
  file_url: string;
  file_size_bytes: number | null;
  created_at: string;
}

const DocumentLibrary = () => {
  const { currentUser } = useAuth();
  const { activeHOA } = useActiveHOA();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);

  useEffect(() => {
    const loadDocs = async () => {
      if (!activeHOA?.hoaId) { setLoading(false); return; }
      const { data } = await supabase
        .from('hoa_documents')
        .select('*')
        .eq('hoa_id', activeHOA.hoaId)
        .eq('visibility', 'all_residents')
        .order('created_at', { ascending: false });
      setDocuments(data || []);
      setLoading(false);
    };
    loadDocs();
  }, [activeHOA?.hoaId]);

  const docIds = useMemo(() => documents.map(d => d.id), [documents]);
  const { viewedIds, refetch: refetchViews } = useMyDocumentViews(currentUser?.id, docIds);

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  const formatCategoryLabel = (key: string) => {
    const cat = CATEGORIES.find(c => c.key === key);
    return cat?.label || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const groupedDocs = CATEGORIES.map(cat => ({
    ...cat,
    docs: filtered.filter(d => d.category === cat.key),
  }));

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return FILE_ICONS[ext] || '📄';
  };

  const toggleCat = (key: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleOpenDoc = (doc: DocumentItem) => {
    setViewingDoc(doc);
  };

  if (viewingDoc && currentUser?.id) {
    return (
      <InlinePdfViewer
        document={viewingDoc}
        userId={currentUser.id}
        onClose={() => setViewingDoc(null)}
        onViewed={refetchViews}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <ResidentHeader compact>
        <div className="flex items-center gap-3">
          <Link to="/" className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <ArrowLeft className="h-4 w-4 text-white" />
          </Link>
          <div>
            <div className="text-xl font-extrabold">Community Documents</div>
            <div className="text-xs opacity-65 mt-0.5">{documents.length} documents</div>
          </div>
        </div>
      </ResidentHeader>

      <div className="px-4 pt-3">
        {/* Search */}
        <div className="flex items-center gap-2.5 bg-card rounded-xl px-3.5 py-2.5 border border-border mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📁</div>
            <div className="text-base font-extrabold text-foreground mb-2">No Documents</div>
            <p className="text-sm text-muted-foreground">No community documents available yet.</p>
          </div>
        ) : (
          groupedDocs.map(cat => {
            const unreadCount = cat.docs.filter(d => !viewedIds.has(d.id)).length;
            if (cat.docs.length === 0) return null;
            return (
              <div key={cat.key} className="mb-4">
                {/* Category header */}
                <div
                  onClick={() => toggleCat(cat.key)}
                  className="flex items-center gap-2 mb-2 cursor-pointer"
                >
                  <div className="w-[3px] h-4 rounded-full" style={{ background: '#00B4D8' }} />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex-1">
                    {cat.label}
                  </span>
                  {unreadCount > 0 ? (
                    <span className="text-[10px] font-bold text-white bg-[#00B4D8] rounded-full px-2 py-0.5">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      {cat.docs.length}
                    </span>
                  )}
                  {expandedCats.has(cat.key) ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>

                {/* Document cards */}
                {expandedCats.has(cat.key) && cat.docs.map(doc => {
                  const isUnread = !viewedIds.has(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className="bg-card rounded-[14px] p-[14px_16px] border border-border mb-2 flex items-center gap-3 relative cursor-pointer active:bg-muted/50 transition-colors"
                      onClick={() => handleOpenDoc(doc)}
                    >
                      {/* Unread dot */}
                      {isUnread && (
                        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#00B4D8]" />
                      )}

                      {/* File type icon */}
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-[#E0F7FA]">
                        {getFileIcon(doc.file_name)}
                      </div>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{doc.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {doc.file_size_bytes ? ` · ${formatSize(doc.file_size_bytes)}` : ''}
                        </div>
                      </div>

                      {/* Read + Download buttons */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenDoc(doc); }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/60"
                        title="Read"
                      >
                        <Eye className="h-4 w-4 text-[#00B4D8]" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); downloadDocument(doc.id, doc.file_url, doc.file_name); }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#E0F7FA]"
                        title="Download"
                      >
                        <Download className="h-4 w-4 text-[#00B4D8]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DocumentLibrary;
