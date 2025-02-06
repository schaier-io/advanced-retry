import {
  statusCodeFilterAny,
  statusCodeFilterRange,
  serverErrorFilter,
  clientErrorFilter,
  redirectFilter,
} from '../../src/filter/status-code-filter';

describe('Status Filters', () => {
  describe('statusFilterAny', () => {
    const filter = statusCodeFilterAny([404, 429]);

    it('matches direct status property', () => {
      expect(filter.canHandle({ status: 404 }, 0, {})).toBe(true);
      expect(filter.canHandle({ status: 500 }, 0, {})).toBe(false);
    });

    it('matches statusCode property', () => {
      expect(filter.canHandle({ statusCode: 429 }, 0, {})).toBe(true);
      expect(filter.canHandle({ statusCode: 500 }, 0, {})).toBe(false);
    });

    // Axios error format
    it('matches Axios error format', () => {
      expect(filter.canHandle({ response: { status: 404 } }, 0, {})).toBe(true);
      expect(filter.canHandle({ response: { status: 500 } }, 0, {})).toBe(
        false
      );
    });

    it('handles non-error objects safely', () => {
      expect(filter.canHandle(null, 0, {})).toBe(false);
      expect(filter.canHandle(undefined, 0, {})).toBe(false);
      expect(filter.canHandle('error string', 0, {})).toBe(false);
      expect(filter.canHandle(new Error('test'), 0, {})).toBe(false);
    });
  });

  describe('statusFilterRange', () => {
    const filter = statusCodeFilterRange(500, 599);

    it('matches status codes within range', () => {
      expect(filter.canHandle({ status: 500 }, 0, {})).toBe(true);
      expect(filter.canHandle({ status: 502 }, 0, {})).toBe(true);
      expect(filter.canHandle({ status: 599 }, 0, {})).toBe(true);
      expect(filter.canHandle({ status: 499 }, 0, {})).toBe(false);
      expect(filter.canHandle({ status: 600 }, 0, {})).toBe(false);
    });
  });

  describe('predefined filters', () => {
    it('serverErrorFilter matches 5xx codes', () => {
      expect(serverErrorFilter.canHandle({ status: 500 }, 0, {})).toBe(true);
      expect(serverErrorFilter.canHandle({ status: 503 }, 0, {})).toBe(true);
      expect(serverErrorFilter.canHandle({ status: 400 }, 0, {})).toBe(false);
    });

    it('clientErrorFilter matches 4xx codes', () => {
      expect(clientErrorFilter.canHandle({ status: 400 }, 0, {})).toBe(true);
      expect(clientErrorFilter.canHandle({ status: 404 }, 0, {})).toBe(true);
      expect(clientErrorFilter.canHandle({ status: 500 }, 0, {})).toBe(false);
    });

    it('redirectFilter matches 3xx codes', () => {
      expect(redirectFilter.canHandle({ status: 301 }, 0, {})).toBe(true);
      expect(redirectFilter.canHandle({ status: 307 }, 0, {})).toBe(true);
      expect(redirectFilter.canHandle({ status: 400 }, 0, {})).toBe(false);
    });
  });

  describe('common library error formats', () => {
    const filter = statusCodeFilterAny([404]);

    // Node-fetch error format
    it('matches node-fetch error format', () => {
      const fetchError = {
        name: 'FetchError',
        response: {
          status: 404,
          statusText: 'Not Found',
        },
      };
      expect(filter.canHandle(fetchError, 0, {})).toBe(true);
    });

    // Node.js HTTP error format
    it('matches Node.js HTTP error format', () => {
      const httpError = {
        statusCode: 404,
        code: 'NotFound',
        message: 'Not Found',
      };
      expect(filter.canHandle(httpError, 0, {})).toBe(true);
    });

    // Got error format
    it('matches Got error format', () => {
      const gotError = {
        response: {
          statusCode: 404,
          body: 'Not Found',
        },
      };
      expect(filter.canHandle(gotError, 0, {})).toBe(true);
    });
  });
});
