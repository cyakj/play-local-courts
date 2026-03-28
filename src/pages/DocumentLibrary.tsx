import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveHOA } from '@/contexts/ActiveHOAContext';
import { supabase } from '@/integrations/supabase/client';
import ResidentHeader from '@/components/resident/ResidentHeader';
import { ArrowLeft, Search, Download } from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  'Rules & Bylaws': { icon: '📋', color: '#8B5CF6' },
  'Meeting Minutes': { icon: '📝', color: '#0A1628' },
  'Financial Statements': { icon: '💰', color: '#2DD4BF' },
  'Maintenance Records': { icon: '🔧', color: '#F59E0B' },
  'Forms & Applications': { icon: '📄', color: '#00B4D8' },
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

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  const formatCategory = (key: string) => {
    const map: Record<string, string> = {
      'rules_bylaws': 'Rules & Bylaws',
      'meeting_minutes': 'Meeting Minutes',
      'financial_statements': 'Financial Statements',
      'maintenance_records': 'Maintenance Records',
      'forms_applications': 'Forms & Applications',
    };
    return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const grouped = filtered.reduce((acc, d) => {
    const label = formatCategory(d.category);
    if (!acc[label]) acc[label] = [];
    acc[label].push(d);
    return acc;
  }, {} as Record<string, DocumentItem[]>);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

      <div className="px-4 pt-4">
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
          Object.entries(grouped).map(([category, docs]) => {
            const cfg = CATEGORY_CONFIG[category] || { icon: '📄', color: '#00B4D8' };
            return (
              <div key={category} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-sm" style={{ background: cfg.color }} />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{category}</span>
                </div>
                {docs.map(doc => (
                  <div key={doc.id} className="bg-card rounded-2xl p-4 border border-border mb-2 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'hsl(var(--cyan-light))' }}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{doc.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {doc.file_size_bytes ? ` · ${formatSize(doc.file_size_bytes)}` : ''}
                      </div>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--cyan-light))' }}>
                      <Download className="h-4 w-4 text-primary" />
                    </a>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DocumentLibrary;
