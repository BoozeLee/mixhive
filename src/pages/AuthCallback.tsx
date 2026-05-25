import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/feed', { replace: true })
      } else {
        setError('Authentication failed — no session returned. Try signing in again.')
      }
    })
  }, [navigate])

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24, textAlign: 'center' }}>
        <p style={{ color: '#f55', fontSize: 14, marginBottom: 16 }}>{error}</p>
        <a href="/login" style={{ color: '#f0c040', fontSize: 14 }}>Back to sign in</a>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#f0c040', fontSize: 14, marginBottom: 8 }}>Completing sign in...</div>
        <div style={{ color: '#555', fontSize: 12 }}>Redirecting you to the feed</div>
      </div>
    </div>
  )
}
