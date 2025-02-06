import { CanHandleErrorFunction, ErrorFilter } from './filter/base';

/**
 * The result of an error resolver.
 *
 * @property remainingAttempts - The number of attempts remaining, can be adapted on the go. If it hits 0, the next resolver will be tried or the operation will fail.
 * @property unrecoverable - Whether the error is unrecoverable. If true, the operation will fail, no more resolvers will be tried.
 * @property context - Additional context for the next called resolver (will be this resolver if remainingAttempts is >0)
 */
export interface ErrorResolution<C extends RetryContext<X>, X> {
  remainingAttempts: number;
  unrecoverable: boolean;
  context: C;
}

/**
 * The base type for error resolvers.
 *
 * @param error - The error that occurred.
 * @param attempt - The number of attempts made.
 * @param retryContext - The context passed from the previous handler or iteration
 * @param abortSignal - The abort signal, if you have a long running operation, consider implementing it.
 * @returns The error resolution.
 */
export interface ErrorResolverBase<C extends RetryContext<X>, X> {
  ({
    error,
    attempt,
    retryContext,
    abortSignal,
  }: {
    error: unknown;
    attempt: number;
    retryContext: C;
    abortSignal?: AbortSignal;
  }): Promise<ErrorResolution<C, X>>;
}

/**
 * Abstract function that creates an error resolver.
 *
 * @param configuration - The configuration for the resolver.
 * @param canHandleError - Function that determines if an error can be handled.
 * @param context - The context for the next resolver called (will be null on the first call)
 * @returns The error resolver.
 */
export type ErrorResolver<T, C extends RetryContext<X>, X> = ({
  configuration,
  canHandleError,
  context,
}: {
  configuration: T;
  canHandleError?: CanHandleErrorFunction<X> | ErrorFilter<X>;
  context?: C;
}) => ErrorResolverBase<C, X>;

export interface RetryContext<C> {
  data?: C;
}

/**
 * Options for the retry operation.
 *
 * @param operation - The operation to retry.
 * @param errorResolvers - The error resolvers to use. In the order to resolve the error.
 * @param throwOnUnrecoveredError - Whether to throw an error if the operation failed to recover, instead of returning a result.
 * @param overallTimeout - The overall timeout for the operation. If set and the operation takes longer than this, it will be cancelled, any retries will not be attempted.
 * @param abortSignal - An optional abort signal to cancel the operation if timeouts are used.
 */
export interface RetryOptions<T, X> {
  operation: (
    retryContext?: RetryContext<X>,
    abortSignal?: AbortSignal
  ) => Promise<T> | T;
  errorResolvers?: Array<ErrorResolverBase<RetryContext<X>, X>>;
  throwOnUnrecoveredError?: boolean;
  overallTimeout?: number;
  abortSignal?: AbortSignal;
}

/**
 * The result of the operation.
 *
 * @param success - Whether the operation was successful.
 * @param result - The result of the operation.
 * @param error - The error that occurred.
 * @param totalAttempts - The total number of attempts made.
 * @param totalDurationMs - The total duration of the operation in milliseconds.
 */
export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  totalAttemptsToSucceed?: number;
  totalAttempts?: number;
  totalDurationMs: number;
}

async function handleRetry<T, X>(
  operation: (
    retryContext: RetryContext<X>,
    signal?: AbortSignal
  ) => Promise<T> | T,
  errorResolvers: Array<ErrorResolverBase<RetryContext<X>, X>>,
  abortSignal: AbortSignal
): Promise<{
  result?: T;
  totalAttempts: number;
  error?: Error;
  success: boolean;
}> {
  let resolverIndex = 0;
  let totalAttempts = 0;

  do {
    const currentResolver =
      resolverIndex < errorResolvers.length
        ? errorResolvers[resolverIndex]
        : undefined;
    resolverIndex++;

    let remainingAttempts = 1;
    let resolverRetries = 0;
    let context: RetryContext<X> = { data: undefined };
    do {
      if (abortSignal.aborted) {
        throw new Error('Operation aborted');
      }

      try {
        totalAttempts++;
        const result = await operation(context, abortSignal);
        return {
          result,
          totalAttempts,
          success: true,
        };
      } catch (error: unknown) {
        if (abortSignal.aborted) {
          throw new Error('Operation aborted');
        }
        /* istanbul ignore next */
        if (
          !currentResolver ||
          (remainingAttempts === 0 && resolverIndex >= errorResolvers.length)
        ) {
          return {
            result: undefined,
            totalAttempts,
            error: error as Error,
            success: false,
          };
        }

        // Try each resolver in sequence until one returns a resolution
        const resolution = await currentResolver({
          error,
          attempt: resolverRetries,
          retryContext: context,
          abortSignal,
        });
        context = resolution.context;
        if (resolution.unrecoverable) {
          return {
            result: undefined,
            totalAttempts,
            error: error as Error,
            success: false,
          };
        }
        remainingAttempts = resolution.remainingAttempts;
        resolverRetries++;
        if (
          remainingAttempts <= 0 &&
          resolverIndex >= errorResolvers.length - 1
        ) {
          return {
            result: undefined,
            totalAttempts,
            error: error as Error,
            success: false,
          };
        }
      }
    } while (remainingAttempts > 0);
  } while (resolverIndex < errorResolvers.length);
  /* istanbul ignore next */
  throw new Error('Unexpected retry loop exit. This should never happen.');
}

