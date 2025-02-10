import { ErrorFilter } from './base';
export function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null) {
    return JSON.stringify(error);
  }
  return String(error);
}
export const keywordErrorFilterAny = <X>(
  keywords: string[]
): ErrorFilter<X> => ({
  canHandleError: error => {
    return keywords.some(keyword => errorToString(error).includes(keyword));
  },
});

export const keywordErrorFilterAll = <X>(
  keywords: string[]
): ErrorFilter<X> => ({
  canHandleError: error => {
    return keywords.every(keyword => errorToString(error).includes(keyword));
  },
});
