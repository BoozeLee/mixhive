import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const { signUpWithEmail } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error: err } = await signUpWithEmail(email, password, {
      preferred_username: username
    })
    if (err) {
      setError(err.message)
    } else {
      navigate('/feed')
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 60px)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eee', marginBottom: 24, textAlign: 'center' }}>
          Join Mix Hive
        </h1>

        {error && (
          <div style={{ background: '#2a1010', color: '#f55', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="text" placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} required pattern="^[a-zA-Z0-9_]{3,20}$"
            title="3-20 characters, letters, numbers, underscores"
            style={{ background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={{ background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
          <input type="password" placeholder="Password (min 6 chars)" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
            style={{ background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
          <p style={{ color: '#555', fontSize: 11, margin: 0 }}>
            By joining, you agree to the Terms of Service.
          </p>
          <button type="submit" style={{
            background: '#f0c040',
            color: '#0a0a0a',
            border: 'none',
            padding: '10px',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 4
          }}>
            Create account
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, color: '#555', fontSize: 13 }}>
          Already have an account? <Link to="/login" style={{ color: '#f0c040' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
