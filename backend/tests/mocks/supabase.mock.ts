import { vi } from 'vitest';

export const mockSupabaseResponse = <T>(data: T, error: null | { message: string } = null) => ({
  data,
  error,
});

export const createMockSupabaseClient = () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();

  const chainMethods = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockSupabaseResponse(null)),
  };

  mockFrom.mockReturnValue(chainMethods);

  return {
    from: mockFrom,
    rpc: mockRpc,
    _chainMethods: chainMethods,
    _mockFrom: mockFrom,
    _mockRpc: mockRpc,
  };
};

export const mockGetSupabase = vi.fn();
