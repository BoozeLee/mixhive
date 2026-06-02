// Mock authentication for development/testing purposes
// This allows the app to work without a real Supabase instance

interface MockUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface MockProfile {
  id: string;
  username: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
}

const mockUsers: MockUser[] = [
  {
    id: 'mock-user-1',
    email: 'demo@mixhive.com',
    name: 'Demo User',
    avatar:
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
  },
];

const mockProfiles: MockProfile[] = [
  {
    id: 'mock-user-1',
    username: 'demo_user',
    bio: 'This is a demo profile for testing MixHive',
    avatar_url:
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
    created_at: new Date().toISOString(),
  },
];

let currentUser: MockUser | null = null;

export async function signInWithMock() {
  currentUser = mockUsers[0];
  return { user: currentUser, session: { user: currentUser, access_token: 'mock-token' } };
}

export async function signOutMock() {
  currentUser = null;
  return { error: null };
}

export function getCurrentUser() {
  return currentUser;
}

export function getMockProfile(userId: string) {
  return mockProfiles.find(p => p.id === userId);
}

export function isMockAuthConfigured() {
  return true; // Always available for mock auth
}
