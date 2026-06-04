import { useState, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Icon } from './ui/Icon';
import { AVATAR_BUCKET } from '../lib/api';
import type { Profile } from '../lib/types';

interface ProfilePictureUploadProps {
  profile: Profile | null;
  currentUserId: string;
  onUploadComplete: (url: string) => void;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

const sizeClasses = {
  small: 'w-16 h-16 text-sm',
  medium: 'w-24 h-24 text-base',
  large: 'w-32 h-32 text-lg',
};

export function ProfilePictureUpload({
  profile,
  currentUserId,
  onUploadComplete,
  className = '',
  size = 'medium',
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file || !currentUserId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = e => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase
    setUploading(true);
    try {
      if (!isSupabaseConfigured) {
        alert('Supabase is not configured');
        return;
      }

      // Generate filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop();
      const filename = `${currentUserId}/avatar_${timestamp}.${fileExtension}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filename, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filename);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUserId);

      if (updateError) {
        throw updateError;
      }

      onUploadComplete(publicUrl);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    if (!showUploadInterface || uploading) return;
    fileInputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const currentAvatar = profile?.avatar_url || null;
  const showUploadInterface = profile?.id === currentUserId;

  return (
    <div className={`relative ${className}`}>
      <div
        role={showUploadInterface ? 'button' : undefined}
        tabIndex={showUploadInterface ? 0 : undefined}
        aria-label={showUploadInterface ? 'Upload profile picture' : undefined}
        className={`
          relative rounded-full overflow-hidden border-2
          ${dragActive ? 'border-blue-400 bg-blue-50/10' : 'border-gray-700'}
          ${sizeClasses[size]}
          transition-all duration-200
          flex items-center justify-center
          bg-gradient-to-br from-gray-800 to-gray-900
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={showUploadInterface ? handleClick : undefined}
        onKeyDown={showUploadInterface ? handleKeyDown : undefined}
        style={{ cursor: showUploadInterface ? 'pointer' : 'default' }}
      >
        {currentAvatar ? (
          <img
            src={currentAvatar}
            alt="Profile"
            className="w-full h-full object-cover"
            onError={e => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <div className="text-gray-400" style={{display:"inline-flex"}}><Icon name="headphones" size={20} /></div>
        )}

        {showUploadInterface && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="text-center text-white">
              <div className="mb-1" style={{display:"inline-flex"}}><Icon name="camera" size={18} /></div>
              <div className="text-xs">{uploading ? 'Uploading...' : 'Change'}</div>
            </div>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-white text-sm">Uploading...</div>
          </div>
        )}
      </div>

      {previewUrl && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
          ✓
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={uploading}
      />

      {showUploadInterface && !uploading && (
        <div className="absolute -bottom-8 left-0 right-0 text-center">
          <p className="text-xs text-gray-400">Click to upload profile picture</p>
        </div>
      )}
    </div>
  );
}
