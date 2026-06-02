import { spotifyService } from './spotify';

export interface SpotifyAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export const SpotifyAuthConfig: SpotifyAuthConfig = {
  clientId: process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  redirectUri: process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/auth/callback/spotify`,
  scopes: [
    'user-read-private',
    'user-read-email',
    'user-top-read',
    'user-read-recently-played',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-library-read',
    'user-library-modify',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-read-playback-position',
  ],
};

export const SpotifyAuth = {
  // Generate Spotify authorization URL
  getAuthorizationUrl: (state?: string): string => {
    const { clientId, redirectUri, scopes } = SpotifyAuthConfig;
    
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      show_dialog: 'false',
    });

    if (state) {
      params.append('state', state);
    }

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  },

  // Exchange authorization code for access token
  exchangeCodeForToken: async (code: string): Promise<{ access_token: string; refresh_token: string; expires_in: number }> => {
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: SpotifyAuthConfig.redirectUri,
          client_id: SpotifyAuthConfig.clientId,
          client_secret: SpotifyAuthConfig.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Spotify token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      };
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  },

  // Refresh access token
  refreshAccessToken: async (refreshToken: string): Promise<{ access_token: string; expires_in: number }> => {
    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: SpotifyAuthConfig.clientId,
          client_secret: SpotifyAuthConfig.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Spotify token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        access_token: data.access_token,
        expires_in: data.expires_in,
      };
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  },

  // Get user information with access token
  getUserInfo: async (accessToken: string) => {
    try {
      spotifyService.setAccessToken(accessToken);
      return await spotifyService.getUserProfile();
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  },

  // Validate access token
  validateToken: async (accessToken: string): Promise<boolean> => {
    try {
      spotifyService.setAccessToken(accessToken);
      await spotifyService.getUserProfile();
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  },

  // Format track information for display
  formatTrackInfo: (track: any) => {
    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist: any) => ({
        id: artist.id,
        name: artist.name,
      })),
      album: {
        id: track.album.id,
        name: track.album.name,
        images: track.album.images,
      },
      duration: track.duration_ms,
      popularity: track.popularity,
      url: track.external_urls.spotify,
      previewUrl: track.preview_url,
    };
  },

  // Format artist information for display
  formatArtistInfo: (artist: any) => {
    return {
      id: artist.id,
      name: artist.name,
      images: artist.images,
      popularity: artist.popularity,
      url: artist.external_urls.spotify,
      genres: artist.genres,
    };
  },

  // Format playlist information for display
  formatPlaylistInfo: (playlist: any) => {
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      images: playlist.images,
      externalUrl: playlist.external_urls.spotify,
      owner: {
        id: playlist.owner.id,
        name: playlist.owner.display_name,
      },
      tracks: {
        total: playlist.tracks.total,
      },
      isPublic: playlist.public,
      collaborative: playlist.collaborative,
    };
  },
};