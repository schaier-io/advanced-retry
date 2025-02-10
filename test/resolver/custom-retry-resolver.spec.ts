import { advancedRetry, customErrorResolver } from '../../src';
import {
  allErrorFilter,
  ErrorFilter,
  anyErrorFilter,
} from '../../src/filter/base';

describe('customRetryErrorResolver', () => {
  // Basic retry behavior
  describe('retry behavior', () => {
    it('should not retry when error resolver cannot handle the error', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('test');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => false,
            callback: (error, attempt, configuration, context) => {
              if (context) {
                expect(context.data).toBe('test');
              }
              if (attempt == 1) {
                expect(context).toBeUndefined();
              } else {
                expect(context).toBeDefined();
              }
              return Promise.resolve({
                context: { data: 'test' },
                remainingAttempts: configuration.maxRetries - attempt,
                unrecoverable: false,
              });
            },
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error?.message).toMatch('test');
      expect(occurrenceCount).toBe(1);
    });

    it('should retry specified number of times with Promise-based callback', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('test');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            callback: (error, attempt, configuration, context) => {
              if (context) {
                expect(context.data).toBe('test');
              }
              if (attempt == 0) {
                expect(context).toBeUndefined();
              } else {
                expect(context).toBeDefined();
              }
              return Promise.resolve({
                context: { data: 'test' },
                remainingAttempts: configuration.maxRetries - attempt,
                unrecoverable: false,
              });
            },
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error?.message).toMatch('test');
      expect(occurrenceCount).toBe(4); // Initial + 3 retries
    });

    it('should retry specified number of times with synchronous callback', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('test');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 2 },
            canHandleError: () => true,
            callback: (_, attempt, configuration) => ({
              context: undefined,
              remainingAttempts: configuration.maxRetries - attempt,
              unrecoverable: false,
            }),
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error?.message).toMatch('test');
      expect(occurrenceCount).toBe(3); // Initial + 2 retries
    });

    it('should retry with custom context data', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('abc1');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: (
              error,
              attempt,
              configuration,
              context?: { abc: string }
            ) => {
              if (context) {
                expect(context.abc).toBe('test');
              }
              if (attempt == 0) {
                expect(context).toBeUndefined();
              } else {
                expect(context).toBeDefined();
              }
              return Promise.resolve({
                context: { abc: 'test' },
                remainingAttempts: configuration.maxRetries - attempt,
                unrecoverable: false,
              });
            },
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error?.message).toMatch('abc1');
      expect(occurrenceCount).toBe(4);
    });
  });

  // Error handling and recovery
  describe('error handling', () => {
    it('should stop retrying when marked as unrecoverable', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('unrecoverable');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: () => ({
              context: undefined,
              remainingAttempts: 2,
              unrecoverable: true,
            }),
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error?.message).toMatch('unrecoverable');
      expect(occurrenceCount).toBe(1);
    });

    it('should throw error when throwOnUnrecoveredError is true', async () => {
      let occurrenceCount = 0;
      await expect(
        advancedRetry({
          operation: () => {
            occurrenceCount++;
            throw new Error('unhandled error');
          },
          errorResolvers: [
            customErrorResolver({
              configuration: { maxRetries: 3 },
              canHandleError: () => false,
              callback: () => ({
                context: undefined,
                remainingAttempts: 2,
                unrecoverable: false,
              }),
            }),
          ],
          throwOnUnrecoveredError: true,
          overallTimeout: 12000,
        })
      ).rejects.toThrow('unhandled error');
      expect(occurrenceCount).toBe(1);
    });

    it('should handle successful operation after retries', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          if (occurrenceCount < 3) {
            throw new Error('temporary error');
          }
          return 'success';
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: (_, attempt, configuration) => ({
              context: undefined,
              remainingAttempts: configuration.maxRetries - attempt,
              unrecoverable: false,
            }),
          }),
        ],
        throwOnUnrecoveredError: true,
        overallTimeout: 12000,
      });
      expect(result.result).toBe('success');
      expect(occurrenceCount).toBe(3);
    });

    it('should stop retrying when remainingAttempts is 0', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('no more attempts');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: () => ({
              context: undefined,
              remainingAttempts: 0,
              unrecoverable: false,
            }),
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error?.message).toMatch('no more attempts');
      expect(occurrenceCount).toBe(1);
    });
  });

  // Special cases and edge cases
  describe('special cases', () => {
    it('should handle operation timeout', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          return new Promise(resolve => setTimeout(resolve, 1000));
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: (_, attempt, configuration) => ({
              context: undefined,
              remainingAttempts: configuration.maxRetries - attempt,
              unrecoverable: false,
            }),
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 100,
      });
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toMatch('Operation timed out');
      expect(occurrenceCount).toBe(1);
    });

    it('should handle operation with no return value', async () => {
      let occurrenceCount = 0;
      await advancedRetry({
        operation: () => {
          occurrenceCount++;
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 2 },
            canHandleError: () => true,
            callback: (_, attempt, configuration, context) => ({
              remainingAttempts: configuration.maxRetries - attempt,
              unrecoverable: false,
              context: context,
            }),
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 10000,
      });
      expect(occurrenceCount).toBe(1);
    });

    it('should handle undefined context transitions', async () => {
      let occurrenceCount = 0;
      await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('testing');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: (_, attempt, configuration) => {
              if (attempt == 1) {
                return {
                  remainingAttempts: configuration.maxRetries - attempt,
                  unrecoverable: false,
                  context: undefined,
                };
              }
              if (attempt == 2) {
                return {
                  remainingAttempts: configuration.maxRetries - attempt,
                  unrecoverable: false,
                  context: { data: 'test' },
                };
              }
              return {
                remainingAttempts: configuration.maxRetries - attempt,
                unrecoverable: false,
                context: undefined,
              };
            },
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 10000,
      });
      expect(occurrenceCount).toBe(4);
    });

    it('should try multiple error resolvers until one handles the error', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('test-multiple');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => false,
            callback: () => ({
              context: undefined,
              remainingAttempts: 2,
              unrecoverable: false,
            }),
          }),
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: () => ({
              context: undefined,
              remainingAttempts: 0,
              unrecoverable: false,
            }),
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error?.message).toMatch('test-multiple');
      expect(occurrenceCount).toBe(1);
    });

    it('should handle non-Error throwables', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw 'string error';
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: () => ({
              context: undefined,
              remainingAttempts: 0,
              unrecoverable: false,
            }),
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error).toBe('string error');
      expect(occurrenceCount).toBe(1);
    });

    it('should handle empty error resolvers array', async () => {
      let occurrenceCount = 0;
      const result = await advancedRetry({
        operation: () => {
          occurrenceCount++;
          throw new Error('no-resolvers');
        },
        errorResolvers: [],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
      });
      expect(result.error?.message).toMatch('no-resolvers');
      expect(occurrenceCount).toBe(1);
    });

    it('should handle abort signal', async () => {
      let occurrenceCount = 0;
      const controller = new AbortController();
      const promise = advancedRetry({
        operation: async (retryContext, signal) => {
          occurrenceCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
          if (signal?.aborted) {
            throw new Error('aborted');
          }
          return 'success';
        },
        errorResolvers: [
          customErrorResolver<{ maxRetries: number }, undefined>({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: () => ({
              context: undefined,
              remainingAttempts: 2,
              unrecoverable: false,
            }),
          }),
        ],
        throwOnUnrecoveredError: false,
        overallTimeout: 12000,
        abortSignal: controller.signal,
      });
      controller.abort();
      const result = await promise;
      expect(result.error?.message).toMatch('aborted');
      expect(occurrenceCount).toBe(1);
    });
  });
});

