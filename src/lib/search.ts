import { searchMixes, searchProfiles } from './api';
import type { FeedMix, Profile } from './types';

// Search types
export interface SearchFilters {
  genre?: string;
  tempo?: { min: number; max: number };
  duration?: { min: number; max: number };
  dateRange?: { start: string; end: string };
  explicit?: boolean;
  type: 'mixes' | 'profiles' | 'all';
}

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  filters?: SearchFilters;
}

export interface SearchSuggestion {
  type: 'mix' | 'profile' | 'genre';
  title: string;
  subtitle?: string;
  id?: string;
  imageUrl?: string;
}

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
  if (!query.trim()) return [];

  const suggestions: SearchSuggestion[] = [];

  try {
    // Get mix suggestions
    const mixes = await searchMixes(query);
    mixes.slice(0, 3).forEach(mix => {
      suggestions.push({
        type: 'mix',
        title: mix.title,
        subtitle: mix.dj_display_name || mix.dj_username,
        id: mix.id,
        imageUrl: mix.artwork_url || undefined,
      });
    });

    // Get profile suggestions
    const profiles = await searchProfiles(query);
    profiles.slice(0, 2).forEach(profile => {
      suggestions.push({
        type: 'profile',
        title: profile.display_name || profile.username,
        subtitle: `@${profile.username}`,
        id: profile.id,
        imageUrl: profile.avatar_url || undefined,
      });
    });

    // Add genre suggestions (hardcoded for now, could come from API)
    const genres = ['House', 'Techno', 'Deep House', 'Tech House', 'Trance'];
    genres
      .filter(genre => genre.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)
      .forEach(genre => {
        suggestions.push({
          type: 'genre',
          title: genre,
          subtitle: 'Browse mixes',
        });
      });

    return suggestions.slice(0, limit);
  } catch (error) {
    console.error('Failed to get search suggestions:', error);
    return [];
  }
}

// Enhanced search with filters
export async function enhancedSearch(
  query: string,
  filters?: SearchFilters,
  page = 1,
  limit = 20
): Promise<{
  mixes: FeedMix[];
  profiles: Profile[];
  total: number;
  hasMore: boolean;
}> {
  try {
    const results: { mixes: FeedMix[]; profiles: Profile[]; total: number; hasMore: boolean } = {
      mixes: [],
      profiles: [],
      total: 0,
      hasMore: false,
    };

    if (filters?.type === 'mixes' || filters?.type === 'all') {
      const mixResults = await searchMixes(query);
      results.mixes = applyFilters(mixResults, filters);
      results.total = results.mixes.length;
      results.hasMore = results.mixes.length >= limit * page;
    }

    if (filters?.type === 'profiles' || filters?.type === 'all') {
      const profileResults = await searchProfiles(query);
      results.profiles = applyProfileFilters(profileResults, filters);
      results.total += results.profiles.length;
      results.hasMore = results.profiles.length >= limit * page;
    }

    return results;
  } catch (error) {
    console.error('Failed to perform enhanced search:', error);
    return {
      mixes: [],
      profiles: [],
      total: 0,
      hasMore: false,
    };
  }
}

// Apply filters to search results
function applyFilters(mixes: FeedMix[], filters?: SearchFilters): FeedMix[] {
  if (!filters) return mixes;

  return mixes.filter(mix => {
    // Genre filter
    if (filters.genre && mix.genre_name !== filters.genre) {
      return false;
    }

    // Tempo filter (assuming tempo is available)
    if (filters.tempo) {
      // This would need tempo data from the API
      // For now, skip this filter
    }

    // Duration filter
    if (filters.duration && mix.duration_seconds) {
      const duration = mix.duration_seconds;
      if (duration < filters.duration.min || duration > filters.duration.max) {
        return false;
      }
    }

    // Explicit content filter
    if (filters.explicit !== undefined && mix.is_explicit !== filters.explicit) {
      return false;
    }

    return true;
  });
}

function applyProfileFilters(profiles: Profile[], filters?: SearchFilters): Profile[] {
  if (!filters) return profiles;

  return profiles.filter(profile => {
    // Genre filter for profiles
    if (filters.genre && !profile.genres.includes(filters.genre)) {
      return false;
    }

    return true;
  });
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
