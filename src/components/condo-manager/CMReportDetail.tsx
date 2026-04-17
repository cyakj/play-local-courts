import React, { useState, useEffect, useCallback } from 'react';
import { CMHeader } from './CMHeader';
import { CMStatusPill, CMPriorityBadge } from './CMStatusBadge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getCategoryLabel, cleanDescription, parsePriorityFromDescription } from '@/lib/maintenanceUtils';
import { ArrowLeft, AlertTriangle, Lock, Send, Plus, Camera } from 'lucide-react';
import { format } from 'date-fns';

interface CMReportDetailProps {
  reportId: string;
  onBack: () => void;
}

interface ReportData {
  id: string;
  hoa_id: string;
  amenity_id: string | null;
  category: string;
  description: string;
  photo_url: string | null;
  status: string;
  priority: string | null;
  report_type: string;
  location_text: string | null;
  reporter_id: string;
  created_at: string;
  is_urgent: boolean;
  resolution_notes: string | null;
  closed_at: string | null;
  reporter_name?: string;
  amenity_name?: string;
}

interface ReportNote {
  id: string;
  body: string;
  author_name?: string;
  created_at: string;
}

interface ReportMessage {
  id: string;
  sender_id: string;
  body: string;
  sender_name?: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', bg: '#FEF2F2', color: '#EF4444' },
  { value: 'in_progress', label: 'In Progress', bg: '#FFFBEB', color: '#F59E0B' },
  { value: 'resolved', label: 'Resolved', bg: '#E6FFFA', color: '#00D4FF' },
  { value: 'closed', label: 'Closed', bg: '#F3F4F6', color: '#9CA3AF' },
];

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  low: { label: 'Low', bg: '#F0FDF4', color: '#22C55E' },
  medium: { label: 'Moderate', bg: '#FFFBEB', color: '#F59E0B' },
  moderate: { label: 'Moderate', bg: '#FFFBEB', color: '#F59E0B' },
  high: { label: 'High', bg: '#FEF2F2', color: '#EF4444' },
  urgent: { label: 'Urgent', bg: '#FEF2F2', color: '#EF4444' },
};

