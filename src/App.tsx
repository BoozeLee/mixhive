'use client';

import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GlobalPlayer } from './components/GlobalPlayer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RoutePending } from './components/RoutePending';
import { PlayerProvider } from './lib/playerStore';
import { NotificationProvider } from './lib/notificationStore';
import { MessagesProvider } from './lib/messagesStore';
import { MobileNav } from './components/MobileNav';
import { DesktopSidebar } from './components/DesktopSidebar';
import { CyberHiveBackdrop } from './components/CyberHiveBackdrop';
import { ConsentBanner } from './components/ConsentBanner';
import { hasConsent } from './lib/consent';
import { needsOnboarding } from './lib/authRouting';
import { useAuth } from './hooks/useAuth';
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
const Scenes = lazy(() => import('./views/Scenes').then(m => ({ default: m.Scenes })));
const SceneDetail = lazy(() =>
  import('./views/SceneDetail').then(m => ({ default: m.SceneDetail }))
);
const Privacy = lazy(() => import('./views/Privacy').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('./views/Terms').then(m => ({ default: m.Terms })));
const CookiePolicy = lazy(() =>
  import('./views/CookiePolicy').then(m => ({ default: m.CookiePolicy }))
);
const Styleguide = lazy(() => import('./views/Styleguide').then(m => ({ default: m.Styleguide })));
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
const MixAnalyticsView = lazy(() =>
  import('./views/MixAnalytics').then(m => ({ default: m.MixAnalytics }))
);
const PlaylistDetail = lazy(() =>
  import('./views/PlaylistDetail').then(m => ({ default: m.PlaylistDetail }))
);
const PricingPage = lazy(() =>
  import('./views/PricingPage').then(m => ({ default: m.PricingPage }))
);
const NotFound = lazy(() => import('./views/NotFound').then(m => ({ default: m.NotFound })));
const Agents = lazy(() => import('./views/Agents').then(m => ({ default: m.Agents })));
const AgentsGallery = lazy(() =>
  import('./views/AgentsGallery').then(m => ({ default: m.AgentsGallery }))
);
const AIBandIndex = lazy(() =>
  import('./views/AIBandIndex').then(m => ({ default: m.AIBandIndex }))
);
const AIBandDetail = lazy(() =>
  import('./views/AIBandDetail').then(m => ({ default: m.AIBandDetail }))
);
const DevLogin = lazy(() => import('./views/DevLogin').then(m => ({ default: m.DevLogin })));
const AdminVerification = lazy(() =>
  import('./views/AdminVerification').then(m => ({ default: m.AdminVerification }))
);
const AdminModeration = lazy(() =>
  import('./views/AdminModeration').then(m => ({ default: m.AdminModeration }))
);
const AdminUsers = lazy(() => import('./views/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminInviteGenerator = lazy(() =>
  import('./views/AdminInviteGenerator').then(m => ({ default: m.AdminInviteGenerator }))
);
const BuzzDetail = lazy(() => import('./views/BuzzDetail').then(m => ({ default: m.BuzzDetail })));
const ProfileSetup = lazy(() =>
  import('./views/ProfileSetup').then(m => ({ default: m.ProfileSetup }))
);
const AgentInbox = lazy(() => import('./views/AgentInbox').then(m => ({ default: m.AgentInbox })));
const Opportunities = lazy(() =>
  import('./views/Opportunities').then(m => ({ default: m.Opportunities }))
);
const QuestDetail = lazy(() =>
  import('./views/QuestDetail').then(m => ({ default: m.QuestDetail }))
);
const QuestsList = lazy(() => import('./views/QuestsList').then(m => ({ default: m.QuestsList })));
const AvatarStudio = lazy(() =>
  import('./views/AvatarStudio').then(m => ({ default: m.AvatarStudio }))
);
const ArtStudio = lazy(() => import('./views/ArtStudio').then(m => ({ default: m.ArtStudio })));
const GearMarketplace = lazy(() =>
  import('./views/GearMarketplace').then(m => ({ default: m.GearMarketplace }))
);
const GearListingDetail = lazy(() =>
  import('./views/GearListingDetail').then(m => ({ default: m.GearListingDetail }))
);
const NewGearListing = lazy(() =>
  import('./views/NewGearListing').then(m => ({ default: m.NewGearListing }))
);
const AgentMarketplace = lazy(() =>
  import('./views/AgentMarketplace').then(m => ({ default: m.AgentMarketplace }))
);
const Leaderboard = lazy(() =>
  import('./views/Leaderboard').then(m => ({ default: m.Leaderboard }))
);
const AgentTracks = lazy(() =>
  import('./views/AgentTracks').then(m => ({ default: m.AgentTracks }))
);
const CollabQuests = lazy(() =>
  import('./views/CollabQuests').then(m => ({ default: m.CollabQuests }))
);
const NewCollabQuest = lazy(() =>
  import('./views/NewCollabQuest').then(m => ({ default: m.NewCollabQuest }))
);
const CollabQuestDetail = lazy(() =>
  import('./views/CollabQuestDetail').then(m => ({ default: m.CollabQuestDetail }))
);
const PressKitStudio = lazy(() =>
  import('./views/PressKitStudio').then(m => ({ default: m.PressKitStudio }))
);
const PublicPressKit = lazy(() =>
  import('./views/PublicPressKit').then(m => ({ default: m.PublicPressKit }))
);
const SceneRadar = lazy(() => import('./views/SceneRadar').then(m => ({ default: m.SceneRadar })));
const CollabSessionRoom = lazy(() =>
  import('./views/CollabSessionRoom').then(m => ({ default: m.CollabSessionRoom }))
);
const Spores = lazy(() => import('./views/Spores').then(m => ({ default: m.Spores })));
const LiveRituals = lazy(() =>
  import('./views/LiveRituals').then(m => ({ default: m.LiveRituals }))
);
const RitualReplay = lazy(() =>
  import('./views/RitualReplay').then(m => ({ default: m.RitualReplay }))
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
const Hub = lazy(() => import('./views/Hub').then(m => ({ default: m.Hub })));
const HelpCenter = lazy(() => import('./views/HelpCenter').then(m => ({ default: m.HelpCenter })));
const HelpArticle = lazy(() =>
  import('./views/HelpArticle').then(m => ({ default: m.HelpArticle }))
);
const Earnings = lazy(() => import('./views/Earnings').then(m => ({ default: m.Earnings })));
const MessagesPage = lazy(() =>
  import('./views/Messages').then(m => ({ default: m.MessagesPage }))
);
const MessageThreadPage = lazy(() =>
  import('./views/MessageThread').then(m => ({ default: m.MessageThreadPage }))
);
const SavedPage = lazy(() => import('./views/Saved').then(m => ({ default: m.SavedPage })));
// Phase 17 — Live Rooms & Events
const LiveRooms = lazy(() => import('./views/LiveRooms').then(m => ({ default: m.LiveRooms })));
const LiveRoomView = lazy(() => import('./views/LiveRoom').then(m => ({ default: m.LiveRoom })));
const EventsView = lazy(() => import('./views/Events').then(m => ({ default: m.Events })));
const EventDetailView = lazy(() =>
  import('./views/EventDetail').then(m => ({ default: m.EventDetail }))
);
const NewEventView = lazy(() => import('./views/NewEvent').then(m => ({ default: m.NewEvent })));
const EditEventView = lazy(() => import('./views/EditEvent').then(m => ({ default: m.EditEvent })));
// SessionFab is small and always available to authenticated users — not lazy-loaded
import { SessionFab } from './components/SessionFab';

function AnimatedRoutes() {
  return (
    <div className="page-enter">
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
        <Route path="/scenes" element={<Scenes />} />
        <Route path="/scene/:slug" element={<SceneDetail />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="/styleguide" element={<Styleguide />} />
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
          path="/mix/:id/analytics"
          element={
            <ProtectedRoute>
              <MixAnalyticsView />
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
        <Route path="/pricing" element={<PricingPage />} />
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
        <Route path="/ai-band" element={<AIBandIndex />} />
        <Route path="/ai-band/:slug" element={<AIBandDetail />} />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/verification"
          element={
            <ProtectedRoute>
              <AdminVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/moderation"
          element={
            <ProtectedRoute>
              <AdminModeration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/invites"
          element={
            <ProtectedRoute>
              <AdminInviteGenerator />
            </ProtectedRoute>
          }
        />
        <Route path="/embed/mix/:id" element={<EmbedMix />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/buzz/:id" element={<BuzzDetail />} />
        <Route
          path="/setup"
          element={
            <ProtectedRoute allowIncompleteProfile>
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
          path="/studio/avatar"
          element={
            <ProtectedRoute>
              <AvatarStudio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio/art"
          element={
            <ProtectedRoute>
              <ArtStudio />
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
          path="/session/:id/replay"
          element={
            <ProtectedRoute>
              <RitualReplay />
            </ProtectedRoute>
          }
        />
        <Route path="/rituals" element={<LiveRituals />} />
        {/* Spores are private to their turner and contributors (RLS), so the
            surface is signed-in only. */}
        <Route
          path="/spores"
          element={
            <ProtectedRoute>
              <Spores />
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
        {/* Help Center */}
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/help/:slug" element={<HelpArticle />} />
        {/* Phase 2 — Marketplace payouts */}
        <Route
          path="/earnings"
          element={
            <ProtectedRoute>
              <Earnings />
            </ProtectedRoute>
          }
        />
        {/* Phase 4 — Messaging */}
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:conversationId"
          element={
            <ProtectedRoute>
              <MessageThreadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/favorites"
          element={
            <ProtectedRoute>
              <SavedPage />
            </ProtectedRoute>
          }
        />
        {/* Phase 15 — Collab Quests */}
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/ai-band/agent/:slug" element={<AgentTracks />} />
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
        {/* Phase 17 — Live Rooms & Events */}
        <Route path="/live-rooms" element={<LiveRooms />} />
        <Route
          path="/live-rooms/:id"
          element={
            <ProtectedRoute>
              <LiveRoomView />
            </ProtectedRoute>
          }
        />
        <Route path="/events" element={<EventsView />} />
        <Route path="/events/:id" element={<EventDetailView />} />
        <Route
          path="/events/new"
          element={
            <ProtectedRoute>
              <NewEventView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/events/:id/edit"
          element={
            <ProtectedRoute>
              <EditEventView />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function RouteRecoveringRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname}>
      <AnimatedRoutes />
    </ErrorBoundary>
  );
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const allowedWhileIncomplete =
    location.pathname === '/setup' ||
    location.pathname.startsWith('/auth/') ||
    ['/privacy', '/terms', '/cookies'].includes(location.pathname);

  if (!loading && user && needsOnboarding(profile) && !allowedWhileIncomplete) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}

function shouldLoadVercelTelemetry() {
  if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return false;
  return !['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export default function App() {
  const loadVercelTelemetry = shouldLoadVercelTelemetry() && hasConsent('analytics');

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
