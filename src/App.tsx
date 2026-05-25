import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GlobalPlayer } from './components/GlobalPlayer'
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
        </Routes>
        <GlobalPlayer />
      </div>
      </PlayerProvider>
    </BrowserRouter>
  )
}
