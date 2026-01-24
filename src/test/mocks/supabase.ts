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
const rpcMocks: Record<string, MockResponse> = {};

// Helper to set mock response for a table query
export const mockSupabaseQuery = (
  table: string,
  response: MockResponse,
  method: 'select' | 'insert' | 'update' | 'delete' = 'select'
) => {
  queryMocks[`${table}:${method}`] = response;
};

// Helper to set mock response for RPC calls
export const mockSupabaseRpc = (
  functionName: string,
  response: MockResponse
) => {
  rpcMocks[functionName] = response;
};

// Helper to set mock response for auth methods
export const mockSupabaseAuth = (
  method: 'signIn' | 'signOut' | 'getSession' | 'getUser',
  response: MockResponse
) => {
  authMocks[method] = response;
};

// Default mock data
export const defaultMockServices = [
  {
    id: 'svc-1',
    name: 'Mycie podstawowe',
    shortcut: 'MP',
    category_id: 'cat-1',
    duration_minutes: 30,
    duration_small: 25,
    duration_medium: 30,
    duration_large: 40,
    price_from: 50,
    price_small: 40,
    price_medium: 50,
    price_large: 70,
    station_type: 'washing',
    is_popular: true,
  },
  {
    id: 'svc-2',
    name: 'Polerowanie',
    shortcut: 'POL',
    category_id: 'cat-2',
    duration_minutes: 120,
    duration_small: 100,
    duration_medium: 120,
    duration_large: 150,
    price_from: 300,
    price_small: 250,
    price_medium: 300,
    price_large: 400,
    station_type: 'detailing',
    is_popular: false,
  },
];

export const defaultMockStations = [
  { id: 'sta-1', name: 'Stanowisko 1', type: 'washing' },
  { id: 'sta-2', name: 'Stanowisko 2', type: 'washing' },
];

export const defaultMockCategories = [
  { id: 'cat-1', name: 'Mycie', sort_order: 1, prices_are_net: false },
  { id: 'cat-2', name: 'Detailing', sort_order: 2, prices_are_net: true },
];

// Reset all mocks between tests
export const resetSupabaseMocks = () => {
  Object.keys(queryMocks).forEach(key => delete queryMocks[key]);
  Object.keys(authMocks).forEach(key => delete authMocks[key]);
  Object.keys(rpcMocks).forEach(key => delete rpcMocks[key]);
  
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
  
  queryMocks['services:select'] = {
    data: defaultMockServices,
    error: null,
  };
  
  queryMocks['stations:select'] = {
    data: defaultMockStations,
    error: null,
  };
  
  queryMocks['unified_categories:select'] = {
    data: defaultMockCategories,
    error: null,
  };
  
  queryMocks['customer_vehicles:select'] = {
    data: [],
    error: null,
  };
  
  queryMocks['customers:select'] = {
    data: [],
    error: null,
  };
  
  queryMocks['reservations:insert'] = {
    data: { id: 'new-res-id' },
    error: null,
  };
  
  queryMocks['reservations:update'] = {
    data: { id: 'updated-res-id' },
    error: null,
  };
  
  queryMocks['yard_vehicles:insert'] = {
    data: { id: 'new-yard-id' },
    error: null,
  };
  
  queryMocks['yard_vehicles:update'] = {
    data: { id: 'updated-yard-id' },
    error: null,
  };
  
  // Default RPC responses
  rpcMocks['get_availability_blocks'] = {
    data: [],
    error: null,
  };
  
  // Default auth responses
  authMocks['getUser'] = {
    data: { user: { id: 'test-user-id', email: 'test@example.com' } },
    error: null,
  };
  
  authMocks['getSession'] = {
    data: { session: null },
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
    upsert: vi.fn().mockImplementation(() => {
      currentMethod = 'insert';
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
    or: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
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
  rpc: vi.fn().mockImplementation((functionName: string) => {
    return Promise.resolve(rpcMocks[functionName] || { data: null, error: null });
  }),
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
    getUser: vi.fn().mockImplementation(async () => {
      return authMocks['getUser'] || { data: { user: null }, error: null };
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
