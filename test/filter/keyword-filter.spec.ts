import {
  keywordErrorFilterAny,
  keywordErrorFilterAll,
  errorToString,
} from '../../src/filter/keyword-filter';

describe('Keyword Filter', () => {
  describe('errorToString', () => {
    it('should convert Error object to string', () => {
      const error = new Error('test error');
      expect(errorToString(error)).toBe('test error');
    });

    it('should handle string input directly', () => {
      expect(errorToString('test error')).toBe('test error');
    });

    it('should stringify object input', () => {
      const error = { message: 'test error' };
      expect(errorToString(error)).toBe('{"message":"test error"}');
    });

    it('should convert other types to string', () => {
      expect(errorToString(123)).toBe('123');
      expect(errorToString(null)).toBe('null');
      expect(errorToString(undefined)).toBe('undefined');
    });
  });

  describe('keywordFilterAny', () => {
    const keywords = ['timeout', 'network'];
    const filter = keywordErrorFilterAny(keywords);

    it('should return true if error contains any keyword', () => {
      expect(
        filter.canHandleError(new Error('Connection timeout occurred'), 0, {})
      ).toBe(true);
      expect(filter.canHandleError('network error happened', 0, {})).toBe(true);
      expect(filter.canHandleError({ message: 'timeout error' }, 0, {})).toBe(
        true
      );
    });

    it('should return false if error contains no keywords', () => {
      expect(filter.canHandleError(new Error('general error'), 0, {})).toBe(
        false
      );
      expect(filter.canHandleError('authentication failed', 0, {})).toBe(false);
      expect(filter.canHandleError({ message: 'invalid input' }, 0, {})).toBe(
        false
      );
    });

    it('should be case sensitive', () => {
      expect(filter.canHandleError('TIMEOUT error', 0, {})).toBe(false);
      expect(filter.canHandleError('NETWORK issue', 0, {})).toBe(false);
    });

    it('should handle empty keywords array', () => {
      const emptyFilter = keywordErrorFilterAny([]);
      expect(emptyFilter.canHandleError('any error', 0, {})).toBe(false);
    });
  });

  describe('keywordFilterAll', () => {
    const keywords = ['error', 'network'];
    const filter = keywordErrorFilterAll(keywords);

    it('should return true if error contains all keywords', () => {
      expect(filter.canHandleError('network connection error', 0, {})).toBe(
        true
      );
      expect(
        filter.canHandleError(new Error('network error occurred'), 0, {})
      ).toBe(true);
      expect(
        filter.canHandleError({ message: 'network system error' }, 0, {})
      ).toBe(true);
    });

    it('should return false if error is missing any keyword', () => {
      expect(filter.canHandleError('only network issue', 0, {})).toBe(false);
      expect(filter.canHandleError('just an error', 0, {})).toBe(false);
      expect(
        filter.canHandleError({ message: 'connection error' }, 0, {})
      ).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(filter.canHandleError('NETWORK ERROR occurred', 0, {})).toBe(
        false
      );
      expect(filter.canHandleError('Network Error', 0, {})).toBe(false);
    });

    it('should handle empty keywords array', () => {
      const emptyFilter = keywordErrorFilterAll([]);
      expect(emptyFilter.canHandleError('any error', 0, {})).toBe(true);
    });

    it('should handle single keyword', () => {
      const singleFilter = keywordErrorFilterAll(['error']);
      expect(singleFilter.canHandleError('error occurred', 0, {})).toBe(true);
      expect(singleFilter.canHandleError('something else', 0, {})).toBe(false);
    });
  });
});
