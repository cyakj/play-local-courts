// Pure validation for the Account screen (V1-009). No React / Supabase.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type EmailCheck = { ok: true; email: string } | { ok: false; message: string };

export function checkNewEmail(input: string, currentEmail: string | null | undefined): EmailCheck {
  const email = input.trim().toLowerCase();
  if (!email) return { ok: false, message: 'Enter your new email address.' };
  if (!EMAIL_RE.test(email)) return { ok: false, message: 'That does not look like a valid email address.' };
  if (currentEmail && email === currentEmail.trim().toLowerCase()) return { ok: false, message: 'That is already your email address.' };
  return { ok: true, email };
}

export type PhoneCheck = { ok: true; phone: string | null } | { ok: false; message: string };

/** Accepts common formats, stores digits with an optional leading +. Empty clears the number. */
export function checkPhone(input: string): PhoneCheck {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, phone: null };
  if (!/^[+()\d\s.-]+$/.test(trimmed)) return { ok: false, message: 'Use digits only (spaces, dashes and a leading + are fine).' };
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return { ok: false, message: 'Enter a valid phone number (7 to 15 digits).' };
  return { ok: true, phone: (trimmed.startsWith('+') ? '+' : '') + digits };
}

export const EMAIL_CHANGE_NOTICE =
  'We sent confirmation links. Your email changes only after you confirm it from the inbox of the new address (and the old one, if your account requires it). Until then you keep signing in with your current email.';

export const PHONE_NOTICE = 'Phone numbers are not verified in this version of the app.';

export const DELETION_NOTICE =
  'Deleting an account also affects your reservation history, HOA membership and records your community must keep. Account deletion is handled as a request: support reviews it with your HOA before anything is removed.';
