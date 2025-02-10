import {
  allErrorFilter,
  anyErrorFilter,
  toErrorFilter,
  ErrorFilter,
  noneErrorFilter,
} from '../../src/filter/base';

describe('filter/base', () => {
  describe('toErrorFilter', () => {
    it('should convert function to ErrorFilter', () => {
      const fn = () => true;
      const filter = toErrorFilter(fn);
      expect(filter).toHaveProperty('canHandleError');
      expect(filter.canHandleError).toBe(fn);
    });

    it('should return ErrorFilter as is', () => {
      const filter: ErrorFilter<any> = { canHandleError: () => true };
      const result = toErrorFilter(filter);
      expect(result).toBe(filter);
    });
  });

  describe('allFilters', () => {
    it('should handle array of functions', () => {
      const filter = allErrorFilter([() => true, () => true]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle array of ErrorFilters', () => {
      const filter = allErrorFilter([
        { canHandleError: () => true },
        { canHandleError: () => true },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle mixed array of functions and ErrorFilters', () => {
      const filter = allErrorFilter([
        () => true,
        { canHandleError: () => true },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should return false if any filter returns false', () => {
      const filter = allErrorFilter([
        () => true,
        () => false,
        { canHandleError: () => true },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(false);
    });

    it('should pass error, attempt and context to filters', () => {
      const error = new Error('test');
      const attempt = 1;
      const context = { data: 'test' };

      const functionSpy = jest.fn(() => true);
      const filterSpy = jest.fn(() => true);

      const filter = allErrorFilter([
        functionSpy,
        { canHandleError: filterSpy },
      ]);

      filter.canHandleError(error, attempt, context);

      expect(functionSpy).toHaveBeenCalledWith(error, attempt, context);
      expect(filterSpy).toHaveBeenCalledWith(error, attempt, context);
    });
  });

  describe('anyFilters', () => {
    it('should handle array of functions', () => {
      const filter = anyErrorFilter([() => false, () => true]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle array of ErrorFilters', () => {
      const filter = anyErrorFilter([
        { canHandleError: () => false },
        { canHandleError: () => true },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle mixed array of functions and ErrorFilters', () => {
      const filter = anyErrorFilter([
        () => false,
        { canHandleError: () => true },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should return false if all filters return false', () => {
      const filter = anyErrorFilter([
        () => false,
        () => false,
        { canHandleError: () => false },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(false);
    });

    it('should pass error, attempt and context to filters', () => {
      const error = new Error('test');
      const attempt = 1;
      const context = { data: 'test' };

      const functionSpy = jest.fn(() => false);
      const filterSpy = jest.fn(() => true);

      const filter = anyErrorFilter([
        functionSpy,
        { canHandleError: filterSpy },
      ]);

      filter.canHandleError(error, attempt, context);

      expect(functionSpy).toHaveBeenCalledWith(error, attempt, context);
      expect(filterSpy).toHaveBeenCalledWith(error, attempt, context);
    });

    it('should short-circuit evaluation when a filter returns true', () => {
      const functionSpy = jest.fn(() => true);
      const filterSpy = jest.fn(() => true);

      const filter = anyErrorFilter([
        functionSpy,
        { canHandleError: filterSpy },
      ]);

      filter.canHandleError({}, 0, {});

      expect(functionSpy).toHaveBeenCalled();
      expect(filterSpy).not.toHaveBeenCalled();
    });
  });

  describe('noneFilters', () => {
    it('should handle array of functions', () => {
      const filter = noneErrorFilter([() => false, () => false]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle array of ErrorFilters', () => {
      const filter = noneErrorFilter([
        { canHandleError: () => false },
        { canHandleError: () => false },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle mixed array of functions and ErrorFilters', () => {
      const filter = noneErrorFilter([
        () => false,
        { canHandleError: () => false },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should return false if any filter returns true', () => {
      const filter = noneErrorFilter([
        () => false,
        () => true,
        { canHandleError: () => false },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(false);
    });

    it('should pass error, attempt and context to filters', () => {
      const error = new Error('test');
      const attempt = 1;
      const context = { data: 'test' };

      const functionSpy = jest.fn(() => false);
      const filterSpy = jest.fn(() => false);

      const filter = noneErrorFilter([
        functionSpy,
        { canHandleError: filterSpy },
      ]);

      filter.canHandleError(error, attempt, context);

      expect(functionSpy).toHaveBeenCalledWith(error, attempt, context);
      expect(filterSpy).toHaveBeenCalledWith(error, attempt, context);
    });

    it('should short-circuit evaluation when a filter returns true', () => {
      const functionSpy = jest.fn(() => true);
      const filterSpy = jest.fn(() => false);

      const filter = noneErrorFilter([
        functionSpy,
        { canHandleError: filterSpy },
      ]);

      filter.canHandleError({}, 0, {});

      expect(functionSpy).toHaveBeenCalled();
      expect(filterSpy).not.toHaveBeenCalled();
    });
  });

  describe('complex filter combinations', () => {
    it('should handle nested filters with allFilters', () => {
      const filter = allErrorFilter([
        allErrorFilter([() => true, { canHandleError: () => true }]),
        anyErrorFilter([() => true, { canHandleError: () => false }]),
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle nested filters with anyFilters', () => {
      const filter = anyErrorFilter([
        allErrorFilter([() => false, { canHandleError: () => true }]),
        anyErrorFilter([() => true, { canHandleError: () => false }]),
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle deeply nested filters', () => {
      const filter = allErrorFilter([
        anyErrorFilter([
          allErrorFilter([() => true, { canHandleError: () => true }]),
          () => false,
        ]),
        { canHandleError: () => true },
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });

    it('should handle combinations with noneFilters', () => {
      const filter = allErrorFilter([
        noneErrorFilter([() => false, { canHandleError: () => false }]),
        anyErrorFilter([() => true, { canHandleError: () => false }]),
      ]);
      expect(filter.canHandleError({}, 0, {})).toBe(true);
    });
  });
});
