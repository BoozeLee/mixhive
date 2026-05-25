import { useEffect, useRef, type ReactNode } from 'react'
import { colors, radius, shadow, z, fontSize, fontWeight, space } from '../../styles/tokens'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  /** Max width in pixels. Defaults to 480. */
  width?: number
  /** Hide the close X in the corner. */
  hideCloseButton?: boolean
  children: ReactNode
}

export function Modal({ open, onClose, title, description, width = 480, hideCloseButton, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Sync open prop with native dialog state. <dialog> gives us native focus
  // trap + inert background + ESC handling for free.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // The native dialog fires 'cancel' on ESC and 'close' when the user
  // dismisses it. Bridge both back to React state.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  // Backdrop click on the dialog element itself (not its content).
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Native <dialog> handles ESC via the cancel event; click is only for pointer backdrop dismissal.
    <dialog
      ref={dialogRef}
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
      onClick={handleBackdropClick}
      style={{
        padding: 0,
        border: 'none',
        background: 'transparent',
        maxWidth: width,
        width: '92vw',
        color: colors.text.primary,
      }}
    >
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.xl,
          boxShadow: shadow.lg,
          padding: space[10],
          position: 'relative',
          zIndex: z.modal,
        }}
      >
        {(title || !hideCloseButton) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: space[7], marginBottom: title || description ? space[8] : 0 }}>
            <div style={{ minWidth: 0 }}>
              {title && (
                <h2 id="modal-title" style={{ margin: 0, fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text.primary }}>
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" style={{ margin: '4px 0 0', fontSize: fontSize.md, color: colors.text.muted }}>
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                aria-label="Close dialog"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.text.muted,
                  fontSize: 20,
                  cursor: 'pointer',
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
        {children}
      </div>
      <style>{`
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(2px);
        }
      `}</style>
    </dialog>
  )
}
