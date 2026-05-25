import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GlobalPlayer } from './components/GlobalPlayer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PlayerProvider } from './lib/playerStore'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Feed } from './pages/Feed'
import { ProfilePage } from './pages/Profile'
import { MixDetail } from './pages/MixDetail'
import { Upload } from './pages/Upload'
import { Settings } from './pages/Settings'
import { AuthCallback } from './pages/AuthCallback'
import { NotificationsPage } from './pages/Notifications'
import { SearchPage } from './pages/Search'
import { EmbedMix } from './pages/EmbedMix'
import { EditMix } from './pages/EditMix'
import { PlaylistDetail } from './pages/PlaylistDetail'
import { NotFound } from './pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#eee',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <Navbar />
        <a
          href="#main-content"
          style={{
            position: 'absolute',
            left: -9999,
            top: 8,
            background: '#f0c040',
            color: '#0a0a0a',
            padding: '8px 14px',
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 13,
            zIndex: 999,
          }}
          onFocus={e => { e.currentTarget.style.left = '8px' }}
          onBlur={e => { e.currentTarget.style.left = '-9999px' }}
        >
          Skip to main content
        </a>
        <main id="main-content">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/trending" element={<Feed />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/u/:username" element={<ProfilePage />} />
              <Route path="/mix/:id" element={<MixDetail />} />
              <Route path="/mix/:id/edit" element={<ProtectedRoute><EditMix /></ProtectedRoute>} />
              <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/embed/mix/:id" element={<EmbedMix />} />
              <Route path="/playlist/:id" element={<PlaylistDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </main>
        <GlobalPlayer />
      </div>
      </PlayerProvider>
    </BrowserRouter>
  )
}
