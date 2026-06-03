import SpotifyWebApi from 'spotify-web-api-node';

// Spotify API configuration
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  redirectUri:
    process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI ||
    `${process.env.NEXTAUTH_URL}/api/auth/callback/spotify`,
});

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    id: string;
    name: string;
  }>;
  album: {
    id: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  duration_ms: number;
  popularity: number;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  popularity: number;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
  owner: {
    id: string;
    display_name: string;
  };
  tracks: {
    total: number;
  };
}

// Spotify service
export const spotifyService = {
  // Initialize Spotify API with access token
  setAccessToken: (accessToken: string) => {
    spotifyApi.setAccessToken(accessToken);
  },

  // Get user profile
  getUserProfile: async () => {
    try {
      const response = await spotifyApi.getMe();
      return response.body;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  },

  // Get user's playlists
  getUserPlaylists: async (limit: number = 20, offset: number = 0) => {
    try {
      const response = await spotifyApi.getUserPlaylists({ limit, offset });
      return response.body;
    } catch (error) {
      console.error('Error getting user playlists:', error);
      throw error;
    }
  },

  // Get playlist tracks
  getPlaylistTracks: async (playlistId: string, limit: number = 100, offset: number = 0) => {
    try {
      const response = await spotifyApi.getPlaylistTracks(playlistId, { limit, offset });
      return response.body;
    } catch (error) {
      console.error('Error getting playlist tracks:', error);
      throw error;
    }
  },

  // Search for tracks
  searchTracks: async (query: string, limit: number = 20, offset: number = 0) => {
    try {
      const response = await spotifyApi.searchTracks(query, { limit, offset });
      return response.body.tracks;
    } catch (error) {
      console.error('Error searching tracks:', error);
      throw error;
    }
  },

  // Search for artists
  searchArtists: async (query: string, limit: number = 20, offset: number = 0) => {
    try {
      const response = await spotifyApi.searchArtists(query, { limit, offset });
      return response.body.artists;
    } catch (error) {
      console.error('Error searching artists:', error);
      throw error;
    }
  },

  // Search for albums
  searchAlbums: async (query: string, limit: number = 20, offset: number = 0) => {
    try {
      const response = await spotifyApi.searchAlbums(query, { limit, offset });
      return response.body.albums;
    } catch (error) {
      console.error('Error searching albums:', error);
      throw error;
    }
  },

  // Get track details
  getTrack: async (trackId: string) => {
    try {
      const response = await spotifyApi.getTrack(trackId);
      return response.body;
    } catch (error) {
      console.error('Error getting track:', error);
      throw error;
    }
  },

  // Get artist details
  getArtist: async (artistId: string) => {
    try {
      const response = await spotifyApi.getArtist(artistId);
      return response.body;
    } catch (error) {
      console.error('Error getting artist:', error);
      throw error;
    }
  },

  // Get artist albums
  getArtistAlbums: async (artistId: string, limit: number = 20, offset: number = 0) => {
    try {
      const response = await spotifyApi.getArtistAlbums(artistId, { limit, offset });
      return response.body;
    } catch (error) {
      console.error('Error getting artist albums:', error);
      throw error;
    }
  },

  // Get artist top tracks
  getArtistTopTracks: async (artistId: string, country: string = 'US') => {
    try {
      const response = await spotifyApi.getArtistTopTracks(artistId, { country });
      return response.body;
    } catch (error) {
      console.error('Error getting artist top tracks:', error);
      throw error;
    }
  },

  // Get album details
  getAlbum: async (albumId: string) => {
    try {
      const response = await spotifyApi.getAlbum(albumId);
      return response.body;
    } catch (error) {
      console.error('Error getting album:', error);
      throw error;
    }
  },

  // Get album tracks
  getAlbumTracks: async (albumId: string, limit: number = 50, offset: number = 0) => {
    try {
      const response = await spotifyApi.getAlbumTracks(albumId, { limit, offset });
      return response.body;
    } catch (error) {
      console.error('Error getting album tracks:', error);
      throw error;
    }
  },

  // Get recommendations
  getRecommendations: async (seedTracks: string[], limit: number = 20) => {
    try {
      const response = await spotifyApi.getRecommendations({
        seed_tracks: seedTracks,
        limit,
      });
      return response.body;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      throw error;
    }
  },

  // Get available genres for recommendations
  getAvailableGenres: async () => {
    try {
      const response = await spotifyApi.getAvailableGenreSeeds();
      return response.body;
    } catch (error) {
      console.error('Error getting available genres:', error);
      throw error;
    }
  },

  // Create playlist
  createPlaylist: async (
    userId: string,
    name: string,
    description: string = '',
    isPublic: boolean = true
  ) => {
    try {
      const response = await spotifyApi.createPlaylist(userId, name, {
        description,
        public: isPublic,
      });
      return response.body;
    } catch (error) {
      console.error('Error creating playlist:', error);
      throw error;
    }
  },

  // Add tracks to playlist
  addTracksToPlaylist: async (playlistId: string, trackUris: string[], position?: number) => {
    try {
      const response = await spotifyApi.addTracksToPlaylist(playlistId, trackUris, { position });
      return response.body;
    } catch (error) {
      console.error('Error adding tracks to playlist:', error);
      throw error;
    }
  },

  // Remove tracks from playlist
  removeTracksFromPlaylist: async (
    playlistId: string,
    trackPositions: Array<{ uri: string; positions: number[] }>
  ) => {
    try {
      const response = await spotifyApi.removeTracksFromPlaylist(playlistId, trackPositions);
      return response.body;
    } catch (error) {
      console.error('Error removing tracks from playlist:', error);
      throw error;
    }
  },

  // Get Spotify API instance
  getApi: () => spotifyApi,
};
