import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { RegisterSchema, formatZodError } from '../lib/schemas'

export function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    display_name: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const { signUpWithEmail } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate with Zod
    const result = RegisterSchema.safeParse(formData)
    if (!result.success) {
      setErrors(formatZodError(result.error))
      setGeneralError('')
      return
    }
    
    setErrors({})
    setGeneralError('')
    
    const { error: err } = await signUpWithEmail(formData.email, formData.password, {
      preferred_username: formData.username
    })
    if (err) {
      setGeneralError(err.message)
    } else {
      navigate('/setup')
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear field-specific error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div className="container" style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: 'calc(100vh - 60px)', 
      padding: '24px 16px' 
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#eee', marginBottom: 24, textAlign: 'center' }}>
          Join Mix Hive
        </h1>

        {generalError && (
          <div style={{ 
            background: '#2a1010', 
            color: '#f55', 
            padding: '10px 14px', 
            borderRadius: 8, 
            fontSize: 13, 
            marginBottom: 16 
          }}>
            {generalError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            type="text"
            autoComplete="username"
            placeholder="Username"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            error={errors.username}
            help="3-30 characters, letters, numbers, underscores"
          />
          <Input
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            error={errors.email}
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            error={errors.password}
            help="8+ characters with uppercase, lowercase, and number"
          />
          <Input
            type="text"
            autoComplete="name"
            placeholder="Display name"
            value={formData.display_name}
            onChange={(e) => handleInputChange('display_name', e.target.value)}
            error={errors.display_name}
          />
          <p style={{ color: '#555', fontSize: 11, margin: 0 }}>
            By joining, you agree to the Terms of Service.
          </p>
          <Button type="submit" variant="primary" style={{ width: '100%', marginTop: 8 }}>
            Create account
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, color: '#555', fontSize: 13 }}>
          Already have an account? <Link to="/login" style={{ color: '#f0c040', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
