import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchAutocomplete } from './SearchAutocomplete'
import { colors } from '../styles/tokens'

export function SearchBar() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        wrapperRef.current?.querySelector('input')?.focus()
      }
      if (e.key === 'Escape') {
        wrapperRef.current?.querySelector('input')?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
      <SearchAutocomplete
        onSearch={handleSearch}
        placeholder="Search DJs, mixes..."
      />
      <kbd style={{
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        background: colors.surface,
        color: colors.text.muted,
        fontSize: 10,
        padding: '2px 5px',
        borderRadius: 4,
        border: `1px solid ${colors.border}`,
        pointerEvents: 'none',
      }}>
        ⌘K
      </kbd>
    </div>
  )
}
