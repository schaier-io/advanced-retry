import {
  statusCodeErrorFilterAny,
  statusCodeErrorFilterRange,
  serverErrorErrorFilter,
  clientErrorErrorFilter,
  redirectErrorFilter,
} from '../../src/filter/status-code-filter';

describe('Status Filters', () => {
  describe('statusFilterAny', () => {
    const filter = statusCodeErrorFilterAny([404, 429]);

    it('matches direct status property', () => {
      expect(filter.canHandleError({ status: 404 }, 0, {})).toBe(true);
      expect(filter.canHandleError({ status: 500 }, 0, {})).toBe(false);
    });

    it('matches statusCode property', () => {
      expect(filter.canHandleError({ statusCode: 429 }, 0, {})).toBe(true);
      expect(filter.canHandleError({ statusCode: 500 }, 0, {})).toBe(false);
    });

    // Axios error format
    it('matches Axios error format', () => {
      expect(filter.canHandleError({ response: { status: 404 } }, 0, {})).toBe(
        true
      );
      expect(filter.canHandleError({ response: { status: 500 } }, 0, {})).toBe(
        false
      );
    });

    it('handles non-error objects safely', () => {
      expect(filter.canHandleError(null, 0, {})).toBe(false);
      expect(filter.canHandleError(undefined, 0, {})).toBe(false);
      expect(filter.canHandleError('error string', 0, {})).toBe(false);
      expect(filter.canHandleError(new Error('test'), 0, {})).toBe(false);
    });
  });

  describe('statusFilterRange', () => {
    const filter = statusCodeErrorFilterRange(500, 599);

    it('matches status codes within range', () => {
      expect(filter.canHandleError({ status: 500 }, 0, {})).toBe(true);
      expect(filter.canHandleError({ status: 502 }, 0, {})).toBe(true);
      expect(filter.canHandleError({ status: 599 }, 0, {})).toBe(true);
      expect(filter.canHandleError({ status: 499 }, 0, {})).toBe(false);
      expect(filter.canHandleError({ status: 600 }, 0, {})).toBe(false);
    });
  });

  describe('predefined filters', () => {
    it('serverErrorFilter matches 5xx codes', () => {
      expect(
        serverErrorErrorFilter.canHandleError({ status: 500 }, 0, {})
      ).toBe(true);
      expect(
        serverErrorErrorFilter.canHandleError({ status: 503 }, 0, {})
      ).toBe(true);
      expect(
        serverErrorErrorFilter.canHandleError({ status: 400 }, 0, {})
      ).toBe(false);
    });

    it('clientErrorFilter matches 4xx codes', () => {
      expect(
        clientErrorErrorFilter.canHandleError({ status: 400 }, 0, {})
      ).toBe(true);
      expect(
        clientErrorErrorFilter.canHandleError({ status: 404 }, 0, {})
      ).toBe(true);
      expect(
        clientErrorErrorFilter.canHandleError({ status: 500 }, 0, {})
      ).toBe(false);
    });

    it('redirectFilter matches 3xx codes', () => {
      expect(redirectErrorFilter.canHandleError({ status: 301 }, 0, {})).toBe(
        true
      );
      expect(redirectErrorFilter.canHandleError({ status: 307 }, 0, {})).toBe(
        true
      );
      expect(redirectErrorFilter.canHandleError({ status: 400 }, 0, {})).toBe(
        false
      );
    });
  });

  describe('common library error formats', () => {
    const filter = statusCodeErrorFilterAny([404]);

    // Node-fetch error format
    it('matches node-fetch error format', () => {
      const fetchError = {
        name: 'FetchError',
        response: {
          status: 404,
          statusText: 'Not Found',
        },
      };
      expect(filter.canHandleError(fetchError, 0, {})).toBe(true);
    });

    // Node.js HTTP error format
    it('matches Node.js HTTP error format', () => {
      const httpError = {
        statusCode: 404,
        code: 'NotFound',
        message: 'Not Found',
      };
      expect(filter.canHandleError(httpError, 0, {})).toBe(true);
    });

    // Got error format
    it('matches Got error format', () => {
      const gotError = {
        response: {
          statusCode: 404,
          body: 'Not Found',
        },
      };
      expect(filter.canHandleError(gotError, 0, {})).toBe(true);
    });
  });
});
