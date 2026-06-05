import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB

function getCategory(mime: string): 'audio' | 'image' | 'video' | null {
  if (ALLOWED_AUDIO_TYPES.includes(mime)) return 'audio';
  if (ALLOWED_IMAGE_TYPES.includes(mime)) return 'image';
  if (ALLOWED_VIDEO_TYPES.includes(mime)) return 'video';
  return null;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { valid: false, error: 'Expected multipart/form-data' },
      { status: 400 }
    );
  }
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ valid: false, error: 'No file provided' }, { status: 400 });
    }

    const category = getCategory(file.type);
    if (!category) {
      return NextResponse.json(
        {
          valid: false,
          error: `Unsupported file type: ${file.type}`,
          allowedTypes: [...ALLOWED_AUDIO_TYPES, ...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES],
        },
        { status: 400 }
      );
    }

    let maxSize: number;
    switch (category) {
      case 'audio':
        maxSize = MAX_AUDIO_SIZE;
        break;
      case 'image':
        maxSize = MAX_IMAGE_SIZE;
        break;
      case 'video':
        maxSize = MAX_VIDEO_SIZE;
        break;
    }

    if (file.size > maxSize) {
      const maxMb = maxSize / 1024 / 1024;
      return NextResponse.json(
        {
          valid: false,
          error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${maxMb} MB for ${category}.`,
          category,
          maxSize,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      category,
      size: file.size,
      type: file.type,
      name: file.name,
    });
  } catch (err) {
    return NextResponse.json(
      { valid: false, error: err instanceof Error ? err.message : 'Validation failed' },
      { status: 500 }
    );
  }
}
