'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  artwork?: string;
  duration: number;
  waveform?: number[];
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
  playlist: Track[];
  currentIndex: number;
  repeatMode: 'off' | 'one' | 'all';
  shuffleMode: boolean;
}

interface PlayerContextType {
  state: PlayerState;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaylist: (tracks: Track[], index?: number) => void;
  addToPlaylist: (track: Track) => void;
  removeFromPlaylist: (index: number) => void;
  clearPlaylist: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  playTrack: (track: Track, playlist?: Track[]) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

interface PlayerProviderProps {
  children: ReactNode;
}

const initialState: PlayerState = {
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  isMuted: false,
  isLoading: false,
  playlist: [],
  currentIndex: 0,
  repeatMode: 'off',
  shuffleMode: false,
};

export function PlayerProvider({ children }: PlayerProviderProps) {
  const [state, setState] = useState<PlayerState>(initialState);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    };

    const handleLoadedMetadata = () => {
      setState(prev => ({ ...prev, duration: audio.duration, isLoading: false }));
    };

    const handleEnded = () => {
      if (state.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else if (state.repeatMode === 'all' || state.currentIndex < state.playlist.length - 1) {
        next();
      } else {
        setState(prev => ({ ...prev, isPlaying: false }));
      }
    };

    const handleError = () => {
      setState(prev => ({ ...prev, isLoading: false }));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.repeatMode, state.currentIndex, state.playlist]);

  const play = () => {
    if (audioRef.current && state.currentTrack) {
      audioRef.current.play();
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  const togglePlay = () => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const next = () => {
    if (state.playlist.length === 0) return;

    let nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.playlist.length) {
      nextIndex = 0;
    }

    if (state.shuffleMode) {
      nextIndex = Math.floor(Math.random() * state.playlist.length);
    }

    const nextTrack = state.playlist[nextIndex];
    playTrack(nextTrack, state.playlist);
  };

  const previous = () => {
    if (state.playlist.length === 0) return;

    let prevIndex = state.currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = state.playlist.length - 1;
    }

    const prevTrack = state.playlist[prevIndex];
    playTrack(prevTrack, state.playlist);
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const setVolume = (volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setState(prev => ({ ...prev, volume, isMuted: volume === 0 }));
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !state.isMuted;
    }
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const setPlaylist = (tracks: Track[], index = 0) => {
    setState(prev => ({
      ...prev,
      playlist: tracks,
      currentIndex: index,
      currentTrack: tracks[index] || null,
    }));
  };

  const addToPlaylist = (track: Track) => {
    setState(prev => ({
      ...prev,
      playlist: [...prev.playlist, track],
    }));
  };

  const removeFromPlaylist = (index: number) => {
    const newPlaylist = state.playlist.filter((_, i) => i !== index);
    setState(prev => ({
      ...prev,
      playlist: newPlaylist,
      currentIndex: Math.min(prev.currentIndex, newPlaylist.length - 1),
      currentTrack: newPlaylist[prev.currentIndex] || null,
    }));
  };

  const clearPlaylist = () => {
    setState(prev => ({
      ...prev,
      playlist: [],
      currentIndex: 0,
      currentTrack: null,
    }));
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  const toggleRepeat = () => {
    const modes: ('off' | 'one' | 'all')[] = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(state.repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setState(prev => ({ ...prev, repeatMode: nextMode }));
  };

  const toggleShuffle = () => {
    setState(prev => ({ ...prev, shuffleMode: !prev.shuffleMode }));
  };

  const playTrack = (track: Track, playlist?: Track[]) => {
    if (audioRef.current) {
      audioRef.current.src = track.url;
      audioRef.current.load();
      setState(prev => ({
        ...prev,
        currentTrack: track,
        isLoading: true,
        playlist: playlist || prev.playlist,
        currentIndex: playlist ? playlist.indexOf(track) : prev.currentIndex,
      }));

      // Auto-play if the user wants it
      setTimeout(() => play(), 100);
    }
  };

  const value: PlayerContextType = {
    state,
    play,
    pause,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    setPlaylist,
    addToPlaylist,
    removeFromPlaylist,
    clearPlaylist,
    toggleRepeat,
    toggleShuffle,
    playTrack,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* Hidden audio element */}
      <audio ref={audioRef} aria-label="Audio player">
        <track kind="captions" src="" label="No captions" />
      </audio>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
