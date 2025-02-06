import { RetryContext } from '../retry';

/**
 * Function that determines if an error can be handled by the specified resolver.
 *
 * @param error - The error that occurred.
 * @returns Whether the error can be handled.
 */
export type CanHandleErrorFunction = (
  error: unknown,
  attempt: number,
  context: RetryContext<any>
) => boolean;

/**
 * Base interface for error filters
 */
export interface ErrorFilter {
  canHandle: CanHandleErrorFunction;
}

export function toErrorFilter(
  p: CanHandleErrorFunction | ErrorFilter
): ErrorFilter {
  if (typeof p === 'function') {
    return { canHandle: p };
  }
  return p;
}

/**
 * Creates a filter that requires all provided filters to pass
 * @param filters Array of filters or filter functions
 */
export function allFilters(
  filters: (ErrorFilter | CanHandleErrorFunction)[]
): ErrorFilter {
  return {
    canHandle: (
      error: unknown,
      attempt: number,
      context: RetryContext<any>
    ) => {
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
export function anyFilters(
  filters: (ErrorFilter | CanHandleErrorFunction)[]
): ErrorFilter {
  return {
    canHandle: (
      error: unknown,
      attempt: number,
      context: RetryContext<any>
    ) => {
      return filters.some(filter => {
        if (typeof filter === 'function') {
          return filter(error, attempt, context);
        }
        return filter.canHandle(error, attempt, context);
      });
    },
  };
}
