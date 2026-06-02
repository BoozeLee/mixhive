import React, { useState } from 'react';
import { colors, fontSize, space, fontWeight, radius } from '../styles/tokens';
import { HiveButton } from './hive/HiveButton';
import { createQuest } from '../lib/api';
import type { MythicQuest } from '../lib/types';

interface Props {
  onClose: () => void;
  onCreated: (quest: MythicQuest) => void;
}

const QUEST_TEMPLATES = [
  {
    id: 'brussels-techno',
    title: 'Break into the Brussels Melodic / Leftfield Techno Scene',
    description: 'Build real relationships and proof in the Brussels underground electronic scene.',
    target_scene_tags: ['techno', 'leftfield', 'brussels', 'melodic'],
    timeframe_days: 90,
  },
  {
    id: 'eu-festival',
    title: 'Secure first EU festival support slot',
    description: 'Get booked for a proper festival slot outside your home country.',
    target_scene_tags: ['festival', 'europe'],
    timeframe_days: 180,
  },
  {
    id: 'first-collab-ep',
    title: 'Release first collaborative EP',
    description: 'Release a 3-5 track EP with 2-3 artists from your scene.',
    target_scene_tags: ['release', 'collab'],
    timeframe_days: 120,
  },
];

export function CreateQuestModal({ onClose, onCreated }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selected = QUEST_TEMPLATES.find(t => t.id === selectedTemplate);

  const handleCreate = async () => {
    if (!selectedTemplate) return;

    setIsCreating(true);

    try {
      const template = selected!;
      const quest = await createQuest({
        title: customTitle || template.title,
        description: template.description,
        target_scene_tags: template.target_scene_tags,
        timeframe_days: template.timeframe_days,
      });

      if (quest) {
        onCreated(quest);
        onClose();
      }
    } catch (e) {
      alert('Failed to create quest: ' + (e as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: colors.surface,
        border: `1px solid ${colors.borderStrong}`,
        borderRadius: radius.lg,
        width: '100%',
        maxWidth: 620,
        padding: 24,
      }}>
        <h2 style={{ marginTop: 0, marginBottom: space[4] }}>Start a New Quest</h2>

        <p style={{ color: colors.text.muted, marginBottom: space[6] }}>
          Choose a template or create a custom one. Your Mythic agents will help you complete it.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: space[3], marginBottom: space[6] }}>
          {QUEST_TEMPLATES.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              style={{
                padding: 14,
                borderRadius: radius.md,
                border: selectedTemplate === t.id ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
                background: selectedTemplate === t.id ? 'rgba(240,192,64,0.08)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: fontWeight.semibold }}>{t.title}</div>
              <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>{t.description}</div>
            </div>
          ))}
        </div>

        {selectedTemplate && (
          <div style={{ marginBottom: space[6] }}>
            <label style={{ display: 'block', fontSize: fontSize.sm, marginBottom: 4 }}>Custom title (optional)</label>
            <input
              type="text"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder={selected?.title}
              style={{
                width: '100%',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.text.primary,
                padding: '10px 12px',
                borderRadius: radius.sm,
                fontSize: fontSize.md,
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: space[3], justifyContent: 'flex-end' }}>
          <HiveButton variant="secondary" onClick={onClose} disabled={isCreating}>
            Cancel
          </HiveButton>
          <HiveButton
            variant="primary"
            onClick={handleCreate}
            disabled={!selectedTemplate || isCreating}
          >
            {isCreating ? 'Creating...' : 'Start Quest'}
          </HiveButton>
        </div>
      </div>
    </div>
  );
}
