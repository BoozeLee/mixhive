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
if (typeof window !== 'undefined')
  Object.defineProperty(window, 'matchMedia', {
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

// Mock IntersectionObserver / ResizeObserver.
//
// Both constructors used to be declared `constructor() {}`, taking no
// parameters and throwing the callback away. Two consequences: CodeQL reads
// the whole repo, resolves `new ResizeObserver(cb)` in component code against
// these stubs rather than the DOM types, and correctly reports a callback
// handed to a constructor that accepts nothing — which is what blocked #101.
//
// The bigger cost is silent: a discarded callback can never fire, so anything
// driven by one of these observers is inert under test and its logic goes
// unexercised while the suite still passes. Storing the callback and exposing
// a trigger keeps the stubs honest and lets a test drive them when it needs to.
class MockObserver {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Set();
  }
  observe(el) {
    this.elements.add(el);
  }
  unobserve(el) {
    this.elements.delete(el);
  }
  disconnect() {
    this.elements.clear();
  }
  /** Test helper — invoke the callback as the real observer would. */
  trigger(entries = []) {
    this.callback?.(entries, this);
  }
}

global.IntersectionObserver = MockObserver;
global.ResizeObserver = MockObserver;

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
