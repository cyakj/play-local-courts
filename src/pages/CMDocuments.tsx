import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Trash2, Search, Upload, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { CMHeader } from '@/components/condo-manager/CMHeader';
import { useCondoManagerCommunities } from '@/hooks/useCondoManagerData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import InlinePdfViewer from '@/components/documents/InlinePdfViewer';
import { useMyDocumentViews, useAdminDocumentViews } from '@/hooks/useDocumentViews';
import { downloadDocument } from '@/lib/documentUtils';

const CATEGORIES = [
  { key: 'rules_bylaws', label: 'Rules & Bylaws', icon: '📋', color: '#8B5CF6' },
  { key: 'meeting_minutes', label: 'Meeting Minutes', icon: '📝', color: '#0A1628' },
  { key: 'financial_statements', label: 'Financial Statements', icon: '💰', color: '#2DD4BF' },
  { key: 'maintenance_records', label: 'Maintenance Records', icon: '🔧', color: '#F59E0B' },
  { key: 'forms_applications', label: 'Forms & Applications', icon: '📄', color: '#00B4D8' },
];

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', csv: '📊',
  png: '🖼️', jpg: '🖼️', jpeg: '🖼️',
};

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
  const [viewingDoc, setViewingDoc] = useState<Doc | null>(null);
  const [expandedViews, setExpandedViews] = useState<Set<string>>(new Set());

  const docIds = useMemo(() => documents.map(d => d.id), [documents]);
  const { viewedIds, refetch: refetchMyViews } = useMyDocumentViews(currentUser?.id, docIds);
  const { viewCounts, viewDetails, refetch: refetchAdminViews } = useAdminDocumentViews(docIds);

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
    if (!uploadTitle.trim()) { toast.error('Please enter a document title'); return; }
    if (!uploadFile) { toast.error('Please select a file to upload'); return; }
    if (!communityId || !currentUser?.id) {
      toast.error('You must be signed in to upload documents');
      return;
    }

    setUploading(true);

    try {
      const sanitizedFileName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${communityId}/${uploadCategory}/${Date.now()}_${sanitizedFileName}`;

      const { error: storageError } = await supabase.storage
        .from('hoa-documents')
        .upload(filePath, uploadFile, { upsert: false });

      if (storageError) {
        toast.error(storageError.message || 'Failed to upload file');
        return;
      }

      const { data: urlData } = supabase.storage.from('hoa-documents').getPublicUrl(filePath);

      const { error } = await supabase.from('hoa_documents').insert({
        hoa_id: communityId,
        uploaded_by: currentUser.id,
        title: uploadTitle.trim(),
        category: uploadCategory,
        file_url: urlData.publicUrl,
        file_name: uploadFile.name,
        file_size_bytes: uploadFile.size,
        visibility: uploadVisibility,
      });

      if (error) {
        await supabase.storage.from('hoa-documents').remove([filePath]);
        toast.error(error.message || 'Failed to save document');
        return;
      }

      toast.success('Document uploaded');
      setShowUpload(false);
      setUploadTitle('');
      setUploadFile(null);
      fetchDocs();
    } finally {
      setUploading(false);
    }
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

  const toggleViewDetails = (docId: string) => {
    setExpandedViews(prev => {
      const next = new Set(prev);
      next.has(docId) ? next.delete(docId) : next.add(docId);
      return next;
    });
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    return FILE_ICONS[ext] || '📄';
  };

  const filteredDocs = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedDocs = CATEGORIES.map(cat => ({
    ...cat,
    docs: filteredDocs.filter(d => d.category === cat.key),
  }));

  const handleOpenDoc = (doc: Doc) => {
    setViewingDoc(doc);
  };

  const handleViewed = () => {
    refetchMyViews();
    refetchAdminViews();
  };

  if (viewingDoc && currentUser?.id) {
    return (
      <InlinePdfViewer
        document={viewingDoc}
        userId={currentUser.id}
        onClose={() => setViewingDoc(null)}
        onViewed={handleViewed}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <div onClick={() => navigate(`/cm/community/${communityId}`)} className="bg-white/[0.12] rounded-[10px] w-9 h-9 flex items-center justify-center cursor-pointer min-h-[44px]">
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
          groupedDocs.map(cat => {
            const unreadCount = cat.docs.filter(d => !viewedIds.has(d.id)).length;
            return (
              <div key={cat.key} className="mb-4">
                {/* Category header */}
                <div onClick={() => toggleCat(cat.key)} className="flex items-center gap-2 cursor-pointer mb-2">
                  <div className="w-[3px] h-4 rounded-full bg-cm-cyan flex-shrink-0" />
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-xs font-bold text-cm-text-light uppercase tracking-wider flex-1">{cat.label}</span>
                  {unreadCount > 0 ? (
                    <span className="text-[10px] font-bold text-white bg-cm-cyan rounded-full px-2 py-0.5">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="text-[10px] text-cm-text-light bg-cm-app-bg rounded-full px-2 py-0.5 border border-cm-border">
                      {cat.docs.length}
                    </span>
                  )}
                  {expandedCats.has(cat.key) ? <ChevronDown className="h-3.5 w-3.5 text-cm-text-light" /> : <ChevronRight className="h-3.5 w-3.5 text-cm-text-light" />}
                </div>

                {expandedCats.has(cat.key) && cat.docs.map(doc => {
                  const isUnread = !viewedIds.has(doc.id);
                  const vCount = viewCounts[doc.id] || 0;
                  const vDetails = viewDetails[doc.id] || [];
                  const isViewExpanded = expandedViews.has(doc.id);

                  return (
                    <div key={doc.id} className="mb-2">
                      <div
                        className="bg-white rounded-[14px] p-[14px_16px] border border-cm-border flex items-center gap-3 relative cursor-pointer active:bg-cm-app-bg transition-colors"
                        onClick={() => handleOpenDoc(doc)}
                      >
                        {/* Unread dot */}
                        {isUnread && (
                          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-cm-cyan" />
                        )}

                        {/* File type icon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-[#E0F7FA]">
                          {getFileIcon(doc.file_name)}
                        </div>

                        {/* Title + meta */}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-cm-text truncate">{doc.title}</div>
                          <div className="text-[11px] text-cm-text-light">
                            {new Date(doc.created_at).toLocaleDateString()} · {formatSize(doc.file_size_bytes)}
                            {doc.visibility === 'board_only' && <span className="ml-1 text-cm-warning">· Board Only</span>}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="bg-cm-cyan text-white rounded-lg p-2 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0">
                          <Download className="h-4 w-4" />
                        </a>
                        <div onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                          className="bg-cm-danger text-white rounded-lg p-2 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </div>
                      </div>

                      {/* View tracking row */}
                      <div
                        className="flex items-center gap-1.5 px-4 pt-1.5 pb-1 cursor-pointer"
                        onClick={() => toggleViewDetails(doc.id)}
                      >
                        <Eye className="h-3 w-3 text-cm-text-light" />
                        <span className="text-[11px] text-cm-text-light">
                          {vCount} {vCount === 1 ? 'view' : 'views'}
                        </span>
                        {vCount > 0 && (
                          isViewExpanded
                            ? <ChevronDown className="h-3 w-3 text-cm-text-light" />
                            : <ChevronRight className="h-3 w-3 text-cm-text-light" />
                        )}
                      </div>

                      {/* Expanded view details */}
                      {isViewExpanded && vDetails.length > 0 && (
                        <div className="mx-4 mb-1 bg-cm-app-bg rounded-lg border border-cm-border p-2.5">
                          {vDetails.map((v, i) => (
                            <div key={i} className="text-[11px] text-cm-text-light py-0.5">
                              {v.user_id.slice(0, 8)}… · {new Date(v.viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {expandedCats.has(cat.key) && cat.docs.length === 0 && (
                  <div className="text-xs text-cm-text-light pl-8 mb-2">No documents</div>
                )}
              </div>
            );
          })
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
            <label className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-[10px] border-2 border-dashed border-cm-border text-sm font-bold text-cm-text cursor-pointer min-h-[52px] mb-4 hover:border-cm-cyan transition-colors">
              <Upload className="h-5 w-5 text-cm-text-light" />
              {uploadFile ? uploadFile.name : 'Choose File'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
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
