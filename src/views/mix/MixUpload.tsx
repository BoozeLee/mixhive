'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth'; // Consolidated to main auth hook
import { useSupabase } from '@/lib/supabase-provider';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CDNOptimizedImage } from '@/components/CDNOptimizedImage';

interface Track {
  title: string;
  artist: string;
  duration: number;
}

export function MixUpload() {
  const { user } = useAuth();
  const { supabase } = useSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    genre: '',
    tags: '',
    isExplicit: false,
    artworkFile: null as File | null,
    audioFile: null as File | null,
    tracks: [] as Track[],
    isUploading: false,
    uploadProgress: 0,
    uploadStatus: '',
  });

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
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleArtworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        artworkFile: file,
      }));
    }
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate audio file
      if (!file.type.startsWith('audio/')) {
        alert('Please select an audio file');
        return;
      }

      // Extract track info from file (basic implementation)
      const track: Track = {
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        artist: 'Unknown Artist',
        duration: 0, // TODO: Get actual duration
      };

      setFormData(prev => ({
        ...prev,
        audioFile: file,
        tracks: [track],
      }));
    }
  };

  const generateWaveform = async (audioFile: File) => {
    // TODO: Implement waveform generation using Web Audio API
    // This is a placeholder implementation
    return new Array(100).fill(0).map(() => Math.random() * 100);
  };

  const uploadFile = async (file: File, path: string, onProgress: (progress: number) => void) => {
    if (!supabase) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
    const filePath = `${path}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('mix-audio').upload(filePath, file, {
      onUploadProgress: progress => {
        if (progress.total) {
          const progressPercent = Math.round((progress.loaded / progress.total) * 100);
          onProgress(progressPercent);
        }
      },
    });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from('mix-audio').getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.audioFile || !formData.title) {
      alert('Please fill in all required fields');
      return;
    }

    setFormData(prev => ({
      ...prev,
      isUploading: true,
      uploadProgress: 0,
      uploadStatus: 'Starting upload...',
    }));

    try {
      // Generate waveform
      const waveform = await generateWaveform(formData.audioFile);

      // Upload artwork if provided
      let artworkUrl = '';
      if (formData.artworkFile) {
        setFormData(prev => ({
          ...prev,
          uploadStatus: 'Uploading artwork...',
        }));

        artworkUrl = await uploadFile(formData.artworkFile, 'mix-artwork', progress =>
          setFormData(prev => ({ ...prev, uploadProgress: progress / 3 }))
        );
      }

      // Upload audio file
      setFormData(prev => ({
        ...prev,
        uploadStatus: 'Uploading audio...',
      }));

      const audioUrl = await uploadFile(formData.audioFile, 'mix-audio', progress =>
        setFormData(prev => ({
          ...prev,
          uploadProgress: progress / 3 + (formData.artworkFile ? 33 : 0),
        }))
      );

      // Upload waveform
      setFormData(prev => ({
        ...prev,
        uploadStatus: 'Uploading waveform...',
      }));

      const waveformBlob = new Blob([JSON.stringify(waveform)], { type: 'application/json' });
      const waveformFile = new File([waveformBlob], 'waveform.json', { type: 'application/json' });

      const waveformUrl = await uploadFile(waveformFile, 'mix-waveforms', progress =>
        setFormData(prev => ({
          ...prev,
          uploadProgress: progress / 3 + (formData.artworkFile ? 66 : 33),
        }))
      );

      // Save mix to database
      setFormData(prev => ({
        ...prev,
        uploadStatus: 'Saving to database...',
      }));

      const { error: dbError } = await supabase.from('mixes').insert({
        title: formData.title,
        description: formData.description,
        genre: formData.genre,
        tags: formData.tags.split(',').map(tag => tag.trim()),
        isExplicit: formData.isExplicit,
        artwork_url: artworkUrl,
        audio_url: audioUrl,
        waveform_url: waveformUrl,
        duration: formData.tracks[0]?.duration || 0,
        tracks: formData.tracks,
        user_id: user?.id,
        created_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      // Reset form
      setFormData(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: 100,
        uploadStatus: 'Upload complete!',
      }));

      // Redirect to mix page after a delay
      setTimeout(() => {
        window.location.href = '/feed';
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setFormData(prev => ({
        ...prev,
        isUploading: false,
        uploadStatus: 'Upload failed. Please try again.',
      }));
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-yellow-400 mb-2">Upload Your Mix</h1>
          <p className="text-gray-400">Share your music with the hive</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Audio Upload */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Audio File</h2>

            <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
              {formData.audioFile ? (
                <div className="space-y-4">
                  <div className="text-green-400 text-lg">✓ {formData.audioFile.name}</div>
                  <div className="text-gray-400">
                    Size: {(formData.audioFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, audioFile: null }));
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-4xl">🎵</div>
                  <div>
                    <label className="btn btn-primary cursor-pointer">
                      Choose Audio File
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-gray-400 text-sm">MP3, WAV, FLAC up to 200MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Artwork Upload */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Artwork</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Artwork (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleArtworkChange}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600"
                />
                <p className="text-gray-400 text-sm mt-2">JPG, PNG up to 10MB</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Preview</label>
                <div className="w-full h-48 bg-gray-800 border-2 border-gray-700 rounded-lg flex items-center justify-center">
                  {formData.artworkFile ? (
                    <CDNOptimizedImage
                      src={URL.createObjectURL(formData.artworkFile)}
                      alt="Artwork preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-gray-400 text-center">
                      <div className="text-4xl mb-2">🎨</div>
                      <p className="text-sm">No artwork selected</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mix Information */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Mix Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="Mix Title"
                  required
                />
              </div>

              <div>
                <label htmlFor="genre" className="block text-sm font-medium text-gray-300 mb-2">
                  Genre
                </label>
                <select
                  id="genre"
                  name="genre"
                  value={formData.genre}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="">Select genre</option>
                  {genres.map(genre => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="Tell us about this mix..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label htmlFor="tags" className="block text-sm font-medium text-gray-300 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isExplicit"
                  name="isExplicit"
                  checked={formData.isExplicit}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-yellow-400 bg-gray-800 border-gray-700 rounded focus:ring-yellow-400"
                />
                <label htmlFor="isExplicit" className="ml-2 text-sm text-gray-300">
                  Explicit Content
                </label>
              </div>
            </div>
          </div>

          {/* Upload Progress */}
          {formData.isUploading && (
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Uploading...</h2>

              <div className="space-y-4">
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${formData.uploadProgress}%` }}
                  ></div>
                </div>

                <p className="text-gray-400 text-center">{formData.uploadStatus}</p>

                {formData.uploadProgress === 100 && (
                  <div className="text-green-400 text-center">
                    ✓ Upload complete! Redirecting...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {formData.uploadStatus.includes('failed') && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-md">
              {formData.uploadStatus}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => (window.location.href = '/feed')}
              className="px-6 py-3 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.audioFile || !formData.title || formData.isUploading}
              className="px-6 py-3 btn btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formData.isUploading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <span>Upload Mix</span>
                  <span>🎵</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
