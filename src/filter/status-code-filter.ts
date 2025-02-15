import { ErrorFilter } from './base';

export function errorToStatusCode(error: unknown): number | null {
  // Check for standard response object with status
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Check common status/statusCode properties
    if ('status' in err && typeof err.status === 'number') return err.status;
    if ('statusCode' in err && typeof err.statusCode === 'number')
      return err.statusCode;

    // Check for nested response object
    if (
      'response' in err &&
      typeof err.response === 'object' &&
      err.response &&
      'status' in err.response &&
      typeof (err.response as Record<string, unknown>).status === 'number'
    ) {
      return (err.response as Record<string, unknown>).status as number;
    }
    // Check for nested response object
    if (
      'response' in err &&
      typeof err.response === 'object' &&
      err.response &&
      'statusCode' in err.response &&
      typeof (err.response as Record<string, unknown>).statusCode === 'number'
    ) {
      return (err.response as Record<string, unknown>).statusCode as number;
    }
  }
  return null;
}

/**
 * Creates a filter that matches if the error has any of the specified status codes
 */
export const statusCodeErrorFilterAny = <X>(
  statusCodes: number[]
): ErrorFilter<X> => ({
  canHandleError: error => {
    const status = errorToStatusCode(error);
    return status !== null && statusCodes.includes(status);
  },
});

/**
 * Creates a filter that matches errors within a status code range (inclusive)
 */
export const statusCodeErrorFilterRange = <X>(
  min: number,
  max: number
): ErrorFilter<X> => ({
  canHandleError: error => {
    const status = errorToStatusCode(error);
    return status !== null && status >= min && status <= max;
  },
});

// Common status code ranges
export const serverErrorErrorFilter = statusCodeErrorFilterRange<unknown>(
  500,
  599
);
export const clientErrorErrorFilter = statusCodeErrorFilterRange<unknown>(
  400,
  499
);
export const redirectErrorFilter = statusCodeErrorFilterRange<unknown>(
  300,
  399
);
