import type { FeedMix, Profile } from './types';

export type SearchEntityType = 'mixes' | 'profiles' | 'scenes' | 'agents' | 'all';

export interface SearchFilters {
  genre?: string;
  location?: string;
  type: SearchEntityType;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  filters?: SearchFilters;
}

export interface SearchSuggestion {
  type: 'mix' | 'profile' | 'scene' | 'genre';
  title: string;
  subtitle?: string;
  href?: string;
  imageUrl?: string;
}

export interface SceneSearchResult {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  genre: string | null;
  description: string | null;
  hero_image_url: string | null;
  relevance?: number;
}

export interface SearchSection<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface SearchResponse {
  query: string;
  type: SearchEntityType;
  filters: { genre?: string; location?: string };
  sections: {
    mixes: SearchSection<FeedMix>;
    profiles: SearchSection<Profile>;
    scenes: SearchSection<SceneSearchResult>;
  };
}

export const emptySearchResponse = (): SearchResponse => ({
  query: '',
  type: 'all',
  filters: {},
  sections: {
    mixes: { items: [], total: 0, hasMore: false },
    profiles: { items: [], total: 0, hasMore: false },
    scenes: { items: [], total: 0, hasMore: false },
  },
});

// Search history management (localStorage based)
const SEARCH_HISTORY_KEY = 'mixhive_search_history';
const MAX_HISTORY_ITEMS = 10;

export function getSearchHistory(): SearchHistoryItem[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addToSearchHistory(query: string, filters?: SearchFilters): void {
  try {
    const history = getSearchHistory();

    // Remove existing entry with same query
    const filtered = history.filter(item => item.query !== query);

    // Add new entry to beginning
    const newEntry: SearchHistoryItem = {
      query,
      timestamp: Date.now(),
      filters,
    };

    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save search history:', error);
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear search history:', error);
  }
}

// Search autocomplete suggestions
export async function getSearchSuggestions(query: string, limit = 5): Promise<SearchSuggestion[]> {
  if (query.trim().length < 2) return [];
  try {
    const results = await enhancedSearch(query, { type: 'all' }, 0, 4);
    return [
      ...results.sections.scenes.items.map(scene => ({
        type: 'scene' as const,
        title: scene.name,
        subtitle: [scene.city, scene.country, scene.genre].filter(Boolean).join(' · '),
        href: `/scene/${scene.slug}`,
        imageUrl: scene.hero_image_url || undefined,
      })),
      ...results.sections.profiles.items.map(profile => ({
        type: 'profile' as const,
        title: profile.display_name || profile.username,
        subtitle: `@${profile.username}`,
        href: `/u/${profile.username}`,
        imageUrl: profile.avatar_url || undefined,
      })),
      ...results.sections.mixes.items.map(mix => ({
        type: 'mix',
        title: mix.title,
        subtitle: mix.dj_display_name || mix.dj_username,
        href: `/mix/${mix.id}`,
        imageUrl: mix.artwork_url || undefined,
      })),
      ...['House', 'Techno', 'Deep House', 'Tech House', 'Trance']
        .filter(genre => genre.toLowerCase().includes(query.toLowerCase()))
        .map(
          genre =>
            ({
              type: 'genre',
              title: genre,
              subtitle: 'Browse mixes',
            }) as SearchSuggestion
        ),
    ].slice(0, limit);
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    return [];
  }
}

// Enhanced search with filters
export async function enhancedSearch(
  query: string,
  filters: SearchFilters = { type: 'all' },
  offset = 0,
  limit = 20
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query.trim(),
    type: filters.type,
    limit: String(limit),
    offset: String(offset),
  });
  if (filters.genre) params.set('genre', filters.genre);
  if (filters.location) params.set('location', filters.location);
  const response = await fetch(`/api/search?${params}`);
  const body = (await response.json()) as SearchResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Search failed');
  return body;
}

// Popular search queries (trending searches)
export function getPopularSearches(): string[] {
  // This could come from an API endpoint in the future
  return [
    'house',
    'techno',
    'deep house',
    'tech house',
    'trance',
    'drum and bass',
    'dubstep',
    'progressive',
    'minimal',
    'disco',
  ];
}

// Search analytics
export function trackSearch(query: string, filters?: SearchFilters, resultsCount = 0): void {
  try {
    void resultsCount;

    // Add to search history
    addToSearchHistory(query, filters);
  } catch (error) {
    console.error('Failed to track search:', error);
  }
}
