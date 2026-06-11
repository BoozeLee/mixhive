import { z } from 'zod';

const MixFormBaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(10000, 'Description too long').optional(),
  genre: z.string().min(1, 'Genre is required').or(z.literal('')),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed'),
  artworkFile: z
    .instanceof(File)
    .refine(
      file => file.size <= 10 * 1024 * 1024, // 10MB
      'Artwork must be less than 10MB'
    )
    .optional(),
  audioFile: z
    .instanceof(File)
    .refine(
      file => file.size <= 100 * 1024 * 1024, // 100MB
      'Audio must be less than 100MB'
    )
    .refine(file => {
      const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/aac', 'audio/ogg'];
      return allowedTypes.includes(file.type);
    }, 'Audio format not supported. Use MP3, WAV, AAC, or OGG.'),
  isPublic: z.boolean().default(true),
});

// Upload form schema
export const UploadSchema = MixFormBaseSchema.refine(data => data.genre !== '', {
  message: 'Genre is required',
  path: ['genre'],
});

// Edit mix schema (removes required audio file)
export const EditMixSchema = MixFormBaseSchema.omit({
  audioFile: true,
}).extend({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(10000, 'Description too long').optional(),
  genre: z.string().min(1, 'Genre is required'),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags allowed'),
});

// Profile update schema
export const ProfileSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(50, 'Display name too long'),
  bio: z.string().max(1000, 'Bio too long').optional(),
  location: z.string().max(100, 'Location too long').optional(),
  website: z.string().url('Invalid website URL').or(z.literal('')).optional(),
  genres: z.array(z.string()).max(20, 'Maximum 20 genres'),
  social_links: z.record(z.string(), z.string()).optional(),
});

export const OnboardingProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[A-Za-z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  displayName: z.string().trim().min(1, 'Display name is required').max(50, 'Display name too long'),
  avatarUrl: z.string().trim().url('Avatar is required'),
  bio: z.string().trim().min(1, 'Bio is required').max(1000, 'Bio too long'),
  genres: z.array(z.string()).min(1, 'Choose at least one genre').max(20, 'Maximum 20 genres'),
});

// Comment schema
export const CommentSchema = z.object({
  body: z
    .string()
    .min(1, 'Comment is required')
    .max(5000, 'Comment too long')
    .regex(/^[\s\S]*$/, 'Invalid characters in comment'), // Basic validation
  timestamp_seconds: z.number().min(0).optional(),
});

// Registration schema
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[A-Za-z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  display_name: z.string().min(1, 'Display name is required').max(50, 'Display name too long'),
});

// Login schema
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Search schema
export const SearchSchema = z.object({
  query: z.string().trim().min(2, 'Enter at least 2 characters').max(100, 'Search query too long'),
  type: z.enum(['mixes', 'profiles', 'scenes', 'all']).default('all'),
  genre: z.string().max(80).optional(),
  location: z.string().max(100).optional(),
});

// Playlist schema
export const PlaylistSchema = z.object({
  name: z.string().min(1, 'Playlist name is required').max(100, 'Playlist name too long'),
  description: z.string().max(10000, 'Description too long').optional(),
  is_public: z.boolean().default(true),
});

// Types inferred from schemas
export type UploadFormData = z.infer<typeof UploadSchema>;
export type EditMixFormData = z.infer<typeof EditMixSchema>;
export type ProfileFormData = z.infer<typeof ProfileSchema>;
export type CommentFormData = z.infer<typeof CommentSchema>;
export type RegisterFormData = z.infer<typeof RegisterSchema>;
export type LoginFormData = z.infer<typeof LoginSchema>;
export type SearchFormData = z.infer<typeof SearchSchema>;
export type PlaylistFormData = z.infer<typeof PlaylistSchema>;

// Utility function to handle form validation errors
export function formatZodError(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  error.issues.forEach(err => {
    if (err.path.length > 0) {
      const field = String(err.path[0]);
      errors[field] = err.message;
    }
  });

  return errors;
}
