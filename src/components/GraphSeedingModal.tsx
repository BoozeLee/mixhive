import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  onSeeded?: (result: { nodesCreated: number; edgesCreated: number }) => void;
}

export function GraphSeedingModal({ onClose, onSeeded }: Props) {
  const t = useTranslations('graphSeedingModal');
  const [activeTab, setActiveTab] = useState<'gig' | 'mix' | 'collab'>('gig');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lastResult, setLastResult] = useState<{
    nodesCreated: number;
    edgesCreated: number;
  } | null>(null);

  // Simple Gig Logger form (MVP)
  const [gigForm, setGigForm] = useState({
    date: new Date().toISOString().split('T')[0],
    venue: '',
    city: '',
    role: 'support',
    notes: '',
  });

  const resetGigForm = () => {
    setGigForm({
      date: new Date().toISOString().split('T')[0],
      venue: '',
      city: '',
      role: 'support',
      notes: '',
    });
    setSubmitError(null);
    setSubmitSuccess(false);
    setLastResult(null);
  };

  const handleSubmitGig = async () => {
    if (!gigForm.venue) {
      setSubmitError('Please enter a venue name');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const isoDate = new Date(gigForm.date).toISOString();

      const payload = {
        date: isoDate,
        venueName: gigForm.venue,
        city: gigForm.city || null,
        role: gigForm.role,
        notes: gigForm.notes || null,
      };

      const res = await fetch('/api/mythic/log-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to log gig (status ${res.status})`);
      }

      const result = await res.json();

      const nodes = result.nodesCreated ?? 2;
      const edges = result.edgesCreated ?? 3;

      setLastResult({ nodesCreated: nodes, edgesCreated: edges });
      setSubmitSuccess(true);
      onSeeded?.(result);

      toast.success(
        `Created ${nodes} nodes and ${edges} edges. This performance is now part of your Mythic legend.`,
        { duration: 5000 }
      );
    } catch (e) {
      console.error('Failed to log gig:', e);
      setSubmitError((e as Error).message || 'Failed to log performance');
      toast.error((e as Error).message || 'Failed to log performance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogAnother = () => {
    resetGigForm();
    // Keep the modal open, ready for the next gig
  };

  const handleDone = () => {
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: radius.lg,
          width: '100%',
          maxWidth: 580,
          padding: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>{t('seedYourMythicGraph')}</h2>
        <p style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
          Log real activity so your agents and quests have data to work with.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 16,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          {(['gig', 'mix', 'collab'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                background: activeTab === tab ? colors.accentMuted : 'transparent',
                color: activeTab === tab ? colors.accent : colors.text.secondary,
                border: 'none',
                borderBottom: activeTab === tab ? `2px solid ${colors.accent}` : 'none',
                cursor: 'pointer',
              }}
            >
              {tab === 'gig' && 'Recent Gig'}
              {tab === 'mix' && 'Mix Release'}
              {tab === 'collab' && 'Collab'}
            </button>
          ))}
        </div>

        {activeTab === 'gig' && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: fontSize.sm, display: 'block', marginBottom: 4 }}>
                {t('date')}
              </label>
              <input
                type="date"
                value={gigForm.date}
                onChange={e => setGigForm({ ...gigForm, date: e.target.value })}
                style={{
                  width: '100%',
                  padding: 8,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.text.primary,
                  borderRadius: 6,
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: fontSize.sm, display: 'block', marginBottom: 4 }}>
                Venue / Event
              </label>
              <input
                value={gigForm.venue}
                onChange={e => setGigForm({ ...gigForm, venue: e.target.value })}
                placeholder={t('fuseKioskRadioEtc')}
                style={{
                  width: '100%',
                  padding: 8,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.text.primary,
                  borderRadius: 6,
                }}
              />
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}
            >
              <div>
                <label style={{ fontSize: fontSize.sm, display: 'block', marginBottom: 4 }}>
                  {t('city')}
                </label>
                <input
                  value={gigForm.city}
                  onChange={e => setGigForm({ ...gigForm, city: e.target.value })}
                  placeholder={t('brussels')}
                  style={{
                    width: '100%',
                    padding: 8,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    color: colors.text.primary,
                    borderRadius: 6,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: fontSize.sm, display: 'block', marginBottom: 4 }}>
                  {t('role')}
                </label>
                <select
                  value={gigForm.role}
                  onChange={e => setGigForm({ ...gigForm, role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 8,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    color: colors.text.primary,
                    borderRadius: 6,
                  }}
                >
                  <option value="headline">{t('headline')}</option>
                  <option value="support">{t('support')}</option>
                  <option value="resident">{t('resident')}</option>
                  <option value="radio">{t('radio')}</option>
                  <option value="festival">{t('festivalSlot')}</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: fontSize.sm, display: 'block', marginBottom: 4 }}>
                {t('notesOptional')}
              </label>
              <textarea
                value={gigForm.notes}
                onChange={e => setGigForm({ ...gigForm, notes: e.target.value })}
                rows={2}
                style={{
                  width: '100%',
                  padding: 8,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.text.primary,
                  borderRadius: 6,
                }}
              />
            </div>
          </div>
        )}

        {activeTab !== 'gig' && (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: colors.text.muted,
              fontSize: fontSize.sm,
            }}
          >
            This category is coming soon. Focus on logging gigs for maximum graph value right now.
          </div>
        )}

        {/* Error message */}
        {submitError && (
          <div
            style={{
              background: '#3a1f1f',
              color: '#ff6b6b',
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: fontSize.sm,
              marginBottom: 12,
            }}
          >
            {submitError}
          </div>
        )}

        {/* Success state with Log Another flow */}
        {submitSuccess && lastResult ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: fontWeight.bold, marginBottom: 8 }}>
              Success! Created {lastResult.nodesCreated} nodes and {lastResult.edgesCreated} edges.
            </div>
            <div style={{ color: colors.text.muted, fontSize: fontSize.sm, marginBottom: 16 }}>
              {t('thisPerformanceIsNow')}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <HiveButton variant="secondary" onClick={handleLogAnother}>
                {t('logAnotherGig')}
              </HiveButton>
              <HiveButton variant="primary" onClick={handleDone}>
                {t('done')}
              </HiveButton>
            </div>
          </div>
        ) : (
          /* Normal submit buttons */
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
            <HiveButton variant="secondary" onClick={onClose} disabled={isSubmitting}>
              {t('cancel')}
            </HiveButton>
            <HiveButton
              variant="primary"
              onClick={handleSubmitGig}
              disabled={isSubmitting || !gigForm.venue}
            >
              {isSubmitting ? 'Saving to Graph...' : 'Log & Seed Graph'}
            </HiveButton>
          </div>
        )}
      </div>
    </div>
  );
}
