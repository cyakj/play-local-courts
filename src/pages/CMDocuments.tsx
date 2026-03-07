import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Search, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CATEGORIES = [
  { key: 'rules_bylaws', label: 'Rules & Bylaws', icon: '📋', color: '#8B5CF6' },
  { key: 'meeting_minutes', label: 'Meeting Minutes', icon: '📝', color: '#0A1628' },
  { key: 'financial_statements', label: 'Financial Statements', icon: '💰', color: '#2DD4BF' },
  { key: 'maintenance_records', label: 'Maintenance Records', icon: '🔧', color: '#F59E0B' },
  { key: 'forms_applications', label: 'Forms & Applications', icon: '📄', color: '#00B4D8' },
];

interface Doc {
  id: string;
  title: string;
  category: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  visibility: string;
  created_at: string;
}

const CMDocuments = () => {
  const { id } = useParams();
  const communityId = id;
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { communities } = useCondoManagerCommunities();
  const community = communities.find(c => c.id === communityId);

  const [documents, setDocuments] = useState<Doc[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('rules_bylaws');
  const [uploadVisibility, setUploadVisibility] = useState('all_residents');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchDocs = async () => {
    if (!communityId) return;
    const { data } = await supabase
      .from('hoa_documents')
      .select('*')
      .eq('hoa_id', communityId)
      .order('created_at', { ascending: false });
    setDocuments(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, [communityId]);

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim() || !communityId || !currentUser?.id) return;
    setUploading(true);

    const filePath = `${id}/${uploadCategory}/${Date.now()}_${uploadFile.name}`;
    const { error: storageError } = await supabase.storage
      .from('hoa-documents')
      .upload(filePath, uploadFile);

    if (storageError) {
      toast.error('Failed to upload file');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('hoa-documents').getPublicUrl(filePath);

    const { error } = await supabase.from('hoa_documents').insert({
      hoa_id: id,
      uploaded_by: currentUser.id,
      title: uploadTitle.trim(),
      category: uploadCategory,
      file_url: urlData.publicUrl,
      file_name: uploadFile.name,
      file_size_bytes: uploadFile.size,
      visibility: uploadVisibility,
    });

    if (error) {
      toast.error('Failed to save document');
    } else {
      toast.success('Document uploaded');
      setShowUpload(false);
      setUploadTitle('');
      setUploadFile(null);
      fetchDocs();
    }
    setUploading(false);
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    const { error } = await supabase.from('hoa_documents').delete().eq('id', docId);
    if (error) toast.error('Failed to delete');
    else { toast.success('Document deleted'); fetchDocs(); }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const filteredDocs = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedDocs = CATEGORIES.map(cat => ({
    ...cat,
    docs: filteredDocs.filter(d => d.category === cat.key),
  }));

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <div onClick={() => navigate(`/cm/community/${id}`)} className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-xl font-extrabold">Document Library</div>
            <div className="text-xs opacity-65">{community?.name} · {documents.length} documents</div>
          </div>
          <div onClick={() => setShowUpload(true)} className="bg-cm-navy text-white rounded-[10px] px-3.5 py-2 text-xs font-bold cursor-pointer min-h-[44px] flex items-center">
            ＋ Upload
          </div>
        </div>
      </CMHeader>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b border-cm-border">
        <div className="flex items-center gap-2 bg-cm-app-bg rounded-[10px] px-3 py-2 border border-cm-border">
          <Search className="h-4 w-4 text-cm-text-light" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="flex-1 bg-transparent text-sm outline-none text-cm-text"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-3 border-cm-cyan/20 border-t-cm-cyan rounded-full animate-spin" />
          </div>
        ) : (
          groupedDocs.map(cat => (
            <div key={cat.key} className="mb-3">
              <div onClick={() => toggleCat(cat.key)} className="flex items-center gap-2 cursor-pointer mb-2">
                {expandedCats.has(cat.key) ? <ChevronDown className="h-4 w-4 text-cm-text-light" /> : <ChevronRight className="h-4 w-4 text-cm-text-light" />}
                <span className="text-lg">{cat.icon}</span>
                <span className="text-[13px] font-bold" style={{ color: cat.color }}>{cat.label}</span>
                <span className="text-[11px] text-cm-text-light">({cat.docs.length})</span>
              </div>
              {expandedCats.has(cat.key) && cat.docs.map(doc => (
                <div key={doc.id} className="bg-white rounded-xl p-3 mb-2 border border-cm-border flex items-center gap-3">
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-cm-text truncate">{doc.title}</div>
                    <div className="text-[11px] text-cm-text-light">
                      {new Date(doc.created_at).toLocaleDateString()} · {formatSize(doc.file_size_bytes)}
                      {doc.visibility === 'board_only' && <span className="ml-1 text-cm-warning">· Board Only</span>}
                    </div>
                  </div>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="bg-cm-cyan text-white rounded-lg p-2 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Download className="h-4 w-4" />
                  </a>
                  <div onClick={() => handleDelete(doc.id)}
                    className="bg-cm-danger text-white rounded-lg p-2 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 className="h-4 w-4" />
                  </div>
                </div>
              ))}
              {expandedCats.has(cat.key) && cat.docs.length === 0 && (
                <div className="text-xs text-cm-text-light pl-8 mb-2">No documents</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <div className="text-lg font-extrabold text-cm-navy mb-4">Upload Document</div>
            <input
              value={uploadTitle}
              onChange={e => setUploadTitle(e.target.value)}
              placeholder="Document title"
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3"
            />
            <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3">
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select value={uploadVisibility} onChange={e => setUploadVisibility(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[10px] border border-cm-border text-sm mb-3">
              <option value="all_residents">All Residents</option>
              <option value="board_only">Board Only</option>
            </select>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-sm mb-4"
            />
            <div
              onClick={handleUpload}
              className={`bg-cm-navy text-white rounded-[10px] py-3 text-sm font-bold text-center cursor-pointer w-full min-h-[44px] flex items-center justify-center ${uploading ? 'opacity-50' : ''}`}
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </div>
            <div onClick={() => setShowUpload(false)} className="text-center mt-3 text-sm text-cm-text-light cursor-pointer">
              Cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMDocuments;
