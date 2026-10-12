// Pure helpers for Community Documents — no React Native / Supabase imports so
// they can be unit-tested in plain Node (tests/community-documents.spec.ts).

export const DOCUMENTS_BUCKET = 'hoa-documents';

/**
 * `hoa_documents.file_url` holds a *public* object URL
 * (`.../storage/v1/object/public/hoa-documents/<hoaId>/<category>/<file>`), but the
 * `hoa-documents` bucket is private — the public endpoint answers
 * `404 Bucket not found`. The only thing we can trust in that column is the
 * object path after the bucket name, which is what we sign.
 */
export function extractStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;
  const match = fileUrl.match(
    /\/(?:storage\/v1\/)?object\/(?:public|sign|authenticated)\/hoa-documents\/([^?#]+)/,
  );
  if (!match) return null;
  try {
    const path = decodeURIComponent(match[1]).replace(/^\/+/, '');
    // Reject traversal; paths are always `<hoa uuid>/<category>/<file>`.
    if (!path || path.split('/').some((seg) => seg === '..')) return null;
    return path;
  } catch {
    return null;
  }
}

export type DocumentFailure =
  | 'no-file'       // record has no usable storage path
  | 'not-found'     // bucket/object missing, or hidden from this user by RLS
  | 'unauthorized'  // explicitly denied
  | 'expired'       // signed URL or session expired
  | 'network'       // device offline / request failed
  | 'unknown';

interface StorageErrorLike {
  message?: string;
  status?: number | string;
  statusCode?: number | string;
  error?: string;
}

/** Map a Supabase Storage / fetch error to a user-facing failure category. */
export function classifyStorageError(err: StorageErrorLike | null | undefined): DocumentFailure {
  if (!err) return 'unknown';
  const text = `${err.message ?? ''} ${err.error ?? ''}`.toLowerCase();
  const status = Number(err.status ?? err.statusCode ?? 0);

  if (/jwt expired|token.*expired|expired.*token|\bexp\b.*claim|signature has expired|link.*expired/.test(text)) {
    return 'expired';
  }
  if (/bucket not found|nosuchbucket|object not found|nosuchkey|not[_ ]found/.test(text) || status === 404) {
    return 'not-found';
  }
  if (/unauthori[sz]ed|not authori[sz]ed|forbidden|row-level security|permission denied|invalid jwt/.test(text)
    || status === 401 || status === 403) {
    return 'unauthorized';
  }
  if (/network|failed to fetch|fetch failed|timed? ?out|offline|internet/.test(text)) {
    return 'network';
  }
  return 'unknown';
}

export function failureMessage(failure: DocumentFailure): { title: string; body: string } {
  switch (failure) {
    case 'no-file':
      return {
        title: 'No file attached',
        body: 'This document has no file on record. Please contact your community manager.',
      };
    case 'not-found':
      return {
        title: 'Document unavailable',
        body: 'This file could not be found or you may not have access to it. Please contact your community manager.',
      };
    case 'unauthorized':
      return {
        title: 'Access denied',
        body: 'Your account does not have permission to open this document.',
      };
    case 'expired':
      return {
        title: 'Session expired',
        body: 'Your secure link expired. Please try again — if it keeps happening, sign out and back in.',
      };
    case 'network':
      return {
        title: 'Connection problem',
        body: 'Check your internet connection and try again.',
      };
    default:
      return {
        title: 'Something went wrong',
        body: 'We could not open this document. Please try again.',
      };
  }
}

export type FileKind = 'pdf' | 'doc' | 'sheet' | 'image' | 'file';

export function fileKind(fileName: string | null | undefined): { kind: FileKind; label: string } {
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { kind: 'pdf', label: 'PDF' };
  if (ext === 'doc' || ext === 'docx') return { kind: 'doc', label: ext.toUpperCase() };
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return { kind: 'sheet', label: ext.toUpperCase() };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)) return { kind: 'image', label: ext.toUpperCase() };
  return { kind: 'file', label: ext ? ext.toUpperCase() : 'FILE' };
}

/** PDFs and images render in the in-app browser; Office files are handed to the share sheet. */
export function canPreviewInApp(fileName: string | null | undefined): boolean {
  const { kind } = fileKind(fileName);
  return kind === 'pdf' || kind === 'image';
}

export function mimeForFile(fileName: string | null | undefined): string | undefined {
  const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return map[ext];
}

/** Safe local filename: keeps the original name, strips path separators/control chars. */
export function safeFileName(name: string | null | undefined, fallback = 'document'): string {
  const cleaned = (name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DOCUMENT_CATEGORIES = [
  { key: 'rules_bylaws', label: 'Rules & Bylaws' },
  { key: 'meeting_minutes', label: 'Meeting Minutes' },
  { key: 'financial_statements', label: 'Financial Statements' },
  { key: 'maintenance_records', label: 'Maintenance Records' },
  { key: 'forms_applications', label: 'Forms & Applications' },
] as const;

export function categoryLabel(key: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.key === key)?.label
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}
