import { useState, useEffect } from 'react'
import { hasBlocked, blockUser, unblockUser } from '../lib/api'

interface Props {
  targetUserId: string
  currentUserId: string
}

export function BlockButton({ targetUserId, currentUserId }: Props) {
  const [blocked, setBlocked] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    hasBlocked(currentUserId, targetUserId).then(b => {
      setBlocked(b)
      setChecking(false)
    })
  }, [currentUserId, targetUserId])

  async function toggle() {
    if (blocked) {
      await unblockUser(currentUserId, targetUserId)
      setBlocked(false)
    } else {
      await blockUser(currentUserId, targetUserId)
      setBlocked(true)
    }
  }

  if (checking) return null

  return (
    <button onClick={toggle} style={{
      background: 'transparent',
      border: `1px solid ${blocked ? '#f0c040' : '#331111'}`,
      color: blocked ? '#f0c040' : '#f55',
      padding: '4px 12px',
      borderRadius: 6,
      cursor: 'pointer',
      fontSize: 11,
    }}>
      {blocked ? '✓ Blocked' : 'Block'}
    </button>
  )
}
