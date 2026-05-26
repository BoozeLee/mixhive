import { useState, useRef } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { BANNER_BUCKET } from '../lib/api'
import type { Profile } from '../lib/types'

interface ProfileBannerUploadProps {
  profile: Profile | null
  currentUserId: string
  onUploadComplete: (url: string) => void
  className?: string
}

export function ProfileBannerUpload({ 
  profile, 
  currentUserId, 
  onUploadComplete, 
  className = '' 
}: ProfileBannerUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!file || !currentUserId) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 10MB for banners)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase
    setUploading(true)
    try {
      if (!isSupabaseConfigured) {
        alert('Supabase is not configured')
        return
      }

      // Generate filename
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop()
      const filename = `${currentUserId}/banner_${timestamp}.${fileExtension}`

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from(BANNER_BUCKET)
        .upload(filename, file, {
          contentType: file.type,
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BANNER_BUCKET)
        .getPublicUrl(filename)

      // Update profile with new banner URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          banner_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUserId)

      if (updateError) {
        throw updateError
      }

      onUploadComplete(publicUrl)
      setPreviewUrl(null)
    } catch (error) {
      console.error('Error uploading profile banner:', error)
      alert('Failed to upload profile banner')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleClick = () => {
    if (!showUploadInterface || uploading) return
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  const showUploadInterface = profile?.id === currentUserId
  const currentBanner = profile?.banner_url || null

  return (
    <div className={`relative ${className}`}>
      <div
        role={showUploadInterface ? 'button' : undefined}
        tabIndex={showUploadInterface ? 0 : undefined}
        aria-label={showUploadInterface ? 'Upload profile banner' : undefined}
        className={`
          relative w-full h-48 rounded-lg overflow-hidden border-2
          ${dragActive ? 'border-blue-400' : 'border-gray-700'}
          transition-all duration-200
          ${showUploadInterface ? 'cursor-pointer hover:border-blue-500' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={showUploadInterface ? handleClick : undefined}
        onKeyDown={showUploadInterface ? handleKeyDown : undefined}
      >
        {currentBanner ? (
          <img
            src={currentBanner}
            alt="Profile Banner"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/50 via-blue-900/50 to-indigo-900/50 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-3xl mb-2">🎵</div>
              <div className="text-sm">Profile Banner</div>
            </div>
          </div>
        )}

        {showUploadInterface && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="text-center text-white">
              <div className="text-2xl mb-2">📷</div>
              <div className="text-sm">
                {uploading ? 'Uploading...' : 'Upload Banner'}
              </div>
            </div>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-white text-sm">Uploading banner...</div>
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
        <div className="mt-2 text-center">
          <p className="text-xs text-gray-400">
            Click to upload profile banner
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Recommended: 1200x400px
          </p>
        </div>
      )}
    </div>
  )
}
