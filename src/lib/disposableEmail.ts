// Client-side disposable-email pre-check for a friendly signup error. The
// authoritative block is server-enforced in the handle_new_user trigger
// (migration 087, table public.disposable_email_domains) — this list mirrors
// the common throwaway domains seeded there so the UI can warn before submit.
const DISPOSABLE_DOMAINS = new Set<string>([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'emailondeck.com',
  'spamgourmet.com',
  'tempr.email',
]);

/** True when the email's domain is a known disposable/throwaway provider. */
export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}
