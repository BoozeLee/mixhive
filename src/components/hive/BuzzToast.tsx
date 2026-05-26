import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type Tone = 'info' | 'success' | 'danger'

interface Props {
  open: boolean
  message: string
  tone?: Tone
  /** Auto-dismiss after this many ms. 0 = sticky until onClose. */
  duration?: number
  onClose?: () => void
}

const toneStyle: Record<Tone, { bg: string; border: string; fg: string; glyph: string }> = {
  info:    { bg: 'rgba(7,7,5,0.92)',  border: 'var(--hive-gold, #f6c400)',     fg: 'var(--hive-gold-hot, #ffd84a)', glyph: '🐝' },
  success: { bg: 'rgba(7,30,12,0.92)', border: 'var(--hive-success, #7eed8b)', fg: 'var(--hive-success, #7eed8b)',  glyph: '✓'  },
  danger:  { bg: 'rgba(40,8,8,0.92)',  border: 'var(--hive-danger, #ff5252)',  fg: 'var(--hive-danger, #ff5252)',   glyph: '!'  },
}

/**
 * Bee-flying-in toast. Arcs in from the upper-right corner, settles in the
 * top-right notification slot, optionally auto-dismisses.
 */
export function BuzzToast({ open, message, tone = 'info', duration = 4000, onClose }: Props) {
  useEffect(() => {
    if (!open || !duration || !onClose) return
    const t = setTimeout(onClose, duration)
    return () => clearTimeout(t)
  }, [open, duration, onClose])

  const cfg = toneStyle[tone]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ x: 120, y: -40, rotate: 12, opacity: 0 }}
          animate={{ x: 0,   y: 0,   rotate: 0,  opacity: 1 }}
          exit={{    x: 80,  y: -20, rotate: 8,  opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            zIndex: 900,
            minWidth: 260,
            maxWidth: 360,
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 14,
            padding: '12px 14px',
            color: 'var(--hive-text, #f5f3e7)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 14px 36px rgba(0,0,0,0.55), 0 0 24px rgba(246,196,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span aria-hidden="true" style={{ color: cfg.fg, fontSize: 18, lineHeight: 1 }}>{cfg.glyph}</span>
          <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>{message}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss notification"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--hive-muted, #a9a390)',
                cursor: 'pointer',
                padding: 4,
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
