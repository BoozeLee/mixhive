import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';

export type UploadStep = 'audio' | 'metadata' | 'artwork' | 'tracklist' | 'publish';

interface StepConfig {
  id: UploadStep;
  label: string;
}

interface UploadStepperProps {
  steps: StepConfig[];
  currentStep: UploadStep;
}

export function UploadStepper({ steps, currentStep }: UploadStepperProps) {
  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[2],
        marginBottom: space[8],
        overflowX: 'auto',
        paddingBottom: space[2],
      }}
      aria-label="Upload progress"
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                padding: `${space[3]}px ${space[5]}px`,
                borderRadius: radius.pill,
                background: isCurrent
                  ? colors.accent
                  : isCompleted
                    ? colors.surfaceHover
                    : colors.surface,
                border: `1px solid ${isCurrent ? colors.accent : colors.border}`,
                color: isCurrent ? colors.bg : isCompleted ? colors.accent : colors.text.dim,
                fontSize: fontSize.sm,
                fontWeight: isCurrent ? fontWeight.bold : fontWeight.medium,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: radius.full,
                  background: isCurrent ? colors.bg : isCompleted ? colors.accent : colors.border,
                  color: isCurrent ? colors.accent : isCompleted ? colors.bg : colors.text.dim,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: fontSize.xs,
                  fontWeight: fontWeight.bold,
                }}
              >
                {isCompleted ? '✓' : index + 1}
              </span>
              {step.label}
            </div>
            {index < steps.length - 1 && (
              <div
                style={{
                  width: 16,
                  height: 2,
                  background: isCompleted ? colors.accent : colors.border,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
