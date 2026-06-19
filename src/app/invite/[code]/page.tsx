'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

function sb() {
  return createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
}

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'redeeming' | 'done' | 'error';

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [label, setLabel] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [gainedXp, setGainedXp] = useState<number | null>(null);

  useEffect(() => {
    if (!code) return;
    async function init() {
      // Check invite validity
      const res = await fetch(`/api/invites/check?code=${encodeURIComponent(code)}`);
      const json = await res.json();
      if (!json.valid) { setStatus('invalid'); return; }
      setLabel(json.label ?? null);

      // Check if already signed in
      const { data: { session } } = await sb().auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        // Check if already a founding member
        const { data: profile } = await sb()
          .from('profiles')
          .select('is_founding_member')
          .eq('id', session.user.id)
          .maybeSingle();
        setAlreadyMember(profile?.is_founding_member ?? false);
      }
      setStatus('valid');
    }
    init().catch(() => setStatus('invalid'));
  }, [code]);

  async function handleRedeem() {
    if (!userId) {
      // Store code in sessionStorage so onboarding can pick it up
      sessionStorage.setItem('pending_invite', code);
      router.push(`/login?next=${encodeURIComponent(`/invite/${code}`)}`);
      return;
    }
    setStatus('redeeming');
    const { data: { session } } = await sb().auth.getSession();
    if (!session) { router.push(`/login?next=/invite/${code}`); return; }

    const res = await fetch('/api/invites/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code }),
    });
    const json = await res.json();
    if (!res.ok) {
      if (json.error === 'already_used') { setAlreadyMember(true); setStatus('done'); return; }
      setErrorMsg(json.error ?? 'Something went wrong');
      setStatus('error');
      return;
    }
    setGainedXp(json.xp ?? null);
    setStatus('done');
  }

  const bg = 'linear-gradient(135deg, #08080a 0%, #0d0d08 100%)';
  const gold = '#f0c040';
  const goldFaint = 'rgba(240,192,64,0.12)';
  const text = { primary: '#f2f0e8', muted: '#9a9880', dim: '#6a6850' };

  if (status === 'loading') {
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: text.muted, fontSize: 14 }}>Checking invite…</div>
      </main>
    );
  }

  if (status === 'invalid') {
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h1 style={{ color: text.primary, fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
            Invite not found
          </h1>
          <p style={{ color: text.muted, fontSize: 14, margin: '0 0 24px' }}>
            This link is invalid, expired, or has already been used up.
          </p>
          <Link href="/" style={{ color: gold, textDecoration: 'none', fontSize: 14 }}>
            Back to MixHive →
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'done') {
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⬡</div>
          <h1 style={{ color: gold, fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>
            {alreadyMember && !gainedXp ? 'Already a Founding Member' : 'Welcome to the Hive'}
          </h1>
          {gainedXp != null && (
            <p style={{ color: text.muted, fontSize: 15, margin: '0 0 24px' }}>
              +500 XP awarded · you are now a <strong style={{ color: gold }}>Founding Member</strong>.
            </p>
          )}
          {alreadyMember && !gainedXp && (
            <p style={{ color: text.muted, fontSize: 15, margin: '0 0 24px' }}>
              You already have Founding Member status.
            </p>
          )}
          <Link
            href="/feed"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              borderRadius: 999,
              background: `linear-gradient(135deg, ${gold}, #ffd84a)`,
              color: '#08080a',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
            }}
          >
            Enter the Hive
          </Link>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ color: text.primary, fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ color: text.muted, fontSize: 14, margin: '0 0 24px' }}>{errorMsg}</p>
          <Link href="/" style={{ color: gold, textDecoration: 'none', fontSize: 14 }}>Back to MixHive →</Link>
        </div>
      </main>
    );
  }

  // status === 'valid' or 'redeeming'
  return (
    <main style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⬡</div>
          <h1 style={{ color: text.primary, fontSize: 28, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            You've been invited
          </h1>
          {label && (
            <p style={{ color: text.muted, fontSize: 13, margin: '0 0 4px' }}>{label}</p>
          )}
          <p style={{ color: text.muted, fontSize: 14, margin: 0 }}>
            Join MixHive — the social platform for DJs, producers & underground culture.
          </p>
        </div>

        {/* Founding member card */}
        <div
          style={{
            background: goldFaint,
            border: `1px solid ${gold}44`,
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 22 }}>⬡</span>
            <span style={{ color: gold, fontWeight: 700, fontSize: 15 }}>Founding Member</span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', color: text.muted, fontSize: 13, lineHeight: 1.7 }}>
            <li><strong style={{ color: text.primary }}>+500 XP</strong> on sign-up — instant head start on the leaderboard</li>
            <li>Permanent <strong style={{ color: gold }}>⬡ Founding Member</strong> badge on your profile</li>
            <li>Early access to features before public launch</li>
          </ul>
        </div>

        {/* CTA */}
        {alreadyMember ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: text.muted, fontSize: 13, marginBottom: 16 }}>
              You already have Founding Member status.
            </p>
            <Link href="/feed" style={{ color: gold, textDecoration: 'none', fontSize: 14 }}>
              Go to your feed →
            </Link>
          </div>
        ) : (
          <button
            onClick={handleRedeem}
            disabled={status === 'redeeming'}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 999,
              background: status === 'redeeming'
                ? 'rgba(240,192,64,0.4)'
                : `linear-gradient(135deg, ${gold}, #ffd84a)`,
              color: '#08080a',
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              cursor: status === 'redeeming' ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            {status === 'redeeming'
              ? 'Claiming…'
              : userId
                ? 'Claim founding member status'
                : 'Sign up & claim your spot'}
          </button>
        )}

        <p style={{ textAlign: 'center', color: text.dim, fontSize: 12, marginTop: 16 }}>
          {userId ? '' : 'Already have an account? '}
          {!userId && (
            <button
              onClick={() => {
                sessionStorage.setItem('pending_invite', code);
                router.push(`/login?next=${encodeURIComponent(`/invite/${code}`)}`);
              }}
              style={{ background: 'none', border: 'none', color: gold, cursor: 'pointer', fontSize: 12, padding: 0 }}
            >
              Sign in first →
            </button>
          )}
        </p>
      </div>
    </main>
  );
}
