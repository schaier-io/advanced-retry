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
  canHandle: CanHandleErrorFunction<X>;
}

export function toErrorFilter<X>(
  p: CanHandleErrorFunction<X> | ErrorFilter<X>
): ErrorFilter<X> {
  if (typeof p === 'function') {
    return { canHandle: p };
  }
  return p;
}

/**
 * Creates a filter that requires all provided filters to pass
 * @param filters Array of filters or filter functions
 */
export function allFilters<X>(
  filters: (ErrorFilter<X> | CanHandleErrorFunction<X>)[]
): ErrorFilter<X> {
  return {
    canHandle: (error: unknown, attempt: number, context: RetryContext<X>) => {
      return filters.every(filter => {
        if (typeof filter === 'function') {
          return filter(error, attempt, context);
        }
        return filter.canHandle(error, attempt, context);
      });
    },
  };
}

/**
 * Creates a filter that requires any of the provided filters to pass
 * @param filters Array of filters or filter functions
 */
export function anyFilters<X>(
  filters: (ErrorFilter<X> | CanHandleErrorFunction<X>)[]
): ErrorFilter<X> {
  return {
    canHandle: (error: unknown, attempt: number, context: RetryContext<X>) => {
      return filters.some(filter => {
        if (typeof filter === 'function') {
          return filter(error, attempt, context);
        }
        return filter.canHandle(error, attempt, context);
      });
    },
  };
}
