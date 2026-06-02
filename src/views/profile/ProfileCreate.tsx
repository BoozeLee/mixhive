'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth'; // Consolidated to main auth hook
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function ProfileCreate() {
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: '',
    genre: '',
    genres: [] as string[],
    social_links: {
      instagram: '',
      twitter: '',
      soundcloud: '',
      website: '',
    },
    avatar_url: '',
    banner_url: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { user, supabase } = useAuth();
  const router = useRouter();

  const genres = [
    'Techno',
    'House',
    'Trance',
    'Drum & Bass',
    'Dubstep',
    'Ambient',
    'Electro',
    'Minimal',
    'Progressive',
    'Psytrance',
    'Hardstyle',
    'Future Bass',
    'Trap',
    'Hip Hop',
    'Experimental',
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      social_links: {
        ...prev.social_links,
        [platform]: value,
      },
    }));
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres(prev => {
      if (prev.includes(genre)) {
        return prev.filter(g => g !== genre);
      } else {
        return [...prev, genre];
      }
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('mix-artwork')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('mix-artwork').getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        avatar_url: publicUrl,
      }));
    } catch (err) {
      console.error('Avatar upload error:', err);
      setError('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('mix-artwork')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('mix-artwork').getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        banner_url: publicUrl,
      }));
    } catch (err) {
      console.error('Banner upload error:', err);
      setError('Failed to upload banner');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!user) throw new Error('User not authenticated');

      // Create profile in database
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        username: formData.username,
        display_name: formData.display_name,
        bio: formData.bio,
        genres: selectedGenres,
        social_links: formData.social_links,
        avatar_url: formData.avatar_url,
        banner_url: formData.banner_url,
        created_at: new Date().toISOString(),
      });

      if (profileError) throw profileError;

      // Update user metadata
      await supabase.auth.updateUser({
        data: {
          profile_complete: true,
          display_name: formData.display_name,
          username: formData.username,
        },
      });

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      console.error('Profile creation error:', err);
      setError('Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">Create Your DJ Profile</h1>
          <p className="text-gray-400">Tell the hive who you are and what you spin</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="dj_username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name *
                </label>
                <input
                  type="text"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Your DJ Name"
                  required
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Tell us about your style, influences, and what makes you unique..."
              />
            </div>
          </div>

          {/* Avatar and Banner Upload */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Profile Images</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Avatar</label>
                <div className="flex items-center space-x-4">
                  <div
                    className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center"
                    style={{
                      backgroundImage: formData.avatar_url ? `url(${formData.avatar_url})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!formData.avatar_url && <span className="text-gray-400">👤</span>}
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={isUploading}
                      className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600"
                    />
                    {isUploading && <LoadingSpinner size="sm" />}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Banner</label>
                <div className="flex items-center space-x-4">
                  <div
                    className="w-20 h-20 rounded bg-gray-800 border-2 border-gray-700 flex items-center justify-center"
                    style={{
                      backgroundImage: formData.banner_url ? `url(${formData.banner_url})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {!formData.banner_url && <span className="text-gray-400">🎵</span>}
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={isUploading}
                      className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600"
                    />
                    {isUploading && <LoadingSpinner size="sm" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Music Genres */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Music Genres</h2>
            <p className="text-gray-400 mb-4">Select the genres you represent (select multiple)</p>

            <div className="flex flex-wrap gap-2">
              {genres.map(genre => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedGenres.includes(genre)
                      ? 'bg-yellow-400 text-black'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            {selectedGenres.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-400">Selected: {selectedGenres.join(', ')}</p>
              </div>
            )}
          </div>

          {/* Social Links */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Social Links</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Instagram</label>
                <input
                  type="text"
                  value={formData.social_links.instagram}
                  onChange={e => handleSocialLinkChange('instagram', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="@username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Twitter</label>
                <input
                  type="text"
                  value={formData.social_links.twitter}
                  onChange={e => handleSocialLinkChange('twitter', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="@username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">SoundCloud</label>
                <input
                  type="text"
                  value={formData.social_links.soundcloud}
                  onChange={e => handleSocialLinkChange('soundcloud', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Website</label>
                <input
                  type="text"
                  value={formData.social_links.website}
                  onChange={e => handleSocialLinkChange('website', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 btn btn-primary flex items-center space-x-2"
            >
              {loading ? <LoadingSpinner size="sm" /> : null}
              <span>Create Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
