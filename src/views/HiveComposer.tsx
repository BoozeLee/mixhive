import { useState, useCallback, useReducer, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../components/ui/Icon';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';
import { ComposerCanvas, type TrackCell } from '../components/composer/ComposerCanvas';
import { ComposerAgentPanel } from '../components/composer/ComposerAgentPanel';
import type { Suggestion } from '../components/composer/SuggestionCell';

// Hive Composer — solo set builder at /composer
// Phase 11: localStorage autosave + drag-to-reorder.

interface ComposerState {
  tracks: TrackCell[];
  suggestions: Suggestion[];
  loadingSuggestions: boolean;
  dismissedIds: Set<string>;
  selectedId: string | undefined;
  suggestionError: string | null;
  showSearch: boolean;
  searchQuery: string;
  searchResults: TrackCell[];
  searching: boolean;
  saving: boolean;
  agentPanelVisible: boolean;
}

type ComposerAction =
  | { type: 'ADD_TRACK'; track: TrackCell }
  | { type: 'SET_SUGGESTIONS'; suggestions: Suggestion[] }
  | { type: 'SET_LOADING_SUGGESTIONS'; loading: boolean }
  | { type: 'SET_SUGGESTION_ERROR'; error: string | null }
  | { type: 'DISMISS_SUGGESTION'; mix_id: string }
  | { type: 'SELECT_TRACK'; mix_id: string }
  | { type: 'TOGGLE_SEARCH'; open: boolean }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SEARCH_RESULTS'; results: TrackCell[] }
  | { type: 'SET_SEARCHING'; searching: boolean }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'TOGGLE_AGENT_PANEL' }
  | { type: 'REORDER_TRACKS'; from: number; to: number }
  | { type: 'RESTORE_DRAFT'; tracks: TrackCell[] };

function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case 'ADD_TRACK':
      return {
        ...state,
        tracks: [...state.tracks, action.track],
        suggestions: [],
        dismissedIds: new Set(),
        showSearch: false,
        searchQuery: '',
        searchResults: [],
      };
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.suggestions, loadingSuggestions: false };
    case 'SET_LOADING_SUGGESTIONS':
      return { ...state, loadingSuggestions: action.loading };
    case 'SET_SUGGESTION_ERROR':
      return { ...state, suggestionError: action.error, loadingSuggestions: false };
    case 'DISMISS_SUGGESTION': {
      const next = new Set(state.dismissedIds);
      next.add(action.mix_id);
      return { ...state, dismissedIds: next };
    }
    case 'SELECT_TRACK':
      return { ...state, selectedId: action.mix_id };
    case 'TOGGLE_SEARCH':
      return { ...state, showSearch: action.open, searchQuery: '', searchResults: [] };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.results };
    case 'SET_SEARCHING':
      return { ...state, searching: action.searching };
    case 'SET_SAVING':
      return { ...state, saving: action.saving };
    case 'TOGGLE_AGENT_PANEL':
      return { ...state, agentPanelVisible: !state.agentPanelVisible };
    case 'REORDER_TRACKS': {
      const tracks = [...state.tracks];
      const [moved] = tracks.splice(action.from, 1);
      tracks.splice(action.to, 0, moved);
      return { ...state, tracks, suggestions: [], dismissedIds: new Set() };
    }
    case 'RESTORE_DRAFT':
      return { ...state, tracks: action.tracks };
    default:
      return state;
  }
}

const initialState: ComposerState = {
  tracks: [],
  suggestions: [],
  loadingSuggestions: false,
  dismissedIds: new Set(),
  selectedId: undefined,
  suggestionError: null,
  showSearch: false,
  searchQuery: '',
  searchResults: [],
  searching: false,
  saving: false,
  agentPanelVisible: false,
};

function draftKey(userId: string) {
  return `mh_composer_${userId}`;
}

