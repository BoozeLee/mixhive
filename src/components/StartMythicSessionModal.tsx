'use client';

import React, { useState } from 'react';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
import { MythicSessionRoom } from './MythicSessionRoom';
import { PostSessionReview } from './PostSessionReview';
import toast from 'react-hot-toast';
import { ritualRequest } from '../lib/rituals';

interface StartMythicSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StartMythicSessionModal({ isOpen, onClose }: StartMythicSessionModalProps) {
  const [mode, setMode] = useState<'form' | 'room' | 'review'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionData, setSessionData] = useState<{ id: string; title: string } | null>(null);

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    isPublic: false,
    agentEnabled: true,
  });

  if (!isOpen) return null;

  const handleCreateSession = async () => {
    if (!form.title.trim()) {
      toast.error('Please enter a session title');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await ritualRequest<{ id: string }>('/api/mythic/sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          isPublic: form.isPublic,
          agentEnabled: form.agentEnabled,
        }),
      });

      setSessionData({
        id: created.id,
        title: form.title.trim(),
      });
      setMode('room');

      toast.success('Mythic Session created!');
    } catch (error) {
      console.error(error);
      toast.error((error as Error).message || 'Failed to start session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndSession = () => {
    if (!sessionData) {
      onClose();
      return;
    }

    // Transition to review screen instead of closing
    setMode('review');
  };

  const handleReviewComplete = () => {
    toast.success('Session outcomes written to your Mythic graph.');
    onClose();
    // Reset state
    setMode('form');
    setSessionData(null);
    setForm({ title: '', description: '', isPublic: false, agentEnabled: true });
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- role=dialog backdrop needs click/keyboard for backdrop-dismiss; Escape handled inline
    <div
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={mode === 'form' ? 'Start Mythic Session' : sessionData?.title || 'Mythic Session'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: radius.lg,
          width: '100%',
          maxWidth: mode === 'room' ? 1100 : 520,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: `${space[4]}px ${space[6]}px`,
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
              {mode === 'form' ? 'Start Mythic Session' : sessionData?.title}
            </div>
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
              {mode === 'form'
                ? 'Create a collaborative workspace that writes itself into the graph'
                : 'Real-time collaboration with automatic provenance'}
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.text.muted,
              fontSize: 20,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {mode === 'form' ? (
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="mythic-session-title"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: fontSize.sm,
                    color: colors.text.secondary,
                  }}
                >
                  Session Title *
                </label>
                <input
                  id="mythic-session-title"
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Late night techno sketches"
                  style={{
                    width: '100%',
                    padding: 12,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.sm,
                    color: colors.text.primary,
                    fontSize: fontSize.md,
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="mythic-session-description"
                  style={{
                    display: 'block',
                    marginBottom: 6,
                    fontSize: fontSize.sm,
                    color: colors.text.secondary,
                  }}
                >
                  Description (optional)
                </label>
                <textarea
                  id="mythic-session-description"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Working on a new track for the upcoming show at Fuse..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 12,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.sm,
                    color: colors.text.primary,
                    fontSize: fontSize.md,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.isPublic}
                    onChange={e => setForm({ ...form, isPublic: e.target.checked })}
                  />
                  <span style={{ fontSize: fontSize.sm }}>
                    Make this session visible in legends (public)
                  </span>
                </label>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.agentEnabled}
                    onChange={e => setForm({ ...form, agentEnabled: e.target.checked })}
                  />
                  <span style={{ fontSize: fontSize.sm }}>
                    Invite the bounded autonomous Session Spirit
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <HiveButton variant="secondary" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </HiveButton>
                <HiveButton
                  variant="primary"
                  onClick={handleCreateSession}
                  disabled={isSubmitting || !form.title.trim()}
                >
                  {isSubmitting ? 'Creating Session...' : 'Create & Enter Session'}
                </HiveButton>
              </div>
            </div>
          ) : mode === 'room' && sessionData ? (
            <div style={{ height: '70vh', minHeight: 500 }}>
              <MythicSessionRoom
                sessionId={sessionData.id}
                title={sessionData.title}
                onEndSession={handleEndSession}
              />
            </div>
          ) : mode === 'review' && sessionData ? (
            <div style={{ padding: 24 }}>
              <PostSessionReview
                sessionId={sessionData.id}
                sessionTitle={sessionData.title}
                onClose={onClose}
                onApproved={handleReviewComplete}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
