import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setQuery('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search DJs, mixes..."
        style={{
          background: '#111',
          border: focused ? '1px solid #f0c04044' : '1px solid #222',
          color: '#eee',
          padding: '6px 12px 6px 32px',
          borderRadius: 8,
          fontSize: 13,
          width: 180,
          outline: 'none',
          transition: 'border-color 0.2s, width 0.2s',
        }}
      />
      <span style={{
        position: 'absolute',
        left: 10,
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#555',
        fontSize: 13,
        pointerEvents: 'none',
      }}>
        🔍
      </span>
      <kbd style={{
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        background: '#1a1a2e',
        color: '#555',
        fontSize: 10,
        padding: '2px 5px',
        borderRadius: 4,
        border: '1px solid #222',
      }}>
        ⌘K
      </kbd>
    </form>
  )
}
