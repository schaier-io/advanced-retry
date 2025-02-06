import {
  abortSignalAny,
  customRetryErrorResolver,
  delayedRetryErrorResolver,
  executeWithRetry,
  executeWithRetryAll,
} from '../src';

describe('executeWithRetry', () => {
  // Basic successful operations
  describe('successful operations', () => {
    it('should execute operation once and return result when successful', async () => {
      let executionCount = 0;
      const result = await executeWithRetry({
        operation: () => {
          executionCount++;
          return Promise.resolve(42);
        },
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
      expect(executionCount).toBe(1);
      expect(result.totalAttemptsToSucceed).toBe(1);
    });

    it('should handle undefined return value as successful', async () => {
      const result = await executeWithRetry({
        operation: () => undefined,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeUndefined();
      expect(result.totalAttemptsToSucceed).toBe(1);
    });

    it('should pass error context to operation', async () => {
      let count = 0;
      const result = await executeWithRetry({
        operation: c => {
          count++;
          if (count > 1) {
            expect(c?.data).toMatch('url');
            return Promise.resolve('success');
          } else {
            expect(c?.data).toBeUndefined();
          }
          throw new Error('test');
        },
        errorResolvers: [
          customRetryErrorResolver<{ maxRetries: number }, string>({
            configuration: { maxRetries: 3 },
            canHandleError: () => true,
            callback: (error, attempt, configuration) => {
              expect(error).toBeInstanceOf(Error);
              expect(error.message).toMatch('test');
              return {
                context: 'url',
                remainingAttempts: configuration.maxRetries - attempt,
                unrecoverable: false,
              };
            },
          }),
        ],
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.totalAttemptsToSucceed).toBe(2);
    });
  });

  // Error handling and retry behavior
  describe('error handling and retries', () => {
    it('should return error details without retrying when no error resolver is provided', async () => {
      let executionCount = 0;
      const error = new Error('test error');
      const result = await executeWithRetry({
        operation: () => {
          executionCount++;
          throw error;
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.totalAttemptsToSucceed).toBeUndefined();
      expect(result.totalAttempts).toBe(1);
      expect(executionCount).toBe(1);
    });

    it('should throw original error when throwOnUnrecoveredError is true', async () => {
      await expect(
        executeWithRetry({
          operation: () => {
            throw new Error('test error');
          },
          throwOnUnrecoveredError: true,
        })
      ).rejects.toThrow('test error');
    });

    it('should retry until success when error resolver is provided', async () => {
      let attempts = 0;
      const result = await executeWithRetry({
        operation: () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('retry');
          }
          return Promise.resolve('success');
        },
        errorResolvers: [
          delayedRetryErrorResolver({
            configuration: {
              maxRetries: 5,
              initialDelayMs: 10,
              maxDelayMs: 100,
              backoffMultiplier: 2,
            },
          }),
        ],
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(attempts).toBe(3);
      expect(result.totalAttemptsToSucceed).toBe(3);
    });

    it('should handle non-Error throws', async () => {
      const result = await executeWithRetry({
        operation: () => {
          throw 'string error';
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle promise rejection with non-Error values', async () => {
      const result = await executeWithRetry({
        operation: () => Promise.reject('rejected'),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('rejected');
    });
  });

  // Timeout handling
  describe('timeout handling', () => {
    it('should succeed when operation completes within timeout', async () => {
      const result = await executeWithRetry({
        operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 'success';
        },
        overallTimeout: 100,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });

    it('should fail when operation exceeds timeout', async () => {
      await expect(
        executeWithRetry({
          operation: async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return 'success';
          },
          overallTimeout: 50,
          throwOnUnrecoveredError: true,
        })
      ).rejects.toThrow('Operation timed out');
    });

    it('should cleanup timeout abort controller after completion', async () => {
      const listeners = new Set<EventListener>();

      // Mock addEventListener to track listeners
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const originalAddEventListener = AbortSignal.prototype.addEventListener;
      AbortSignal.prototype.addEventListener = function (
        this: AbortSignal,
        type: string,
        listener: EventListener
      ): void {
        listeners.add(listener);
        originalAddEventListener.call(this, type, listener);
      };

      // Mock removeEventListener to track removals
      const originalRemoveEventListener =
        // eslint-disable-next-line @typescript-eslint/unbound-method
        AbortSignal.prototype.removeEventListener;
      AbortSignal.prototype.removeEventListener = function (
        this: AbortSignal,
        type: string,
        listener: EventListener
      ): void {
        listeners.delete(listener);
        originalRemoveEventListener.call(this, type, listener);
      };

      try {
        await executeWithRetry({
          operation: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return 'success';
          },
          overallTimeout: 100,
        });

        // Give a small delay for cleanup
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(listeners.size).toBe(0);
      } finally {
        // Restore original methods
        AbortSignal.prototype.addEventListener = originalAddEventListener;
        AbortSignal.prototype.removeEventListener = originalRemoveEventListener;
      }
    });
  });

  // Abort signal handling
  describe('abort signal handling', () => {
    it('should abort ongoing operation when signal is triggered', async () => {
      const abortController = new AbortController();
      let operationStarted = false;

      const resultPromise = executeWithRetry({
        operation: async (c, signal?: AbortSignal) => {
          operationStarted = true;
          return new Promise(resolve => {
            const timeout = setTimeout(() => resolve(1), 1000);
            signal?.addEventListener('abort', () => {
              clearTimeout(timeout);
              resolve(0);
            });
          });
        },
        abortSignal: abortController.signal,
      });

      // Wait for operation to start then abort
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(operationStarted).toBe(true);
      abortController.abort();

      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.result).toBe(0);
    });

    it('should not start operation if abort signal is already triggered', async () => {
      const abortController = new AbortController();
      abortController.abort();
      let operationStarted = false;

      const result = await executeWithRetry({
        operation: () => {
          operationStarted = true;
          return Promise.resolve(true);
        },
        abortSignal: abortController.signal,
      });

      expect(operationStarted).toBe(false);
      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
      expect(result.totalAttemptsToSucceed).toBeUndefined();
    });

    it('should abort operation when abort signal is triggered before operation starts', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const result = await executeWithRetry({
        operation: () => new Promise(resolve => resolve(true)),
        abortSignal: abortController.signal,
      });

      expect(result.success).toBe(false);
      expect(result.result).toBe(undefined);
      expect(result.totalAttemptsToSucceed).toBeUndefined();
    });

    it('should abort when abort signal was triggered before operation started', async () => {
      const abortController = new AbortController();
      abortController.abort();
      const resultPromise = executeWithRetry({
        operation: (c, signal?: AbortSignal) =>
          new Promise(resolve => {
            const timeout = setTimeout(() => resolve(1), 1000);
            signal?.addEventListener('abort', () => {
              clearTimeout(timeout);
              resolve(0);
            });
          }),
        abortSignal: abortController.signal,
      });

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
      expect(result.totalAttemptsToSucceed).toBeUndefined();
    });

    it('should complete normally when abort is not triggered', async () => {
      const abortController = new AbortController();

      const result = await executeWithRetry({
        operation: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return 42;
        },
        abortSignal: abortController.signal,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
    });
    it('should abort operation without error handling if abort signal is triggered in operation', async () => {
      const abortController = new AbortController();
      let retries = 0;
      const result = await executeWithRetry({
        operation: () => {
          abortController.abort();
          retries++;
          throw new Error('test');
        },
        errorResolvers: [
          delayedRetryErrorResolver({
            configuration: {
              maxRetries: 5,
              initialDelayMs: 10,
              maxDelayMs: 100,
              backoffMultiplier: 2,
            },
          }),
        ],
        abortSignal: abortController.signal,
      });

      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
      expect(retries).toBe(1);
    });

    it('should handle multiple abort signals and trigger on first abort', async () => {
      const abortController1 = new AbortController();
      const abortController2 = new AbortController();
      let abortCount = 0;

      const resultPromise = executeWithRetry({
        operation: (c, signal?: AbortSignal) =>
          new Promise(resolve => {
            const timeout = setTimeout(() => resolve(1), 1000);
            signal?.addEventListener('abort', () => {
              abortCount++;
              clearTimeout(timeout);
              resolve(0);
            });
          }),

        abortSignal: abortSignalAny([
          abortController1.signal,
          abortController2.signal,
        ]).signal,
      });

      setTimeout(() => {
        abortController1.abort();
      }, 5);

      setTimeout(() => {
        abortController2.abort();
      }, 10);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.result).toBe(0);
      expect(abortCount).toBe(1); // Only first abort should trigger
      expect(result.totalAttemptsToSucceed).toBe(1);
    });

    it('should handle multiple abort signals when one is already aborted', async () => {
      const abortController1 = new AbortController();
      const abortController2 = new AbortController();
      abortController1.abort(); // Pre-abort first controller
      let abortCount = 0;

      const result = await executeWithRetry({
        operation: (c, signal?: AbortSignal) =>
          new Promise(resolve => {
            const timeout = setTimeout(() => resolve(1), 100);
            signal?.addEventListener('abort', () => {
              abortCount++;
              clearTimeout(timeout);
              resolve(0);
            });
          }),

        abortSignal: abortSignalAny([
          abortController1.signal,
          abortController2.signal,
        ]).signal,
      });

      expect(result.success).toBe(false);
      expect(result.result).toBeUndefined();
      expect(abortCount).toBe(0); // Operation should not even start
      expect(result.totalAttemptsToSucceed).toBeUndefined();
    });

    it('should handle multiple abort signals with retries', async () => {
      const abortController1 = new AbortController();
      const abortController2 = new AbortController();
      let attempts = 0;
      let abortCount = 0;

      const resultPromise = executeWithRetry({
        operation: (retryContext?, signal?) =>
          new Promise((resolve, reject) => {
            attempts++;
            if (attempts < 3) {
              reject(new Error('retry me'));
              return;
            }

            const timeout = setTimeout(() => resolve(1), 1000);
            signal?.addEventListener('abort', () => {
              abortCount++;
              clearTimeout(timeout);
              resolve(0);
            });
          }),
        errorResolvers: [
          delayedRetryErrorResolver({
            configuration: {
              maxRetries: 5,
              initialDelayMs: 10,
              maxDelayMs: 100,
              backoffMultiplier: 1,
            },
          }),
        ],

        abortSignal: abortSignalAny([
          abortController1.signal,
          abortController2.signal,
        ]).signal,
      });

      // Wait for a few retries then abort
      setTimeout(() => {
        abortController2.abort();
      }, 50);

      const result = await resultPromise;

      expect(attempts).toBeGreaterThanOrEqual(2);
      expect(result.success).toBe(true);
      expect(result.result).toBe(0);
      expect(abortCount).toBe(1);
    });

    it('should cleanup abort signal listeners after completion', async () => {
      const abortController1 = new AbortController();
      const abortController2 = new AbortController();
      let operationCount = 0;
      let abortCount = 0;

      await executeWithRetry({
        operation: (c, signal?: AbortSignal) =>
          new Promise(resolve => {
            operationCount++;
            const abortHandler = () => {
              abortCount++;
            };
            signal?.addEventListener('abort', abortHandler);
            resolve(1);
            // Clean up the listener after resolving
            signal?.removeEventListener('abort', abortHandler);
          }),
        abortSignal: abortSignalAny([
          abortController1.signal,
          abortController2.signal,
        ]).signal,
      });

      // Abort after operation completes
      abortController1.abort();
      abortController2.abort();

      expect(operationCount).toBe(1);
      expect(abortCount).toBe(0); // Listeners should have been cleaned up
    });
  });

  // Multiple operations (executeWithRetryAll)
  describe('executeWithRetryAll', () => {
    it('should handle multiple operations with different results', async () => {
      const result = await executeWithRetryAll({
        operations: [
          () => Promise.reject('rejected'),
          () => Promise.resolve('success'),
        ],
      });

      expect(result[0].success).toBe(false);
      expect(result[0].error).toBe('rejected');
      expect(result[1].success).toBe(true);
      expect(result[1].result).toBe('success');
    });

    it('should apply error resolvers independently to each operation', async () => {
      let successAttempts = 0;
      let errorCount = 0;

      const result = await executeWithRetryAll({
        operations: [
          () => {
            errorCount++;
            return Promise.reject('permanent failure');
          },
          () => {
            successAttempts++;
            if (successAttempts < 3) {
              throw new Error('temporary failure');
            }
            return Promise.resolve('success');
          },
        ],
        errorResolvers: [
          delayedRetryErrorResolver({
            configuration: {
              maxRetries: 5,
              initialDelayMs: 10,
              maxDelayMs: 100,
              backoffMultiplier: 2,
            },
          }),
        ],
      });

      expect(result[0].success).toBe(false);
      expect(result[0].error).toBe('permanent failure');
      expect(result[1].success).toBe(true);
      expect(result[1].result).toBe('success');
      expect(successAttempts).toBe(3);
      expect(errorCount).toBe(6); // Attempted max retries
    });
  });
});
