// Unified icon registry — the single source of truth for functional icons.
//
// Every tab, nav item, action, and feature marker references a key here instead
// of an ad-hoc unicode glyph or emoji. One icon set (lucide), one place to change.
// Brand identity (the bee mascot / wordmark) lives in src/components/brand/ —
// this file is strictly for functional UI iconography.

import {
  Rss,
  Compass,
  Search,
  UploadCloud,
  Calendar,
  Store,
  Swords,
  LayoutGrid,
  LayoutDashboard,
  Bot,
  Inbox,
  SlidersHorizontal,
  Radar,
  FileText,
  BookOpen,
  Bell,
  User,
  Settings,
  Music,
  Headphones,
  Heart,
  Repeat2,
  MessageCircle,
  Star,
  BadgeCheck,
  Package,
  Sparkles,
  AtSign,
  Home,
  Users,
  Crown,
  PlusCircle,
  Play,
  Share2,
  Disc3,
  Megaphone,
  Mic2,
  Image as ImageIcon,
  Wand2,
  Trophy,
  Network,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

export type IconKey =
  // navigation / features
  | 'home'
  | 'feed'
  | 'discover'
  | 'search'
  | 'network'
  | 'upload'
  | 'events'
  | 'market'
  | 'gear'
  | 'quests'
  | 'hub'
  | 'dashboard'
  | 'agents'
  | 'agentMarket'
  | 'inbox'
  | 'composer'
  | 'radar'
  | 'epk'
  | 'story'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'session'
  | 'mythic'
  // actions / content
  | 'buzz'
  | 'mix'
  | 'music'
  | 'headphones'
  | 'like'
  | 'repost'
  | 'comment'
  | 'mention'
  | 'share'
  | 'play'
  | 'star'
  | 'verified'
  | 'package'
  | 'sparkles'
  | 'visual'
  | 'organizer'
  | 'producer';

export const ICONS: Record<IconKey, LucideIcon> = {
  // navigation / features
  home: Home,
  feed: Rss,
  discover: Compass,
  search: Search,
  network: Users,
  upload: UploadCloud,
  events: Calendar,
  market: Store,
  gear: ShoppingBag,
  quests: Swords,
  hub: LayoutGrid,
  dashboard: LayoutDashboard,
  agents: Bot,
  agentMarket: Sparkles,
  inbox: Inbox,
  composer: SlidersHorizontal,
  radar: Radar,
  epk: FileText,
  story: BookOpen,
  notifications: Bell,
  profile: User,
  settings: Settings,
  session: Mic2,
  mythic: Network,
  // actions / content
  buzz: MessageCircle,
  mix: Disc3,
  music: Music,
  headphones: Headphones,
  like: Heart,
  repost: Repeat2,
  comment: MessageCircle,
  mention: AtSign,
  share: Share2,
  play: Play,
  star: Star,
  verified: BadgeCheck,
  package: Package,
  sparkles: Sparkles,
  visual: ImageIcon,
  organizer: Megaphone,
  producer: Wand2,
};

// Less-common one-offs that consumers may import directly when not worth a key.
export { Crown, PlusCircle, Trophy, Mic2 };
