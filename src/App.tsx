import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Navbar } from './components/Navbar'
import { ProtectedRoute } from './components/ProtectedRoute'
import { GlobalPlayer } from './components/GlobalPlayer'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RoutePending } from './components/RoutePending'
import { PlayerProvider } from './lib/playerStore'
import { MobileNav } from './components/MobileNav'
import './styles/global.css'

// Routes are code-split so the initial bundle only ships what the user
// actually opens. The Navbar / PlayerProvider / ErrorBoundary stay in the
// main chunk because they wrap every screen.
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })))
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })))
const Feed = lazy(() => import('./pages/Feed').then(m => ({ default: m.Feed })))
const Discover = lazy(() => import('./pages/Discover').then(m => ({ default: m.Discover })))
const ProfilePage = lazy(() => import('./pages/Profile').then(m => ({ default: m.ProfilePage })))
const MixDetail = lazy(() => import('./pages/MixDetail').then(m => ({ default: m.MixDetail })))
const Upload = lazy(() => import('./pages/Upload').then(m => ({ default: m.Upload })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
const AuthCallback = lazy(() => import('./pages/AuthCallback').then(m => ({ default: m.AuthCallback })))
const NotificationsPage = lazy(() => import('./pages/Notifications').then(m => ({ default: m.NotificationsPage })))
const SearchPage = lazy(() => import('./pages/Search').then(m => ({ default: m.SearchPage })))
const EmbedMix = lazy(() => import('./pages/EmbedMix').then(m => ({ default: m.EmbedMix })))
const EditMix = lazy(() => import('./pages/EditMix').then(m => ({ default: m.EditMix })))
const PlaylistDetail = lazy(() => import('./pages/PlaylistDetail').then(m => ({ default: m.PlaylistDetail })))
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })))
const Agents = lazy(() => import('./pages/Agents').then(m => ({ default: m.Agents })))

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
            <Suspense fallback={<RoutePending />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/trending" element={<Feed />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/u/:username" element={<ProfilePage />} />
                <Route path="/mix/:id" element={<MixDetail />} />
                <Route path="/mix/:id/edit" element={<ProtectedRoute><EditMix /></ProtectedRoute>} />
                <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
                <Route path="/embed/mix/:id" element={<EmbedMix />} />
                <Route path="/playlist/:id" element={<PlaylistDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <GlobalPlayer />
        <MobileNav />
        <Analytics />
        <SpeedInsights />
      </div>
      </PlayerProvider>
    </BrowserRouter>
  )
}
