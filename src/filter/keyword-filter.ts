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
export const keywordFilterAny = (keywords: string[]): ErrorFilter => ({
  canHandle: error => {
    return keywords.some(keyword => errorToString(error).includes(keyword));
  },
});

export const keywordFilterAll = (keywords: string[]): ErrorFilter => ({
  canHandle: error => {
    return keywords.every(keyword => errorToString(error).includes(keyword));
  },
});
