import { RetryContext } from '../retry';

/**
 * Function that determines if an error can be handled by the specified resolver.
 *
 * @param error - The error that occurred.
 * @returns Whether the error can be handled.
 */
export type CanHandleErrorFunction<X> = (
  error: unknown,
  attempt: number,
  context: RetryContext<X>
) => boolean;

/**
 * Base interface for error filters
 */
export interface ErrorFilter<X> {
  canHandleError: CanHandleErrorFunction<X>;
}

export function toErrorFilter<X>(
  p: CanHandleErrorFunction<X> | ErrorFilter<X>
): ErrorFilter<X> {
  if (typeof p === 'function') {
    return { canHandleError: p };
  }
  return p;
}

/**
 * Creates a filter that requires all provided filters to pass
 * @param filters Array of filters or filter functions
 */
export function allErrorFilter<X>(
  filters: (ErrorFilter<X> | CanHandleErrorFunction<X>)[]
): ErrorFilter<X> {
  return {
    canHandleError: (
      error: unknown,
      attempt: number,
      context: RetryContext<X>
    ) => {
      return filters.every(filter => {
        if (typeof filter === 'function') {
          return filter(error, attempt, context);
        }
        return filter.canHandleError(error, attempt, context);
      });
    },
  };
}

/**
 * Creates a filter that requires any of the provided filters to pass
 * @param filters Array of filters or filter functions
 */
export function anyErrorFilter<X>(
  filters: (ErrorFilter<X> | CanHandleErrorFunction<X>)[]
): ErrorFilter<X> {
  return {
    canHandleError: (
      error: unknown,
      attempt: number,
      context: RetryContext<X>
    ) => {
      return filters.some(filter => {
        if (typeof filter === 'function') {
          return filter(error, attempt, context);
        }
        return filter.canHandleError(error, attempt, context);
      });
    },
  };
}

export function noneErrorFilter<X>(
  filters: (ErrorFilter<X> | CanHandleErrorFunction<X>)[]
): ErrorFilter<X> {
  return {
    canHandleError: (
      error: unknown,
      attempt: number,
      context: RetryContext<X>
    ) => {
      return !filters.some(filter => {
        if (typeof filter === 'function') {
          return filter(error, attempt, context);
        }
        return filter.canHandleError(error, attempt, context);
      });
    },
  };
}
