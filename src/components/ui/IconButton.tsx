import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { colors, radius, transition } from '../../styles/tokens'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — assistive tech reads this. */
  label: string
  size?: number
  active?: boolean
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, size = 32, active, disabled, style, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      aria-pressed={typeof active === 'boolean' ? active : undefined}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? colors.surfaceHover : 'transparent',
        color: active ? colors.accent : colors.text.muted,
        border: '1px solid transparent',
        borderRadius: radius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: `background ${transition.base}, color ${transition.fast}`,
        ...style,
      }}
      {...rest}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
})
