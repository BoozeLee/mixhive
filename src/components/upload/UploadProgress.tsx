import { colors, fontSize, fontWeight, radius, space } from '../../styles/tokens';

interface UploadProgressProps {
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  label: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function UploadProgress({ progress, loadedBytes, totalBytes, label }: UploadProgressProps) {
  return (
    <div style={{ marginBottom: space[7] }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: space[2],
          fontSize: fontSize.sm,
        }}
      >
        <span style={{ color: colors.accent, fontWeight: fontWeight.semibold }}>{label}</span>
        <span style={{ color: colors.text.muted }}>
          {Math.round(progress)}% · {formatBytes(loadedBytes)} / {formatBytes(totalBytes)}
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: radius.pill,
          background: colors.surfaceHover,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: `linear-gradient(90deg, ${colors.accent}, ${colors.accentBright})`,
            borderRadius: radius.pill,
            transition: 'width 200ms ease',
          }}
        />
      </div>
    </div>
  );
}