describe('executeWithRetry with filters', () => {
  describe('error filtering', () => {
    it('should retry only when filter matches error', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          throw new Error('specific error');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: allErrorFilter([
              error => error instanceof Error,
              (error: unknown) =>
                error instanceof Error && error.message === 'specific error',
            ]).canHandleError,
            callback: (_, attempt, configuration) => ({
              context: undefined,
              remainingAttempts: configuration.maxRetries - attempt,
              unrecoverable: false,
            }),
          }),
        ],
      });

      expect(attempts).toBe(4); // Initial + 3 retries
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('specific error');
    });

    it('should not retry when filter does not match error', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          throw new Error('different error');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: allErrorFilter([
              error => error instanceof Error,
              (error: unknown) =>
                error instanceof Error && error.message === 'specific error',
            ]).canHandleError,
            callback: (_, attempt, configuration) => ({
              context: undefined,
              remainingAttempts: configuration.maxRetries - attempts,
              unrecoverable: false,
            }),
          }),
        ],
      });

      expect(attempts).toBe(1); // Only initial attempt
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('different error');
    });

    it('should handle multiple error filters with anyFilters', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          if (attempts === 1) throw new Error('first error');
          if (attempts === 2) throw new Error('second error');
          if (attempts === 3) return 'success';
          throw new Error('unexpected');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: anyErrorFilter([
              (error: unknown) =>
                error instanceof Error && error.message === 'first error',
              (error: unknown) =>
                error instanceof Error && error.message === 'second error',
            ]),
            callback: (_, attempt, configuration) => ({
              context: undefined,
              remainingAttempts: configuration.maxRetries - attempts,
              unrecoverable: false,
            }),
          }),
        ],
      });

      expect(attempts).toBe(3);
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });
    it('should handle complex nested filters', async () => {
      let attempts = 0;
      const errorFilter: ErrorFilter<any> = {
        canHandleError: (error: unknown) =>
          error instanceof Error && error.message.includes('retry'),
      };

      const result = await advancedRetry({
        operation: () => {
          attempts++;
          if (attempts <= 2) throw new Error('please retry');
          return 'success';
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 3 },
            canHandleError: allErrorFilter([
              error => error instanceof Error,
              anyErrorFilter([
                errorFilter,
                (error: unknown) =>
                  error instanceof Error && error.message === 'specific error',
              ]),
            ]),
            callback: (_, attempt, configuration) => ({
              context: undefined,
              remainingAttempts: configuration.maxRetries - attempt,
              unrecoverable: false,
            }),
          }),
        ],
      });

      expect(attempts).toBe(3);
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });
    it('should handle filters with context', async () => {
      let attempts = 0;
      const result = await advancedRetry({
        operation: () => {
          attempts++;
          throw new Error('retry with context');
        },
        errorResolvers: [
          customErrorResolver({
            configuration: { maxRetries: 2 },
            canHandleError: allErrorFilter([
              (error, attempt, context) => {
                if (attempt === 0) {
                  expect(context.data).toBeUndefined();
                } else {
                  expect(context.data).toEqual({ retryCount: attempt });
                }
                return true;
              },
            ]).canHandleError,
            callback: (_, attempt, configuration) => ({
              context: { retryCount: attempt + 1 },
              remainingAttempts: configuration.maxRetries - attempt,
              unrecoverable: false,
            }),
          }),
        ],
      });

      expect(attempts).toBe(3);
      expect(result.success).toBe(false);
    });
  });
});
