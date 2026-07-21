import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { colors, radius, fontSize, fontWeight } from '../../styles/tokens';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  help?: ReactNode;
  error?: string | undefined;
  /** Stash file-specific accept default for callers. */
  accept?: string;
}

/**
 * <input type="file"> styled to match the rest of the form primitives.
 * Same label/id/aria contract as Input so it works with the existing
 * formErrors plumbing and label-has-associated-control lint.
 */
export const FileInput = forwardRef<HTMLInputElement, Props>(function FileInput(
  { label, help, error, id, style, disabled, ...rest },
  ref
) {
  const reactId = useId();
  const inputId = id || reactId;
  const helpId = help ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            color: colors.text.secondary,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
          }}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type="file"
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        style={{
          background: colors.surface,
          borderRadius: radius.md,
          padding: '10px 12px',
          color: colors.text.secondary,
          fontSize: fontSize.md,
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          ...style,
        }}
        {...rest}
        className={['mh-field', rest.className].filter(Boolean).join(' ')}
      />
      {help && !error && (
        <span id={helpId} style={{ color: colors.text.dim, fontSize: fontSize.xs }}>
          {help}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" style={{ color: colors.danger, fontSize: fontSize.xs }}>
          {error}
        </span>
      )}
    </div>
  );
});
