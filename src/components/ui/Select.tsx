import { forwardRef, useId, type SelectHTMLAttributes, type ReactNode } from 'react';
import { colors, radius, fontSize, fontWeight } from '../../styles/tokens';

interface Option {
  value: string;
  label: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  help?: ReactNode;
  error?: string | undefined;
  hideLabel?: boolean;
  /** Options to render. Pass children to roll your own. */
  options?: Option[];
  children?: ReactNode;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, help, error, hideLabel, options, children, placeholder, id, style, disabled, ...rest },
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
          style={
            hideLabel
              ? {
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0,0,0,0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }
              : {
                  color: colors.text.secondary,
                  fontSize: fontSize.sm,
                  fontWeight: fontWeight.medium,
                }
          }
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        style={{
          background: colors.bg,
          borderRadius: radius.md,
          padding: '8px 12px',
          color: colors.text.primary,
          fontSize: fontSize.md,
          fontFamily: 'inherit',
          appearance: 'none',
          backgroundImage:
            'linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)',
          backgroundPosition: 'calc(100% - 16px) 50%, calc(100% - 11px) 50%',
          backgroundSize: '5px 5px',
          backgroundRepeat: 'no-repeat',
          paddingRight: 32,
          ...style,
        }}
        {...rest}
        className={['mh-field', rest.className].filter(Boolean).join(' ')}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options
          ? options.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : children}
      </select>
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
