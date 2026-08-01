import { useTranslations } from 'next-intl';
import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';

interface SchedulePublishToggleProps {
  mode: 'now' | 'later';
  scheduledAt: string;
  error?: string;
  onModeChange: (mode: 'now' | 'later') => void;
  onScheduledAtChange: (value: string) => void;
}

export function SchedulePublishToggle({
  mode,
  scheduledAt,
  error,
  onModeChange,
  onScheduledAtChange,
}: SchedulePublishToggleProps) {
  const t = useTranslations('upload');
  const minDate = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
      <div style={{ display: 'flex', gap: space[3] }}>
        <button
          type="button"
          onClick={() => onModeChange('now')}
          style={{
            flex: 1,
            padding: `${space[3]}px ${space[5]}px`,
            borderRadius: radius.md,
            border: `1px solid ${mode === 'now' ? colors.accent : colors.borderStrong}`,
            background: mode === 'now' ? colors.accent : colors.surface,
            color: mode === 'now' ? colors.bg : colors.text.secondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            cursor: 'pointer',
          }}
        >
          {t('publishNow')}
        </button>
        <button
          type="button"
          onClick={() => onModeChange('later')}
          style={{
            flex: 1,
            padding: `${space[3]}px ${space[5]}px`,
            borderRadius: radius.md,
            border: `1px solid ${mode === 'later' ? colors.accent : colors.borderStrong}`,
            background: mode === 'later' ? colors.accent : colors.surface,
            color: mode === 'later' ? colors.bg : colors.text.secondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            cursor: 'pointer',
          }}
        >
          {t('scheduleForLater')}
        </button>
      </div>
      {mode === 'later' && (
        <div>
          <input
            type="datetime-local"
            min={minDate}
            value={scheduledAt}
            onChange={e => onScheduledAtChange(e.target.value)}
            style={{
              width: '100%',
              padding: `${space[4]}px ${space[5]}px`,
              background: colors.bg,
              border: `1px solid ${error ? colors.danger : colors.borderStrong}`,
              borderRadius: radius.md,
              color: colors.text.primary,
              fontSize: fontSize.md,
              fontFamily: 'inherit',
            }}
          />
          {error && (
            <span
              style={{
                color: colors.danger,
                fontSize: fontSize.xs,
                marginTop: space[2],
                display: 'block',
              }}
            >
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
