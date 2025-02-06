import { ErrorResolverBase, RetryContext } from '../retry';
import {
  CanHandleErrorFunction,
  ErrorFilter,
  toErrorFilter,
} from '../filter/base';

/**
 * @description Custom retry error resolver is used to handle the error and retry the operation to your needs
 * @param configuration - Custom retry policy. Configure the initial data, such as how many attempts to make, or what data to pass to the operation
 * @param canHandleError - Used to filter the error. If this handler is not able to handle the error, it will be passed to the next handler
 * @param callback - The callback function that will be called to handle the error and try to resolve it. Here you can specify custom logic. It can optionally pass context to the next iteration
 * @returns Error resolver
 */
export const customRetryErrorResolver =
  <T, X = any | undefined>({
    configuration,
    canHandleError,
    callback,
  }: {
    configuration: T;
    canHandleError?: CanHandleErrorFunction<X> | ErrorFilter<X>;
    /**
     * @description The callback function that will be called to handle the error and try to resolve it. Here you can specify custom logic. It can optionally pass context to the next iteration
     * @param error - The error that occurred
     * @param attempt - The attempt number. The first attempt is 0, the second is 1, etc.
     * @param configuration - The configuration defined when the resolver was created
     * @param context - The context passed from the previous handler or iteration
     * @param abortSignal - The abort signal, if you have a long running operation, consider implementing it.
     */
    callback: (
      error: Error,
      attempt: number,
      configuration: T,
      context?: X,
      abortSignal?: AbortSignal
    ) =>
      | Promise<{
          context?: X;
          remainingAttempts: number;
          unrecoverable: boolean;
        }>
      | {
          context?: X;
          remainingAttempts: number;
          unrecoverable: boolean;
        };
  }): ErrorResolverBase<RetryContext<X>, X> =>
  async ({ error, attempt, retryContext: context, abortSignal }) => {
    if (
      canHandleError == undefined ||
      toErrorFilter(canHandleError).canHandle(error, attempt, context)
    ) {
      /* istanbul ignore next */
      const r = await callback(
        error as Error,
        attempt,
        configuration,
        context.data,
        abortSignal
      );

      return {
        remainingAttempts: r.remainingAttempts,
        unrecoverable: r.unrecoverable,
        context: { data: r.context },
      };
    }
    return {
      remainingAttempts: -1,
      unrecoverable: false,
      context: { data: undefined },
    };
  };
