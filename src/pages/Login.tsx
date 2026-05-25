import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error: err } = await signInWithEmail(email, password)
    if (err) {
      setError(err.message)
    } else {
      navigate('/feed')
    }
  }

  async function handleGoogle() {
    const { error: err } = await signInWithGoogle()
    if (err) setError(err.message)
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 60px)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eee', marginBottom: 24, textAlign: 'center' }}>Sign in</h1>

        {error && (
          <div style={{ background: '#2a1010', color: '#f55', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={{ background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required
            style={{ background: '#111', border: '1px solid #222', color: '#eee', padding: '10px 14px', borderRadius: 8, fontSize: 14 }}
          />
          <button type="submit" style={{
            background: '#f0c040',
            color: '#0a0a0a',
            border: 'none',
            padding: '10px',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer'
          }}>
            Sign in
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0', color: '#555', fontSize: 13 }}>
          <div style={{ flex: 1, height: 1, background: '#222' }} />
          or
          <div style={{ flex: 1, height: 1, background: '#222' }} />
        </div>

        <button onClick={handleGoogle} style={{
          width: '100%',
          background: '#111',
          border: '1px solid #222',
          color: '#ccc',
          padding: '10px',
          borderRadius: 8,
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: 18 }}>G</span> Sign in with Google
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, color: '#555', fontSize: 13 }}>
          No account? <Link to="/register" style={{ color: '#f0c040' }}>Join Mix Hive</Link>
        </p>
      </div>
    </div>
  )
}
