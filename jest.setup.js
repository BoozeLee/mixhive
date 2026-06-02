import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
    };
  },
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: props => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
        }),
        order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }),
      }),
      insert: () => ({ error: null }),
      update: () => ({ error: null }),
      delete: () => ({ error: null }),
      get: () => Promise.resolve({ data: null, error: null }),
    }),
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: { path: 'test' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'test' } }),
        download: () => Promise.resolve({ data: new Blob(), error: null }),
        remove: () => Promise.resolve({ error: null }),
        list: () => Promise.resolve({ data: [], error: null }),
      }),
    },
    realtime: {
      channel: () => ({
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        on: jest.fn(),
        send: jest.fn(),
      }),
    },
  }),
}));

// Mock window.matchMedia
if (typeof window !== 'undefined') Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock AudioContext
global.AudioContext = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;
