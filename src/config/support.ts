// Help & Support configuration.
//
// Legal documents are NOT written by the app. Set `url` to the approved, publicly hosted
// document once it exists and the Help screen opens it in the in-app browser. While `url`
// is null the app shows an honest "not yet published" screen instead of a broken link.
//
// As of 2026-10-12 https://tenisx.ai/* is a GoDaddy parking page that answers 200 with a
// redirect stub for every path (/faq, /terms, /privacy, /licenses all included), so nothing
// is hosted there yet — see the Help & Support notes in the launch matrix.

export type LegalDocKey = 'terms' | 'privacy';

export interface LegalDocument {
  title: string;
  /** Approved, hosted https URL, or null while unpublished. */
  url: string | null;
  summary: string;
}

export const LEGAL_DOCUMENTS: Record<LegalDocKey, LegalDocument> = {
  terms: {
    title: 'Terms of Service',
    url: null,
    summary: 'The terms that govern your use of TenisX.',
  },
  privacy: {
    title: 'Privacy Policy',
    url: null,
    summary: 'How TenisX collects, uses and protects your information.',
  },
};

// NOTE: tenisx.ai currently has no MX record, so mail to this address cannot be delivered
// until the owner configures a mailbox (or replaces it with a working address here).
export const SUPPORT_EMAIL = 'support@tenisx.ai';
