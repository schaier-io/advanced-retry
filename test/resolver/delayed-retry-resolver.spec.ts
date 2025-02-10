import { advancedRetry, delayErrorResolver } from '../../src';

describe('delayedRetryErrorResolver', () => {
  // Basic retry behavior
  describe('basic retry behavior', () => {
    it('should retry operation when error resolver returns retry resolution', async () => {
      let attempts = 0;
      await advancedRetry({
        operation: () => {
          attempts++;
          throw new Error('test');
        },
        errorResolvers: [
          delayErrorResolver({
            configuration: {
              maxRetries: 1,
              initialDelayMs: 0,
              maxDelayMs: 0,
              backoffMultiplier: 0,
            },
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 10000,
      });
      expect(attempts).toBe(2); // Initial attempt + 1 retry
    });

    it('should not retry when error resolver cannot handle the error', async () => {
      let attempts = 0;
      await advancedRetry({
        operation: () => {
          attempts++;
          throw new Error('test');
        },
        errorResolvers: [
          delayErrorResolver({
            canHandleError: () => false,
            configuration: {
              maxRetries: 1,
              initialDelayMs: 0,
              maxDelayMs: 0,
              backoffMultiplier: 0,
            },
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 10000,
      });
      expect(attempts).toBe(1); // Only initial attempt
    });
  });

  // Delay configuration tests
  describe('delay configuration', () => {
    it('should handle negative initial delay', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          if (attempts === 1) {
            throw new Error('test');
          }
          return Promise.resolve();
        },
        errorResolvers: [
          delayErrorResolver({
            canHandleError: () => true,
            configuration: {
              maxRetries: 3,
              initialDelayMs: -100,
            },
          }),
        ],
        throwOnUnrecoveredError: false,
      });
      expect(attempts).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should handle maxDelay configuration', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          if (attempts === 1) {
            throw new Error('test');
          }
          return Promise.resolve();
        },
        errorResolvers: [
          delayErrorResolver({
            canHandleError: () => true,
            configuration: {
              maxRetries: 3,
              maxDelayMs: 100,
            },
          }),
        ],
        throwOnUnrecoveredError: false,
      });
      expect(attempts).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should work with minimal configuration (only maxRetries)', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          if (attempts === 1) {
            throw new Error('test');
          }
          return Promise.resolve();
        },
        errorResolvers: [
          delayErrorResolver({
            canHandleError: () => true,
            configuration: {
              maxRetries: 3,
            },
          }),
        ],
        throwOnUnrecoveredError: false,
      });
      expect(attempts).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should handle backoff multiplier configuration', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          if (attempts === 1) {
            throw new Error('test');
          }
          return Promise.resolve();
        },
        errorResolvers: [
          delayErrorResolver({
            canHandleError: () => true,
            configuration: {
              maxRetries: 3,
              initialDelayMs: -100,
              backoffMultiplier: 5,
            },
          }),
        ],
        throwOnUnrecoveredError: false,
      });
      expect(attempts).toBe(2);
      expect(result.success).toBe(true);
    });

    it('should handle negative custom delay function', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          if (attempts === 1) {
            throw new Error('test');
          }
          return Promise.resolve();
        },
        errorResolvers: [
          delayErrorResolver({
            canHandleError: () => true,
            configuration: {
              maxRetries: 3,
              customDelay: () => -500,
            },
          }),
        ],
        throwOnUnrecoveredError: false,
      });

      expect(attempts).toBe(2);
      expect(result.success).toBe(true);
      expect(result.totalAttempts).toBe(2);
      expect(result.totalAttemptsToSucceed).toBe(2);
    });

    it('should prioritize custom delay function over other delay settings', async () => {
      let attempts = 0;
      const timeoutId = setTimeout(() => {
        throw new Error('test');
      }, 10000);
      await advancedRetry({
        operation: () => {
          attempts++;
          throw new Error('test');
        },
        errorResolvers: [
          delayErrorResolver({
            canHandleError: () => true,
            configuration: {
              maxRetries: 3,
              initialDelayMs: 100000, // Very long delay
              maxDelayMs: 100000,
              backoffMultiplier: 0,
              customDelay: () => 25, // Short delay should be used instead
            },
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 10000,
      });
      clearTimeout(timeoutId);
      expect(attempts).toBe(4); // Initial attempt + 3 retries
    });
  });
});