export function abortSignalAny(abortSignals: (AbortSignal | undefined)[]): {
  abortController: AbortController;
  signal: AbortSignal;
  abortListeners: ((e: Event) => void)[];
} {
  const abortController = new AbortController();
  const abortListeners: ((e: Event) => void)[] = [];
  abortSignals.forEach(s => {
    if (s != undefined) {
      const abortListener = () => {
        abortController.abort();
      };
      abortListeners.push(abortListener);
      s.addEventListener('abort', abortListener);
      if (s.aborted) {
        abortController.abort();
      }
    }
  });
  return { abortController, signal: abortController.signal, abortListeners };
}

/**
 * Executes an operation with retry logic.
 *
 * @param operation - The operation to retry.
 * @param errorResolvers - The resolvers to use to try and recover
 * @param throwOnUnrecoveredError - Whether to throw an error if the operation failed to recover, instead of returning a result.
 * @returns The result of the operation
 */
export async function executeWithRetry<T, X>({
  operation: operation,
  errorResolvers = [],
  throwOnUnrecoveredError = false,
  overallTimeout = undefined,
  abortSignal: externalAbortSignal = undefined,
}: RetryOptions<T, X>): Promise<RetryResult<T>> {
  const startTime = Date.now();
  const timeoutController = new AbortController();
  let timeoutAbortListener: ((e: Event) => void) | undefined;
  let timeoutId: NodeJS.Timeout | undefined;

  const { signal, abortListeners } = abortSignalAny([
    timeoutController.signal,
    externalAbortSignal,
  ]);

  // Create a cleanup function
  const cleanup = () => {
    if (timeoutAbortListener) {
      signal.removeEventListener('abort', timeoutAbortListener);
      timeoutController.signal.removeEventListener(
        'abort',
        timeoutAbortListener
      );
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    abortListeners.forEach(l => signal.removeEventListener('abort', l));
    // Ensure timeout controller is aborted
    if (!timeoutController.signal.aborted) {
      timeoutController.abort();
    }
  };

  try {
    const result: {
      result?: T;
      totalAttempts: number;
      error?: Error;
      success: boolean;
    } = await new Promise((resolve, reject) => {
      if (overallTimeout) {
        timeoutId = setTimeout(() => {
          timeoutController.abort();
          reject(new Error('Operation timed out'));
        }, overallTimeout);

        timeoutAbortListener = () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }
        };
        signal.addEventListener('abort', timeoutAbortListener);
      }

      handleRetry<T, X>(operation, errorResolvers, signal)
        .then(v => {
          resolve(v);
        })
        .catch(e => {
          reject(e);
        });
    });

    cleanup(); // Call cleanup before processing result

    if (result.success == false) {
      if (throwOnUnrecoveredError) {
        throw result.error;
      }
      return {
        success: false,
        error: result.error,
        totalAttemptsToSucceed: undefined,
        totalAttempts: result.totalAttempts,
        totalDurationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      result: result.result,
      totalAttemptsToSucceed: result.totalAttempts,
      totalAttempts: result.totalAttempts,
      totalDurationMs: Date.now() - startTime,
    };
  } catch (error) {
    cleanup(); // Call cleanup before handling error

    if (throwOnUnrecoveredError) {
      throw error;
    }

    return {
      success: false,
      error: error as Error,
      totalAttemptsToSucceed: undefined,
      totalAttempts: undefined,
      totalDurationMs: Date.now() - startTime,
    };
  } finally {
    cleanup(); // Ensure cleanup runs in all cases
  }
}

export async function executeWithRetryAll<T extends unknown[], X>({
  operations,
  errorResolvers = [],
  overallTimeout = undefined,
  abortSignal = undefined,
}: {
  operations: { [K in keyof T]: () => Promise<T[K]> };
  errorResolvers?: Array<ErrorResolverBase<RetryContext<X>, X>>;
  overallTimeout?: number;
  abortSignal?: AbortSignal;
}): Promise<{ [K in keyof T]: RetryResult<T[K]> }> {
  return Promise.all(
    operations.map(operation =>
      executeWithRetry({
        operation,
        errorResolvers,
        throwOnUnrecoveredError: false,
        overallTimeout,
        abortSignal,
      })
    )
  ) as Promise<{ [K in keyof T]: RetryResult<T[K]> }>;
}