export function HiveComposer() {
  const t = useTranslations('hiveComposer');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(composerReducer, initialState);
  const [setTitle, setSetTitle] = useState('');
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftRestored = useRef(false);
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [bpmRange, setBpmRange] = useState<[number, number] | null>(null);

  // Restore draft on mount (once, after user is known)
  useEffect(() => {
    if (!user || draftRestored.current) return;
    draftRestored.current = true;
    try {
      const raw = localStorage.getItem(draftKey(user.id));
      if (!raw) return;
      const { tracks, title } = JSON.parse(raw) as { tracks: TrackCell[]; title: string };
      if (tracks?.length > 0) {
        dispatch({ type: 'RESTORE_DRAFT', tracks });
        if (title) setSetTitle(title);
        setShowDraftBanner(true);
      }
    } catch {
      // corrupt draft — ignore
    }
  }, [user]);

  // Autosave on every track or title change
  useEffect(() => {
    if (!user) return;
    if (state.tracks.length === 0 && !setTitle) return;
    try {
      localStorage.setItem(
        draftKey(user.id),
        JSON.stringify({ tracks: state.tracks, title: setTitle })
      );
    } catch {
      // storage full — ignore
    }
  }, [state.tracks, setTitle, user]);

  const clearDraft = useCallback(() => {
    if (user) localStorage.removeItem(draftKey(user.id));
  }, [user]);

  const fetchSuggestions = useCallback(
    async (
      mixId: string,
      bpm: number | null,
      genre?: string | null,
      bpmOverride?: [number, number] | null
    ) => {
      dispatch({ type: 'SET_LOADING_SUGGESTIONS', loading: true });
      try {
        const body: Record<string, unknown> = { mix_id: mixId, k: 3 };
        const activeBpmRange = bpmOverride !== undefined ? bpmOverride : bpmRange;
        const activeGenre = genre !== undefined ? genre : genreFilter;
        if (activeBpmRange) {
          body.bpm_min = activeBpmRange[0];
          body.bpm_max = activeBpmRange[1];
        } else if (bpm) {
          body.bpm_min = Math.max(0, bpm - 10);
          body.bpm_max = bpm + 10;
        }
        if (activeGenre) body.genre_hint = activeGenre;
        const res = await fetch('/api/composer/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Suggestion API failed');
        const data = (await res.json()) as { suggestions: Suggestion[] };
        const filtered = (data.suggestions ?? []).filter(
          s => !state.tracks.some(t => t.mix_id === s.mix_id)
        );
        dispatch({ type: 'SET_SUGGESTIONS', suggestions: filtered });

        // Fire analytics event (best-effort; profile_id required by schema)
        if (user) {
          for (const s of filtered) {
            supabase
              .from('experiment_events')
              .insert({
                profile_id: user.id,
                event_type: 'vector_suggestion_shown',
                feature: 'hive_composer',
                variant: 'v1',
                properties: {
                  suggestion_mix_id: s.mix_id,
                  rank: filtered.indexOf(s),
                  similarity: s.similarity,
                },
              })
              .then(() => {});
          }
        }
      } catch {
        dispatch({ type: 'SET_SUGGESTION_ERROR', error: 'Could not load suggestions' });
      }
    },
    [state.tracks, user, bpmRange, genreFilter]
  );

  // Derive filter chips from the last track after each ADD_TRACK
  useEffect(() => {
    const tail = state.tracks[state.tracks.length - 1];
    if (!tail) return;
    if (tail.genre) setGenreFilter(tail.genre);
    if (tail.bpm) setBpmRange([Math.max(0, tail.bpm - 10), tail.bpm + 10]);
  }, [state.tracks.length]);

  const handleAddTrack = useCallback(() => {
    dispatch({ type: 'TOGGLE_SEARCH', open: true });
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', query });
    if (!query.trim() || query.length < 2) {
      dispatch({ type: 'SET_SEARCH_RESULTS', results: [] });
      return;
    }
    dispatch({ type: 'SET_SEARCHING', searching: true });
    const { data } = await supabase
      .from('mixes')
      .select('id, title, user_id, genre, profiles(username, display_name)')
      .ilike('title', `%${query}%`)
      .eq('is_published', true)
      .limit(8);

    const results: TrackCell[] = (data ?? []).map((m: Record<string, unknown>) => {
      const prof = m.profiles as Record<string, unknown> | null;
      return {
        mix_id: m.id as string,
        title: m.title as string,
        artist: (prof?.username ?? prof?.display_name ?? 'Unknown') as string,
        genre: (m.genre ?? null) as string | null,
        bpm: null,
        key_camelot: null,
      };
    });
    dispatch({ type: 'SET_SEARCH_RESULTS', results });
    dispatch({ type: 'SET_SEARCHING', searching: false });
  }, []);

  const handleSelectFromSearch = useCallback(
    (track: TrackCell) => {
      dispatch({ type: 'ADD_TRACK', track });
      fetchSuggestions(track.mix_id, track.bpm);
    },
    [fetchSuggestions]
  );

  const handleAcceptSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const track: TrackCell = {
        mix_id: suggestion.mix_id,
        title: suggestion.title,
        artist: suggestion.artist,
        genre: suggestion.genre,
        bpm: suggestion.bpm,
      };
      dispatch({ type: 'ADD_TRACK', track });
      fetchSuggestions(suggestion.mix_id, suggestion.bpm);

      if (user) {
        supabase
          .from('experiment_events')
          .insert({
            profile_id: user.id,
            event_type: 'vector_suggestion_added_to_set',
            feature: 'hive_composer',
            variant: 'v1',
            properties: { mix_id: suggestion.mix_id, similarity: suggestion.similarity },
          })
          .then(() => {});
      }
    },
    [fetchSuggestions, user]
  );

  const handleDismissSuggestion = useCallback(
    (mix_id: string) => {
      dispatch({ type: 'DISMISS_SUGGESTION', mix_id });
      if (user) {
        supabase
          .from('experiment_events')
          .insert({
            profile_id: user.id,
            event_type: 'vector_suggestion_dismissed',
            feature: 'hive_composer',
            variant: 'v1',
            properties: { mix_id },
          })
          .then(() => {});
      }
    },
    [user]
  );

  const handleReorder = useCallback(
    (from: number, to: number) => {
      dispatch({ type: 'REORDER_TRACKS', from, to });
      // Re-fetch suggestions for the new tail track
      const newTracks = [...state.tracks];
      const [moved] = newTracks.splice(from, 1);
      newTracks.splice(to, 0, moved);
      const tail = newTracks[newTracks.length - 1];
      if (tail) fetchSuggestions(tail.mix_id, tail.bpm);
    },
    [state.tracks, fetchSuggestions]
  );

  const handleSave = useCallback(async () => {
    if (!user || state.tracks.length === 0) return;
    dispatch({ type: 'SET_SAVING', saving: true });

    try {
      const title = setTitle.trim() || `Set — ${new Date().toLocaleDateString()}`;
      const { data: playlist, error: plErr } = await supabase
        .from('playlists')
        .insert({ owner_id: user.id, title, description: '' })
        .select('id')
        .single();

      if (plErr || !playlist) throw plErr ?? new Error('Playlist insert failed');

      const junctions = state.tracks.map((t, i) => ({
        playlist_id: playlist.id as string,
        mix_id: t.mix_id,
        position: i + 1,
        added_by: user.id,
      }));

      await supabase.from('playlist_mixes').insert(junctions);
      clearDraft();
      toast.success(t('setSavedAsPlaylist'));
      navigate(`/profile/${user.id}`);
    } catch {
      toast.error(t('failedToSaveSet'));
    } finally {
      dispatch({ type: 'SET_SAVING', saving: false });
    }
  }, [user, state.tracks, setTitle, navigate, clearDraft]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: colors.bg,
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[8],
          padding: `${space[6]}px ${space[10]}px`,
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          flexShrink: 0,
        }}
      >
        <span style={{ display: 'inline-flex' }}>
          <Icon name="composer" size={18} />
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: colors.text.primary,
          }}
        >
          {t('hiveComposer')}
        </h1>

        <input
          type="text"
          placeholder={t('setTitle')}
          value={setTitle}
          onChange={e => setSetTitle(e.target.value)}
          style={{
            flex: 1,
            maxWidth: 280,
            padding: `${space[4]}px ${space[6]}px`,
            background: colors.surfaceHover,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            color: colors.text.primary,
            fontSize: fontSize.sm,
            outline: 'none',
          }}
        />

        <div style={{ marginLeft: 'auto', display: 'flex', gap: space[6] }}>
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_AGENT_PANEL' })}
            style={{
              padding: `${space[4]}px ${space[8]}px`,
              background: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              color: colors.text.muted,
              fontSize: fontSize.sm,
              cursor: 'pointer',
            }}
          >
            {t('agentPanel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={state.tracks.length === 0 || state.saving}
            style={{
              padding: `${space[4]}px ${space[10]}px`,
              background: state.tracks.length > 0 ? colors.accent : colors.surface,
              border: `1px solid ${state.tracks.length > 0 ? colors.accent : colors.border}`,
              borderRadius: radius.md,
              color: state.tracks.length > 0 ? colors.bg : colors.text.dim,
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              cursor: state.tracks.length > 0 && !state.saving ? 'pointer' : 'default',
            }}
          >
            {state.saving ? t('saving') : t('saveSet')}
          </button>
        </div>
      </div>

      {/* Draft restore banner */}
      {showDraftBanner && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[6],
            padding: `${space[4]}px ${space[10]}px`,
            background: `${colors.accent}14`,
            borderBottom: `1px solid ${colors.accent}40`,
            fontSize: fontSize.sm,
            color: colors.accent,
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="composer" size={14} /> {t('draftRestored')}
          </span>
          <button
            type="button"
            onClick={() => setShowDraftBanner(false)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: colors.text.muted,
              cursor: 'pointer',
              fontSize: fontSize.sm,
            }}
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Filter chips */}
      {state.tracks.length > 0 && (genreFilter || bpmRange) && (
        <div
          style={{
            display: 'flex',
            gap: space[4],
            padding: `${space[4]}px ${space[10]}px`,
            borderBottom: `1px solid ${colors.border}`,
            flexShrink: 0,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: fontSize.xs, color: colors.text.dim }}>{t('filtering')}</span>
          {genreFilter && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => {
                setGenreFilter(null);
                const tail = state.tracks[state.tracks.length - 1];
                if (tail) fetchSuggestions(tail.mix_id, tail.bpm, null, bpmRange);
              }}
            >
              Genre: {genreFilter} ×
            </button>
          )}
          {bpmRange && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => {
                setBpmRange(null);
                const tail = state.tracks[state.tracks.length - 1];
                if (tail) fetchSuggestions(tail.mix_id, tail.bpm, genreFilter, null);
              }}
            >
              {bpmRange[0]}–{bpmRange[1]} BPM ×
            </button>
          )}
        </div>
      )}

      {/* Suggestion error */}
      {state.suggestionError && (
        <div
          style={{
            background: colors.dangerBg,
            color: colors.danger,
            padding: '8px 16px',
            fontSize: 13,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          {state.suggestionError}
        </div>
      )}

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Canvas */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {state.tracks.length === 0 && (
            <div
              style={{
                padding: `${space[11]}px`,
                textAlign: 'center',
                color: colors.text.dim,
                fontSize: fontSize.md,
              }}
            >
              {t('startNewSet')}
            </div>
          )}
          <ComposerCanvas
            tracks={state.tracks}
            suggestions={state.suggestions}
            loadingSuggestions={state.loadingSuggestions}
            dismissedIds={state.dismissedIds}
            selectedId={state.selectedId}
            onAddTrack={handleAddTrack}
            onSelectTrack={id => dispatch({ type: 'SELECT_TRACK', mix_id: id })}
            onAcceptSuggestion={handleAcceptSuggestion}
            onDismissSuggestion={handleDismissSuggestion}
            onReorder={handleReorder}
          />
        </div>

        {/* Agent panel */}
        <ComposerAgentPanel tracks={state.tracks} visible={state.agentPanelVisible} />
      </div>

      {/* Search modal */}
      {state.showSearch && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Pointer backdrop dismissal only; keyboard users dismiss via the explicit Close control.
        <div
          role="dialog"
          aria-label={t('searchForAMix')}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: space[10],
          }}
          onClick={e => {
            if (e.target === e.currentTarget) dispatch({ type: 'TOGGLE_SEARCH', open: false });
          }}
        >
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              width: '100%',
              maxWidth: 480,
              padding: space[10],
              display: 'flex',
              flexDirection: 'column',
              gap: space[8],
            }}
          >
            <input
              type="text"
              placeholder={t('searchMixes')}
              value={state.searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{
                padding: `${space[6]}px ${space[8]}px`,
                background: colors.surfaceHover,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.md,
                color: colors.text.primary,
                fontSize: fontSize.md,
                outline: 'none',
              }}
            />
            {state.searching && (
              <p style={{ color: colors.text.muted, fontSize: fontSize.sm, margin: 0 }}>
                {t('searching')}
              </p>
            )}
            {state.searchResults.length > 0 && (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {state.searchResults.map(r => (
                  <li key={r.mix_id}>
                    <button
                      type="button"
                      onClick={() => handleSelectFromSearch(r)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: `${space[6]}px ${space[8]}px`,
                        background: 'transparent',
                        border: `1px solid ${colors.border}`,
                        borderRadius: radius.md,
                        color: colors.text.primary,
                        fontSize: fontSize.sm,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontWeight: fontWeight.semibold }}>{r.title}</span>
                      <span style={{ color: colors.text.muted }}> · {r.artist}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!state.searching &&
              state.searchQuery.length > 1 &&
              state.searchResults.length === 0 && (
                <p style={{ color: colors.text.dim, fontSize: fontSize.sm, margin: 0 }}>
                  {t('noMixesFound')}
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
