import { ErrorResolution, ErrorResolverBase, RetryContext } from '../retry';
import {
  CanHandleErrorFunction,
  ErrorFilter,
  toErrorFilter,
} from '../filter/base';

async function sleep(ms: number, abortSignal?: AbortSignal) {
  return new Promise(resolve => {
    if (ms < 0) ms = 0;
    const timeout = setTimeout(() => resolve(undefined), ms);
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        clearTimeout(timeout);
        resolve(undefined);
      });
    }
  });
}
/**
 * @description Delayed retry policy is used to configure the delay between retries and the maximum number of retries
 * @property maxRetries - Maximum number of retries
 * @property initialDelayMs - Initial delay in milliseconds
 * @property maxDelayMs - Maximum delay in milliseconds
 * @property backoffMultiplier - Backoff multiplier, the delay is calculated as initialDelayMs * (attempt + 1) * backoffMultiplier
 * @property customDelay - Custom delay function. Customize the delay to your liking
 */
export interface DelayPolicy<X = any | undefined> {
  maxRetries: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  customDelay?: ({
    attempt,
    error,
    context,
    configuration,
  }: {
    attempt: number;
    error: unknown;
    context: RetryContext<X>;
    configuration: DelayPolicy;
  }) => number;
}

/**
 * @description Delayed retry error resolver is used to handle the error and retry the operation after a delay
 * @param configuration - Delayed retry policy
 * @param canHandleError - Can handle error function
 * @returns Error resolver
 */
export const delayErrorResolver =
  <X = any | undefined>({
    configuration,
    canHandleError = undefined,
  }: {
    configuration: DelayPolicy;
    canHandleError?: CanHandleErrorFunction<X> | ErrorFilter<X>;
  }): ErrorResolverBase<RetryContext<X>, X> =>
  async ({ error, attempt, retryContext: context, abortSignal }) => {
    if (
      !canHandleError ||
      toErrorFilter(canHandleError).canHandleError(error, attempt, context)
    ) {
      const delay =
        configuration.customDelay != undefined
          ? configuration.customDelay({
              attempt,
              context,
              error,
              configuration,
            })
          : configuration.maxDelayMs
            ? Math.min(
                (configuration.initialDelayMs ?? 0) *
                  (attempt + 1) *
                  (configuration.backoffMultiplier ?? 1),
                configuration.maxDelayMs
              )
            : (configuration.initialDelayMs ?? 0) *
              (attempt + 1) *
              (configuration.backoffMultiplier ?? 1);
      await sleep(delay, abortSignal);
      return {
        remainingAttempts: configuration.maxRetries - attempt,
        unrecoverable: false,
        context: { data: undefined as unknown as X },
      } as ErrorResolution<RetryContext<X>, X>;
    }
    return {
      remainingAttempts: -1,
      unrecoverable: false,
      context: { data: undefined as unknown as X },
    } as ErrorResolution<RetryContext<X>, X>;
  };
