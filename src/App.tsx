'use client';

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GlobalPlayer } from './components/GlobalPlayer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RoutePending } from './components/RoutePending';
import { PlayerProvider } from './lib/playerStore';
import { NotificationProvider } from './lib/notificationStore';
import { MobileNav } from './components/MobileNav';
import { DesktopSidebar } from './components/DesktopSidebar';
import { CyberHiveBackdrop } from './components/CyberHiveBackdrop';
import './styles/global.css';

// Routes are code-split so the initial bundle only ships what the user
// actually opens. The Navbar / PlayerProvider / ErrorBoundary stay in the
// main chunk because they wrap every screen.
const Landing = lazy(() => import('./views/Landing').then(m => ({ default: m.Landing })));
const Login = lazy(() => import('./views/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./views/Register').then(m => ({ default: m.Register })));
const Feed = lazy(() => import('./views/Feed').then(m => ({ default: m.Feed })));
const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const Discover = lazy(() => import('./views/Discover').then(m => ({ default: m.Discover })));
const ProfilePage = lazy(() => import('./views/Profile').then(m => ({ default: m.ProfilePage })));
const MixDetail = lazy(() => import('./views/MixDetail').then(m => ({ default: m.MixDetail })));
const Upload = lazy(() => import('./views/Upload').then(m => ({ default: m.Upload })));
const Settings = lazy(() => import('./views/Settings').then(m => ({ default: m.Settings })));
const AuthCallback = lazy(() =>
  import('./views/AuthCallback').then(m => ({ default: m.AuthCallback }))
);
const ForgotPassword = lazy(() =>
  import('./views/ForgotPassword').then(m => ({ default: m.ForgotPassword }))
);
const ResetPassword = lazy(() =>
  import('./views/ResetPassword').then(m => ({ default: m.ResetPassword }))
);
const NotificationsPage = lazy(() =>
  import('./views/Notifications').then(m => ({ default: m.NotificationsPage }))
);
const SearchPage = lazy(() => import('./views/Search').then(m => ({ default: m.SearchPage })));
const EmbedMix = lazy(() => import('./views/EmbedMix').then(m => ({ default: m.EmbedMix })));
const EditMix = lazy(() => import('./views/EditMix').then(m => ({ default: m.EditMix })));
const PlaylistDetail = lazy(() =>
  import('./views/PlaylistDetail').then(m => ({ default: m.PlaylistDetail }))
);
const NotFound = lazy(() => import('./views/NotFound').then(m => ({ default: m.NotFound })));
const Agents = lazy(() => import('./views/Agents').then(m => ({ default: m.Agents })));
const AgentsGallery = lazy(() =>
  import('./views/AgentsGallery').then(m => ({ default: m.AgentsGallery }))
);
const DevLogin = lazy(() => import('./views/DevLogin').then(m => ({ default: m.DevLogin })));
const AdminVerification = lazy(() =>
  import('./views/AdminVerification').then(m => ({ default: m.AdminVerification }))
);
const BuzzDetail = lazy(() => import('./views/BuzzDetail').then(m => ({ default: m.BuzzDetail })));
const ProfileSetup = lazy(() =>
  import('./views/ProfileSetup').then(m => ({ default: m.ProfileSetup }))
);
const AgentInbox = lazy(() => import('./views/AgentInbox').then(m => ({ default: m.AgentInbox })));
const Opportunities = lazy(() =>
  import('./views/Opportunities').then(m => ({ default: m.Opportunities }))
);
const QuestDetail = lazy(() => import('./views/QuestDetail').then(m => ({ default: m.QuestDetail })));
const QuestsList = lazy(() => import('./views/QuestsList').then(m => ({ default: m.QuestsList })));
const GearMarketplace = lazy(() => import('./views/GearMarketplace').then(m => ({ default: m.GearMarketplace })));
const GearListingDetail = lazy(() => import('./views/GearListingDetail').then(m => ({ default: m.GearListingDetail })));
const NewGearListing = lazy(() => import('./views/NewGearListing').then(m => ({ default: m.NewGearListing })));
const AgentMarketplace = lazy(() => import('./views/AgentMarketplace').then(m => ({ default: m.AgentMarketplace })));
const CollabQuests = lazy(() => import('./views/CollabQuests').then(m => ({ default: m.CollabQuests })));
const NewCollabQuest = lazy(() => import('./views/NewCollabQuest').then(m => ({ default: m.NewCollabQuest })));
const CollabQuestDetail = lazy(() => import('./views/CollabQuestDetail').then(m => ({ default: m.CollabQuestDetail })));
const PressKitStudio = lazy(() =>
  import('./views/PressKitStudio').then(m => ({ default: m.PressKitStudio }))
);
const PublicPressKit = lazy(() =>
  import('./views/PublicPressKit').then(m => ({ default: m.PublicPressKit }))
);
const SceneRadar = lazy(() =>
  import('./views/SceneRadar').then(m => ({ default: m.SceneRadar }))
);
const CollabSessionRoom = lazy(() =>
  import('./views/CollabSessionRoom').then(m => ({ default: m.CollabSessionRoom }))
);
const HiveComposer = lazy(() =>
  import('./views/HiveComposer').then(m => ({ default: m.HiveComposer }))
);
const HiveStoryLanding = lazy(() =>
  import('./views/HiveStoryLanding').then(m => ({ default: m.HiveStoryLanding }))
);
const HiveStoryIssue = lazy(() =>
  import('./views/HiveStoryIssue').then(m => ({ default: m.HiveStoryIssue }))
);
const Hub = lazy(() =>
  import('./views/Hub').then(m => ({ default: m.Hub }))
);
// SessionFab is small and always available to authenticated users — not lazy-loaded
import { SessionFab } from './components/SessionFab';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dev-login" element={<DevLogin />} />
        <Route path="/feed" element={<Feed />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/discover" element={<Discover />} />
        <Route path="/trending" element={<Feed />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/u/:username" element={<ProfilePage />} />
        <Route path="/mix/:id" element={<MixDetail />} />
        <Route
          path="/mix/:id/edit"
          element={
            <ProtectedRoute>
              <EditMix />
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Upload />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents"
          element={
            <ProtectedRoute>
              <Agents />
            </ProtectedRoute>
          }
        />
        <Route path="/agents/gallery" element={<AgentsGallery />} />
        <Route
          path="/admin/verification"
          element={
            <ProtectedRoute>
              <AdminVerification />
            </ProtectedRoute>
          }
        />
        <Route path="/embed/mix/:id" element={<EmbedMix />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/buzz/:id" element={<BuzzDetail />} />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <ProfileSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agents/inbox"
          element={
            <ProtectedRoute>
              <AgentInbox />
            </ProtectedRoute>
          }
        />
        <Route
          path="/opportunities"
          element={
            <ProtectedRoute>
              <Opportunities />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quests/:id"
          element={
            <ProtectedRoute>
              <QuestDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quests"
          element={
            <ProtectedRoute>
              <QuestsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/epk"
          element={
            <ProtectedRoute>
              <PressKitStudio />
            </ProtectedRoute>
          }
        />
        <Route path="/epk/:slug" element={<PublicPressKit />} />
        <Route
          path="/scene-radar"
          element={
            <ProtectedRoute>
              <SceneRadar />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/:id"
          element={
            <ProtectedRoute>
              <CollabSessionRoom />
            </ProtectedRoute>
          }
        />
        <Route
          path="/composer"
          element={
            <ProtectedRoute>
              <HiveComposer />
            </ProtectedRoute>
          }
        />
        {/* Phase 15 — Gear Marketplace */}
        <Route path="/marketplace/gear" element={<GearMarketplace />} />
        <Route path="/marketplace/gear/:id" element={<GearListingDetail />} />
        <Route
          path="/marketplace/gear/new"
          element={
            <ProtectedRoute>
              <NewGearListing />
            </ProtectedRoute>
          }
        />
        {/* Phase 15 — Agent Marketplace */}
        <Route path="/marketplace/agents" element={<AgentMarketplace />} />
        {/* Phase 16 — Hive Story editorial */}
        <Route path="/hive-story" element={<HiveStoryLanding />} />
        <Route path="/hive-story/:slug" element={<HiveStoryIssue />} />
        {/* Hub — feature navigation */}
        <Route path="/hub" element={<Hub />} />
        {/* Phase 15 — Collab Quests */}
        <Route path="/collab-quests" element={<CollabQuests />} />
        <Route path="/collab-quests/:id" element={<CollabQuestDetail />} />
        <Route
          path="/collab-quests/new"
          element={
            <ProtectedRoute>
              <NewCollabQuest />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function shouldLoadVercelTelemetry() {
  if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return false;
  return !['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export default function App() {
  const loadVercelTelemetry = shouldLoadVercelTelemetry();

  return (
    <BrowserRouter>
      <PlayerProvider>
        <NotificationProvider>
          <div className="mixhive-shell">
          <CyberHiveBackdrop />
          <Navbar />
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <div className="app-body">
            <DesktopSidebar />
            <main id="main-content" className="mixhive-main app-main">
              <ErrorBoundary>
                <Suspense fallback={<RoutePending />}>
                  <AnimatedRoutes />
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>
          <GlobalPlayer />
          <MobileNav />
          <SessionFab />
        {loadVercelTelemetry && <Analytics />}
        {loadVercelTelemetry && <SpeedInsights />}
      </div>
    </NotificationProvider>
  </PlayerProvider>
</BrowserRouter>
);
}
