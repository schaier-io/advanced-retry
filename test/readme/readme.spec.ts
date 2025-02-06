import {
  executeWithRetry,
  executeWithRetryAll,
  delayedRetryErrorResolver,
  customRetryErrorResolver,
  keywordFilterAny,
  allFilters,
} from '../../src/index';

describe('README Examples', () => {
  // Mock fetch for testing
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Usage', () => {
    it('should handle successful API call with retries', async () => {
      // Mock successful response after one failure
      mockFetch
        .mockRejectedValueOnce(new Error('API request failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: 'test' }),
        });

      const result = await executeWithRetry({
        operation: async () => {
          const response = await fetch('https://api.example.com/data');
          if (!response.ok) throw new Error('API request failed');
          return response.json();
        },
        errorResolvers: [
          delayedRetryErrorResolver({
            configuration: {
              maxRetries: 3,
              initialDelayMs: 100, // Reduced for testing
              maxDelayMs: 500,
              backoffMultiplier: 2,
            },
          }),
        ],
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'test' });
      expect(result.totalAttemptsToSucceed).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Filtering', () => {
    it('should retry only on specific network errors', async () => {
      class NetworkError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'NetworkError';
        }
      }

      mockFetch
        .mockRejectedValueOnce(new NetworkError('network timeout'))
        .mockResolvedValueOnce({ data: 'success' });

      const result = await executeWithRetry({
        operation: async () => {
          return await fetch('https://api.example.com/data');
        },
        errorResolvers: [
          customRetryErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: allFilters([
              keywordFilterAny(['network', 'timeout']),
              error => error instanceof NetworkError,
            ]),
            callback: (error, attempt, config) => ({
              remainingAttempts: config.maxRetries - attempt,
              unrecoverable: false,
              context: { lastError: error.message },
            }),
          }),
        ],
      });

      expect(result.success).toBe(true);
      expect(result.result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Context Passing', () => {
    it('should pass context between retry attempts', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Primary server failed'))
        .mockResolvedValueOnce({ text: () => Promise.resolve('success') });

      interface RetryContext {
        lastAttemptTime: number;
        serverUrl: string;
      }
      let attempt = 0;

      const result = await executeWithRetry<string, RetryContext>({
        operation: async context => {
          attempt++;
          const url = context?.data?.serverUrl ?? 'primary-server.com';
          if (attempt === 1) {
            expect(context?.data?.serverUrl).toBeUndefined();
            throw new Error('API request failed');
          } else {
            expect(context?.data?.serverUrl).toBe('backup-server.com');
          }
          const response = await fetch(`https://${url}/api`);
          return response.text();
        },
        errorResolvers: [
          customRetryErrorResolver<{ maxRetries: number }, RetryContext>({
            configuration: { maxRetries: 3 },
            callback: (error, attempt, config) => ({
              remainingAttempts: config.maxRetries - attempt,
              unrecoverable: false,
              context: {
                lastAttemptTime: Date.now(),
                serverUrl:
                  attempt > 0 ? 'backup-server.com' : 'primary-server.com',
              },
            }),
          }),
        ],
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Timeout and Abort Signal', () => {
    it('should handle abort signal', async () => {
      const controller = new AbortController();
      const fetch = mockFetch.mockResolvedValueOnce({
        json: () => Promise.reject({ data: 'data' }),
        ok: false,
      });

      const operationPromise = executeWithRetry({
        operation: async (context, signal) => {
          const response: {
            ok: boolean;
            json: () => Promise<{ data: string }>;
          } = await fetch('https://api.example.com/data', {
            signal,
          });
          if (!response.ok) throw new Error('API request failed');
          const json = await response.json();
          return { data: json.data };
        },
        errorResolvers: [
          delayedRetryErrorResolver({
            configuration: {
              maxRetries: 3,
              initialDelayMs: 1000,
              customDelay: ({ attempt }) =>
                Math.min(1000 * Math.pow(2, attempt), 5000),
            },
          }),
        ],
        overallTimeout: 1000,
        abortSignal: controller.signal,
      });

      controller.abort();

      const result = await operationPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.name).toBe('Error');
    });
  });

  describe('Multiple Parallel Operations', () => {
    it('should handle multiple operations in parallel', async () => {
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({ api: 1 }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ api: 2 }) });

      const results = await executeWithRetryAll({
        operations: [
          () => fetch('https://api1.example.com').then(r => r.json()),
          () => fetch('https://api2.example.com').then(r => r.json()),
        ],
        errorResolvers: [
          delayedRetryErrorResolver({
            configuration: {
              maxRetries: 3,
              initialDelayMs: 100,
              maxDelayMs: 500,
              backoffMultiplier: 2,
            },
          }),
        ],
        overallTimeout: 1000,
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].result).toEqual({ api: 1 });
      expect(results[1].success).toBe(true);
      expect(results[1].result).toEqual({ api: 2 });
    });
  });
});
