import { Resend } from 'resend';

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail({
  to,
  subject,
  react,
  text,
}: {
  to: string;
  subject: string;
  react?: React.ReactElement;
  text?: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'MixHive <hello@mixhive.app>';
  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY not set; skipping send to', to);
    return { id: 'skipped', skipped: true };
  }
  const resend = new Resend(resendApiKey);
  const result = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    react,
    text,
  });
  return result;
}