export const CMReportDetail: React.FC<CMReportDetailProps> = ({ reportId, onBack }) => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [report, setReport] = useState<ReportData | null>(null);
  const [notes, setNotes] = useState<ReportNote[]>([]);
  const [messages, setMessages] = useState<ReportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [showResolveSheet, setShowResolveSheet] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchReport = useCallback(async () => {
    const { data, error } = await supabase
      .from('maintenance_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !data) { console.error(error); return; }

    const [profileRes, amenityRes] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', data.reporter_id).single(),
      data.amenity_id ? supabase.from('courts').select('name').eq('id', data.amenity_id).single() : { data: null },
    ]);

    setReport({
      ...data,
      is_urgent: (data as any).is_urgent ?? false,
      resolution_notes: (data as any).resolution_notes ?? null,
      closed_at: (data as any).closed_at ?? null,
      reporter_name: profileRes.data?.full_name || 'Unknown',
      amenity_name: amenityRes.data?.name || undefined,
    });
  }, [reportId]);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from('report_notes')
      .select('id, body, author_id, created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      const authorIds = [...new Set(data.map(n => n.author_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
      setNotes(data.map(n => ({ ...n, author_name: profileMap.get(n.author_id) || 'Admin' })));
    } else {
      setNotes([]);
    }
  }, [reportId]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('report_messages')
      .select('id, sender_id, body, created_at')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      const senderIds = [...new Set(data.map(m => m.sender_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', senderIds);
      const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
      setMessages(data.map(m => ({ ...m, sender_name: profileMap.get(m.sender_id) || 'Unknown' })));
    } else {
      setMessages([]);
    }
  }, [reportId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchReport(), fetchNotes(), fetchMessages()]);
      setLoading(false);
    };
    load();
  }, [fetchReport, fetchNotes, fetchMessages]);

  const getReportPrefix = () => {
    const label = report?.report_type === 'location'
      ? `📍 ${report?.location_text || 'your location report'}`
      : (report?.amenity_name || getCategoryLabel(report?.category || ''));
    return `Re: Maintenance Report — ${label}`;
  };

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'resolved') {
      setShowStatusSheet(false);
      setShowResolveSheet(true);
      return;
    }
    setSaving(true);
    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'closed') updates.closed_at = new Date().toISOString();

    const { error } = await supabase.from('maintenance_reports').update(updates).eq('id', reportId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } else {
      toast({ title: 'Status Updated', description: `Report marked as ${newStatus.replace('_', ' ')}` });
      // Send status change message to resident's inbox
      if (report && currentUser) {
        const statusLabel = STATUS_OPTIONS.find(s => s.value === newStatus)?.label || newStatus;
        const statusMsg = `${getReportPrefix()}\n\nStatus updated to: ${statusLabel}`;
        await supabase.from('messages').insert({
          sender_id: currentUser.id,
          receiver_id: report.reporter_id,
          content: statusMsg,
        });
      }
      await fetchReport();
    }
    setSaving(false);
    setShowStatusSheet(false);
  };

  const handleResolve = async () => {
    if (resolutionText.length < 10) return;
    setSaving(true);
    const { error } = await supabase.from('maintenance_reports').update({
      status: 'resolved',
      resolution_notes: resolutionText,
      updated_at: new Date().toISOString(),
    } as any).eq('id', reportId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to resolve report', variant: 'destructive' });
    } else {
      toast({ title: 'Report Resolved', description: 'Resolution notes saved' });
      // DB trigger sends the status change notification automatically.
      // Also send resolution details to both report_messages and the main messages table.
      if (report && currentUser) {
        const resolveMsg = `${getReportPrefix()}\n\n✅ Resolved: ${resolutionText}`;
        await Promise.all([
          supabase.from('report_messages').insert({
            report_id: reportId,
            sender_id: currentUser.id,
            body: resolveMsg,
          }),
          supabase.from('messages').insert({
            sender_id: currentUser.id,
            receiver_id: report.reporter_id,
            content: resolveMsg,
          }),
        ]);
      }
      await fetchReport();
    }
    setSaving(false);
    setShowResolveSheet(false);
    setResolutionText('');
  };

  const handleToggleUrgent = async () => {
    if (!report) return;
    const newUrgent = !report.is_urgent;
    const { error } = await supabase.from('maintenance_reports').update({
      is_urgent: newUrgent,
      updated_at: new Date().toISOString(),
    } as any).eq('id', reportId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update urgent flag', variant: 'destructive' });
    } else {
      if (newUrgent && report) {
        await supabase.from('hoa_notifications').insert({
          user_id: report.reporter_id,
          hoa_id: report.hoa_id,
          type: 'report_status_changed',
          title: 'Report Prioritized',
          body: 'Your report has been marked urgent and is being prioritized',
          metadata: { report_id: reportId },
        });
      }
      await fetchReport();
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !currentUser) return;
    setSaving(true);
    const { error } = await supabase.from('report_notes').insert({
      report_id: reportId,
      author_id: currentUser.id,
      body: newNote.trim(),
      is_internal: true,
    });
    if (error) {
      toast({ title: 'Error', description: 'Failed to add note', variant: 'destructive' });
    } else {
      setNewNote('');
      setShowNoteInput(false);
      await fetchNotes();
    }
    setSaving(false);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !report) return;
    setSaving(true);
    const messageText = newMessage.trim();
    const prefixedMessage = `${getReportPrefix()}\n\n${messageText}`;
    const { error } = await supabase.from('report_messages').insert({
      report_id: reportId,
      sender_id: currentUser.id,
      body: messageText,
    });
    if (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } else {
      // Also insert into the main messages table so resident sees it in their inbox (with report context)
      await Promise.all([
        supabase.from('messages').insert({
          sender_id: currentUser.id,
          receiver_id: report.reporter_id,
          content: prefixedMessage,
        }),
        supabase.from('hoa_notifications').insert({
          user_id: report.reporter_id,
          hoa_id: report.hoa_id,
          type: 'report_message',
          title: 'New message about your report',
          body: messageText.slice(0, 100),
          metadata: { report_id: reportId },
        }),
      ]);
      setNewMessage('');
      await fetchMessages();
    }
    setSaving(false);
  };

  const handleCloseArchive = async () => {
    if (!window.confirm('This will permanently archive the report. Residents will see it as Closed.')) return;
    setSaving(true);
    const { error } = await supabase.from('maintenance_reports').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq('id', reportId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to close report', variant: 'destructive' });
    } else {
      toast({ title: 'Report Closed', description: 'Report has been archived' });
      await fetchReport();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cm-app-bg flex flex-col">
        <CMHeader compact>
          <div className="flex items-center gap-3">
            <button onClick={onBack}><ArrowLeft className="w-5 h-5" /></button>
            <span className="text-lg font-extrabold">Report Detail</span>
          </div>
        </CMHeader>
        <div className="flex-1 flex justify-center items-center">
          <div className="w-8 h-8 border-3 border-cm-cyan/20 border-t-cm-cyan rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-cm-app-bg flex flex-col">
        <CMHeader compact>
          <div className="flex items-center gap-3">
            <button onClick={onBack}><ArrowLeft className="w-5 h-5" /></button>
            <span className="text-lg font-extrabold">Report Detail</span>
          </div>
        </CMHeader>
        <div className="flex-1 flex justify-center items-center text-cm-text-light">Report not found</div>
      </div>
    );
  }

  const severity = parsePriorityFromDescription(report.description);
  const sevConfig = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
  const displayTitle = report.report_type === 'location'
    ? `📍 ${report.location_text || 'Unknown location'}`
    : (report.amenity_name || getCategoryLabel(report.category));
  const currentStatusOpt = STATUS_OPTIONS.find(s => s.value === report.status) || STATUS_OPTIONS[0];

  return (
    <div className="min-h-screen bg-cm-app-bg flex flex-col">
      {/* Header */}
      <CMHeader compact>
        <div className="flex items-center gap-3">
          <button onClick={onBack}><ArrowLeft className="w-5 h-5" /></button>
          <span className="text-lg font-extrabold">Report Detail</span>
        </div>
        <div className="mt-2">
          <div className="text-base font-extrabold">{displayTitle}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15">{getCategoryLabel(report.category)}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/15">
              {report.report_type === 'location' ? 'Location' : 'Amenity'}
            </span>
          </div>
          <div className="text-xs opacity-65 mt-1">
            Submitted by {report.reporter_name} · {format(new Date(report.created_at), 'MMM d, yyyy')}
          </div>
          {report.report_type === 'amenity' && report.amenity_name && (
            <div className="text-xs opacity-80 mt-0.5">Amenity: {report.amenity_name}</div>
          )}
          {report.report_type === 'location' && report.location_text && (
            <div className="text-xs opacity-80 mt-0.5">Location: {report.location_text}</div>
          )}
        </div>
      </CMHeader>

      <div className="flex-1 overflow-y-auto pb-24 px-4 space-y-3 pt-3">
        {/* Status Bar */}
        <div className="bg-white rounded-[14px] p-4 border border-cm-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {report.is_urgent && <span className="text-lg">🚨</span>}
              <span
                className="text-sm font-extrabold px-3 py-1.5 rounded-full"
                style={{ background: currentStatusOpt.bg, color: currentStatusOpt.color }}
              >
                {currentStatusOpt.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleUrgent}
                className={`p-2 rounded-lg border text-sm ${report.is_urgent ? 'bg-red-50 border-red-200 text-red-600' : 'border-cm-border text-cm-text-light'}`}
              >
                <AlertTriangle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowStatusSheet(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ background: 'hsl(var(--cm-cyan))' }}
              >
                Change Status
              </button>
            </div>
          </div>
        </div>

        {/* Report Body */}
        <div className="bg-white rounded-[14px] p-4 border border-cm-border space-y-3">
          <div>
            <div className="text-xs font-bold text-cm-text-light mb-1">Description</div>
            <p className="text-sm text-cm-text">{cleanDescription(report.description)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: sevConfig.bg, color: sevConfig.color }}
            >
              {sevConfig.label} Severity
            </span>
          </div>
          {report.photo_url && (
            <div>
              <div className="text-xs font-bold text-cm-text-light mb-1">Photos</div>
              <img src={report.photo_url} alt="Report photo" className="w-20 h-20 object-cover rounded-lg border" />
            </div>
          )}
          <div className="text-[11px] text-cm-text-light">
            {format(new Date(report.created_at), 'MMM d, yyyy · h:mm a')}
          </div>
        </div>

        {/* Resolution Notes (if resolved) */}
        {report.resolution_notes && (
          <div className="bg-green-50 rounded-[14px] p-4 border border-green-200 space-y-2">
            <div className="text-xs font-bold text-green-700">Resolution Notes</div>
            <p className="text-sm text-green-800">{report.resolution_notes}</p>
          </div>
        )}

        {/* Internal Notes */}
        <div className="bg-white rounded-[14px] p-4 border border-cm-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-cm-text-light" />
              <span className="text-sm font-extrabold text-cm-text">Internal Notes</span>
            </div>
            <span className="text-[11px] text-cm-text-light">Private — not visible to resident</span>
          </div>

          {notes.length === 0 && !showNoteInput && (
            <div className="text-xs text-cm-text-light text-center py-2">No internal notes yet</div>
          )}

          {notes.map(n => (
            <div key={n.id} className="bg-cm-app-bg rounded-lg p-3">
              <p className="text-sm text-cm-text">{n.body}</p>
              <div className="text-[10px] text-cm-text-light mt-1">
                {n.author_name} · {format(new Date(n.created_at), 'MMM d, h:mm a')}
              </div>
            </div>
          ))}

          {showNoteInput ? (
            <div className="space-y-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add an internal note..."
                className="w-full border border-cm-border rounded-lg p-2.5 text-sm resize-none"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowNoteInput(false); setNewNote(''); }} className="px-3 py-1.5 text-xs text-cm-text-light">Cancel</button>
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                  style={{ background: 'hsl(var(--cm-cyan))' }}
                >
                  Save Note
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNoteInput(true)}
              className="flex items-center gap-1.5 text-xs font-bold"
              style={{ color: 'hsl(var(--cm-cyan))' }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Note
            </button>
          )}
        </div>

        {/* Message Resident */}
        <div className="bg-white rounded-[14px] p-4 border border-cm-border space-y-3">
          <div className="text-sm font-extrabold text-cm-text">Message Resident</div>

          {messages.length === 0 && (
            <div className="text-xs text-cm-text-light text-center py-2">No messages yet</div>
          )}

          {messages.map(m => (
            <div key={m.id} className="bg-cm-app-bg rounded-lg p-3">
              <p className="text-sm text-cm-text">{m.body}</p>
              <div className="text-[10px] text-cm-text-light mt-1">
                {m.sender_name} · {format(new Date(m.created_at), 'MMM d, h:mm a')}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${report.reporter_name}...`}
              className="flex-1 border border-cm-border rounded-lg px-3 py-2 text-sm"
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || saving}
              className="p-2 rounded-lg text-white disabled:opacity-50"
              style={{ background: 'hsl(var(--cm-cyan))' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Status Change Bottom Sheet */}
      {showStatusSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowStatusSheet(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8 space-y-1" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-extrabold text-cm-text mb-3">Change Status</div>
            {STATUS_OPTIONS.filter(s => s.value !== 'closed').map(s => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                disabled={saving}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-cm-app-bg transition-colors text-left"
              >
                <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                <span className="text-sm font-bold text-cm-text">{s.label}</span>
                {report.status === s.value && <span className="ml-auto text-[10px] text-cm-text-light">Current</span>}
              </button>
            ))}
            <button onClick={() => setShowStatusSheet(false)} className="w-full mt-3 py-2.5 text-sm text-cm-text-light font-bold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Resolve Bottom Sheet */}
      {showResolveSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowResolveSheet(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-extrabold text-cm-text">Resolve Report</div>
            <textarea
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="What was done to resolve this issue? (min 10 characters)"
              className="w-full border border-cm-border rounded-xl p-3 text-sm resize-none"
              rows={4}
            />
            <button
              onClick={handleResolve}
              disabled={resolutionText.length < 10 || saving}
              className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'hsl(var(--cm-cyan))' }}
            >
              {saving ? 'Saving...' : 'Mark as Resolved'}
            </button>
            <button onClick={() => setShowResolveSheet(false)} className="w-full py-2 text-sm text-cm-text-light font-bold">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
