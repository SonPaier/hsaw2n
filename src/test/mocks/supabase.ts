import { vi } from 'vitest';

/**
 * Supabase mock for unit tests.
 * Each test can override specific behaviors using mockImplementation.
 * 
 * Usage:
 * ```ts
 * import { mockSupabaseQuery, mockSupabaseAuth, resetSupabaseMocks } from '@/test/mocks/supabase';
 * 
 * beforeEach(() => {
 *   resetSupabaseMocks();
 * });
 * 
 * it('should handle blocked user', () => {
 *   mockSupabaseQuery('profiles', { data: { is_blocked: true }, error: null });
 *   // ... test
 * });
 * ```
 */

// Store for mock responses
type MockResponse = {
  data: unknown;
  error: { message: string } | null;
};

const queryMocks: Record<string, MockResponse> = {};
const authMocks: Record<string, MockResponse> = {};

// Helper to set mock response for a table query
export const mockSupabaseQuery = (
  table: string,
  response: MockResponse,
  method: 'select' | 'insert' | 'update' | 'delete' = 'select'
) => {
  queryMocks[`${table}:${method}`] = response;
};

// Helper to set mock response for auth methods
export const mockSupabaseAuth = (
  method: 'signIn' | 'signOut' | 'getSession',
  response: MockResponse
) => {
  authMocks[method] = response;
};

// Reset all mocks between tests
export const resetSupabaseMocks = () => {
  Object.keys(queryMocks).forEach(key => delete queryMocks[key]);
  Object.keys(authMocks).forEach(key => delete authMocks[key]);
  
  // Set default responses
  queryMocks['instances:select'] = {
    data: {
      id: 'test-instance-id',
      name: 'Test Instance',
      slug: 'test',
      logo_url: null,
      primary_color: null,
      active: true,
    },
    error: null,
  };
};

// Create chainable query builder mock
const createQueryBuilder = (table: string) => {
  let currentMethod = 'select';
  
  const builder = {
    select: vi.fn().mockImplementation(() => {
      currentMethod = 'select';
      return builder;
    }),
    insert: vi.fn().mockImplementation(() => {
      currentMethod = 'insert';
      return builder;
    }),
    update: vi.fn().mockImplementation(() => {
      currentMethod = 'update';
      return builder;
    }),
    delete: vi.fn().mockImplementation(() => {
      currentMethod = 'delete';
      return builder;
    }),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      const key = `${table}:${currentMethod}`;
      return Promise.resolve(queryMocks[key] || { data: null, error: null });
    }),
    maybeSingle: vi.fn().mockImplementation(() => {
      const key = `${table}:${currentMethod}`;
      return Promise.resolve(queryMocks[key] || { data: null, error: null });
    }),
    then: (resolve: (value: MockResponse) => void) => {
      const key = `${table}:${currentMethod}`;
      resolve(queryMocks[key] || { data: [], error: null });
    },
  };
  
  return builder;
};

// Mock Supabase client
export const mockSupabase = {
  from: vi.fn().mockImplementation((table: string) => createQueryBuilder(table)),
  auth: {
    signInWithPassword: vi.fn().mockImplementation(async () => {
      return authMocks['signIn'] || { data: { user: null }, error: null };
    }),
    signOut: vi.fn().mockImplementation(async () => {
      return authMocks['signOut'] || { error: null };
    }),
    getSession: vi.fn().mockImplementation(async () => {
      return authMocks['getSession'] || { data: { session: null }, error: null };
    }),
    onAuthStateChange: vi.fn().mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.jpg' } }),
    }),
  },
};

// Default export for vi.mock
export default mockSupabase;
