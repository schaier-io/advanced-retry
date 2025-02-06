import {
  keywordFilterAny,
  keywordFilterAll,
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
    const filter = keywordFilterAny(keywords);

    it('should return true if error contains any keyword', () => {
      expect(
        filter.canHandle(new Error('Connection timeout occurred'), 0, {})
      ).toBe(true);
      expect(filter.canHandle('network error happened', 0, {})).toBe(true);
      expect(filter.canHandle({ message: 'timeout error' }, 0, {})).toBe(true);
    });

    it('should return false if error contains no keywords', () => {
      expect(filter.canHandle(new Error('general error'), 0, {})).toBe(false);
      expect(filter.canHandle('authentication failed', 0, {})).toBe(false);
      expect(filter.canHandle({ message: 'invalid input' }, 0, {})).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(filter.canHandle('TIMEOUT error', 0, {})).toBe(false);
      expect(filter.canHandle('NETWORK issue', 0, {})).toBe(false);
    });

    it('should handle empty keywords array', () => {
      const emptyFilter = keywordFilterAny([]);
      expect(emptyFilter.canHandle('any error', 0, {})).toBe(false);
    });
  });

  describe('keywordFilterAll', () => {
    const keywords = ['error', 'network'];
    const filter = keywordFilterAll(keywords);

    it('should return true if error contains all keywords', () => {
      expect(filter.canHandle('network connection error', 0, {})).toBe(true);
      expect(filter.canHandle(new Error('network error occurred'), 0, {})).toBe(
        true
      );
      expect(filter.canHandle({ message: 'network system error' }, 0, {})).toBe(
        true
      );
    });

    it('should return false if error is missing any keyword', () => {
      expect(filter.canHandle('only network issue', 0, {})).toBe(false);
      expect(filter.canHandle('just an error', 0, {})).toBe(false);
      expect(filter.canHandle({ message: 'connection error' }, 0, {})).toBe(
        false
      );
    });

    it('should be case sensitive', () => {
      expect(filter.canHandle('NETWORK ERROR occurred', 0, {})).toBe(false);
      expect(filter.canHandle('Network Error', 0, {})).toBe(false);
    });

    it('should handle empty keywords array', () => {
      const emptyFilter = keywordFilterAll([]);
      expect(emptyFilter.canHandle('any error', 0, {})).toBe(true);
    });

    it('should handle single keyword', () => {
      const singleFilter = keywordFilterAll(['error']);
      expect(singleFilter.canHandle('error occurred', 0, {})).toBe(true);
      expect(singleFilter.canHandle('something else', 0, {})).toBe(false);
    });
  });
});
