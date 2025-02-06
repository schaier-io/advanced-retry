import {
  allFilters,
  anyFilters,
  toErrorFilter,
  ErrorFilter,
  noneFilters,
} from '../../src/filter/base';

describe('filter/base', () => {
  describe('toErrorFilter', () => {
    it('should convert function to ErrorFilter', () => {
      const fn = () => true;
      const filter = toErrorFilter(fn);
      expect(filter).toHaveProperty('canHandle');
      expect(filter.canHandle).toBe(fn);
    });

    it('should return ErrorFilter as is', () => {
      const filter: ErrorFilter<any> = { canHandle: () => true };
      const result = toErrorFilter(filter);
      expect(result).toBe(filter);
    });
  });

  describe('allFilters', () => {
    it('should handle array of functions', () => {
      const filter = allFilters([() => true, () => true]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle array of ErrorFilters', () => {
      const filter = allFilters([
        { canHandle: () => true },
        { canHandle: () => true },
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle mixed array of functions and ErrorFilters', () => {
      const filter = allFilters([() => true, { canHandle: () => true }]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should return false if any filter returns false', () => {
      const filter = allFilters([
        () => true,
        () => false,
        { canHandle: () => true },
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(false);
    });

    it('should pass error, attempt and context to filters', () => {
      const error = new Error('test');
      const attempt = 1;
      const context = { data: 'test' };

      const functionSpy = jest.fn(() => true);
      const filterSpy = jest.fn(() => true);

      const filter = allFilters([functionSpy, { canHandle: filterSpy }]);

      filter.canHandle(error, attempt, context);

      expect(functionSpy).toHaveBeenCalledWith(error, attempt, context);
      expect(filterSpy).toHaveBeenCalledWith(error, attempt, context);
    });
  });

  describe('anyFilters', () => {
    it('should handle array of functions', () => {
      const filter = anyFilters([() => false, () => true]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle array of ErrorFilters', () => {
      const filter = anyFilters([
        { canHandle: () => false },
        { canHandle: () => true },
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle mixed array of functions and ErrorFilters', () => {
      const filter = anyFilters([() => false, { canHandle: () => true }]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should return false if all filters return false', () => {
      const filter = anyFilters([
        () => false,
        () => false,
        { canHandle: () => false },
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(false);
    });

    it('should pass error, attempt and context to filters', () => {
      const error = new Error('test');
      const attempt = 1;
      const context = { data: 'test' };

      const functionSpy = jest.fn(() => false);
      const filterSpy = jest.fn(() => true);

      const filter = anyFilters([functionSpy, { canHandle: filterSpy }]);

      filter.canHandle(error, attempt, context);

      expect(functionSpy).toHaveBeenCalledWith(error, attempt, context);
      expect(filterSpy).toHaveBeenCalledWith(error, attempt, context);
    });

    it('should short-circuit evaluation when a filter returns true', () => {
      const functionSpy = jest.fn(() => true);
      const filterSpy = jest.fn(() => true);

      const filter = anyFilters([functionSpy, { canHandle: filterSpy }]);

      filter.canHandle({}, 0, {});

      expect(functionSpy).toHaveBeenCalled();
      expect(filterSpy).not.toHaveBeenCalled();
    });
  });

  describe('noneFilters', () => {
    it('should handle array of functions', () => {
      const filter = noneFilters([() => false, () => false]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle array of ErrorFilters', () => {
      const filter = noneFilters([
        { canHandle: () => false },
        { canHandle: () => false },
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle mixed array of functions and ErrorFilters', () => {
      const filter = noneFilters([() => false, { canHandle: () => false }]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should return false if any filter returns true', () => {
      const filter = noneFilters([
        () => false,
        () => true,
        { canHandle: () => false },
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(false);
    });

    it('should pass error, attempt and context to filters', () => {
      const error = new Error('test');
      const attempt = 1;
      const context = { data: 'test' };

      const functionSpy = jest.fn(() => false);
      const filterSpy = jest.fn(() => false);

      const filter = noneFilters([functionSpy, { canHandle: filterSpy }]);

      filter.canHandle(error, attempt, context);

      expect(functionSpy).toHaveBeenCalledWith(error, attempt, context);
      expect(filterSpy).toHaveBeenCalledWith(error, attempt, context);
    });

    it('should short-circuit evaluation when a filter returns true', () => {
      const functionSpy = jest.fn(() => true);
      const filterSpy = jest.fn(() => false);

      const filter = noneFilters([functionSpy, { canHandle: filterSpy }]);

      filter.canHandle({}, 0, {});

      expect(functionSpy).toHaveBeenCalled();
      expect(filterSpy).not.toHaveBeenCalled();
    });
  });

  describe('complex filter combinations', () => {
    it('should handle nested filters with allFilters', () => {
      const filter = allFilters([
        allFilters([() => true, { canHandle: () => true }]),
        anyFilters([() => true, { canHandle: () => false }]),
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle nested filters with anyFilters', () => {
      const filter = anyFilters([
        allFilters([() => false, { canHandle: () => true }]),
        anyFilters([() => true, { canHandle: () => false }]),
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle deeply nested filters', () => {
      const filter = allFilters([
        anyFilters([
          allFilters([() => true, { canHandle: () => true }]),
          () => false,
        ]),
        { canHandle: () => true },
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });

    it('should handle combinations with noneFilters', () => {
      const filter = allFilters([
        noneFilters([() => false, { canHandle: () => false }]),
        anyFilters([() => true, { canHandle: () => false }]),
      ]);
      expect(filter.canHandle({}, 0, {})).toBe(true);
    });
  });
});
