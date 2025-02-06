# Advanced-Retry

A powerful and flexible retry library for TypeScript/JavaScript with support for custom retry strategies, error filtering, abort signals, and so much more.

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]

## Features

- 🎯 Type-safe API with focus on Developer Experience and reliable tests

- 🔄 Flexible retry strategies with defaults

- 🎉 Custom error resolvers, with full type safety and support for async/await

- 📊 Context passing between retry attempts

- 🎨 Powerful error filtering system, with support for status code, keyword and custom filters

- ⏱️ Timeout and abort signal support

- 📈 Retry statistics

- 🔍 Multiple operation handling

## Install

```bash
npm install advanced-retry
```

## Basic Usage

```typescript
import { executeWithRetry, delayedRetryErrorResolver } from 'advanced-retry';

// Simple retry with linear backoff
const result = await executeWithRetry({
  operation: async () => {
    const response = await fetch('https://api.example.com/data');
    if (!response.ok) throw new Error('API request failed');
    return response.json();
  },
  errorResolvers: [
    delayedRetryErrorResolver({
      configuration: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      },
    }),
  ],
});

if (result.success) {
  console.log('Data:', result.result);
  console.log('Attempts needed:', result.totalAttemptsToSucceed);
} else {
  console.error('Failed:', result.error);
}
```

## Advanced Usage

### Error Filtering

```typescript
import {
  executeWithRetry,
  customRetryErrorResolver,
  keywordFilterAny,
  keywordFilterAll,
  allFilters,
  anyFilters,
} from 'advanced-retry';

// Retry only specific network errors
const result = await executeWithRetry({
  operation: async () => {
    // Your operation
  },
  errorResolvers: [
    customRetryErrorResolver({
      configuration: { maxRetries: 3 },
      // Combine multiple filters
      canHandleError: allFilters([
        keywordFilterAny(['network', 'timeout']),
        error => error instanceof NetworkError,
      ]),
      callback: async (error, attempt, config) => ({
        remainingAttempts: config.maxRetries - attempt,
        unrecoverable: false,
        context: { lastError: error.message },
      }),
    }),
  ],
});
```

### Context Passing Between Operations and Retries

```typescript
interface RetryContext {
  lastAttemptTime: number;
  serverUrl: string;
}

const result = await executeWithRetry<string, RetryContext>({
  operation: async context => {
    const url = context?.data?.serverUrl ?? 'primary-server.com';
    const response = await fetch(`https://${url}/api`);
    return response.text();
  },
  errorResolvers: [
    customRetryErrorResolver<{ maxRetries: number }, string>({
      configuration: { maxRetries: 3 },
      callback: (error, attempt, config, context) => ({
        remainingAttempts: config.maxRetries - attempt,
        unrecoverable: false,
        context: {
          lastAttemptTime: Date.now(),
          serverUrl: attempt > 0 ? 'backup-server.com' : 'primary-server.com',
        },
      }),
    }),
  ],
});
```

### Timeout and Abort Signal

```typescript
const controller = new AbortController();

const result = await executeWithRetry({
  operation: async (context, signal) => {
    const response = await fetch('https://api.example.com/data', {
      signal, // Pass the abort signal to fetch
    });
    return response.json();
  },
  errorResolvers: [
    delayedRetryErrorResolver({
      configuration: {
        maxRetries: 3,
        initialDelayMs: 1000,
        customDelay: ({ attempt }) =>
          Math.min(1000 * Math.pow(2, attempt), 5000),
      },
    }),
  ],
  overallTimeout: 10000, // 10 second total timeout
  abortSignal: controller.signal,
});

// Abort operation if needed
setTimeout(() => controller.abort(), 5000);
```

### Multiple Parallel Operations

```typescript
const results = await executeWithRetryAll({
  operations: [
    () => fetch('https://api1.example.com').then(r => r.json()),
    () => fetch('https://api2.example.com').then(r => r.json()),
  ],
  errorResolvers: [
    delayedRetryErrorResolver({
      configuration: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
      },
    }),
  ],
  overallTimeout: 15000,
});

results.forEach((result, index) => {
  if (result.success) {
    console.log(`API ${index + 1} succeeded:`, result.result);
  } else {
    console.error(`API ${index + 1} failed:`, result.error);
  }
});
```

## API Reference

### RetryOptions

```typescript
interface RetryOptions<T, X> {
  operation: (
    retryContext?: RetryContext<X>,
    abortSignal?: AbortSignal
  ) => Promise<T> | T;
  errorResolvers?: Array<ErrorResolverBase<RetryContext<X>, X>>;
  throwOnUnrecoveredError?: boolean;
  overallTimeout?: number;
  abortSignal?: AbortSignal;
}
```

### RetryResult

```typescript
interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  totalAttemptsToSucceed?: number;
  totalAttempts?: number;
  totalDurationMs: number;
}
```

### DelayedRetryPolicy

```typescript
interface DelayedRetryPolicy<X = any> {
  maxRetries: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  customDelay?: ({
    attempt,
    error,
    context,
    configuration,
  }: {
    attempt: number;
    error: unknown;
    context: RetryContext<X>;
    configuration: DelayedRetryPolicy;
  }) => number;
}
```

## Requirements

- Tested on Node.js 16.0 and higher
- TypeScript 4.5+ (for TypeScript users)

## Contributing

Contributions are always welcome! Please read our [contributing guidelines](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Running Tests

```bash
npm install
npm test
```

## Support

- 📫 For bugs and feature requests, please [open an issue](https://github.com/schaier-io/advanced-retry/issues/new/choose)
- 💬 For questions and discussions, please use [GitHub Discussions](https://github.com/schaier-io/advanced-retry/discussions)
- 📝 Read our [documentation](https://github.com/schaier-io/advanced-retry/wiki) for more detailed information

## FAQ

### Why should I use Advanced-Retry instead of other retry libraries?

Advanced-Retry provides superior type safety, flexible retry strategies, and comprehensive error handling while maintaining excellent performance.

### Can I use Advanced-Retry in a browser environment?

Yes! Advanced-Retry is fully compatible with both Node.js and browser environments.

## License

MIT

[build-img]: https://github.com/schaier-io/advanced-retry/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/schaier-io/advanced-retry/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/advanced-retry
[downloads-url]: https://www.npmtrends.com/advanced-retry
[npm-img]: https://img.shields.io/npm/v/advanced-retry
[npm-url]: https://www.npmjs.com/package/advanced-retry
[issues-img]: https://img.shields.io/github/issues/schaier-io/advanced-retry
[issues-url]: https://github.com/schaier-io/advanced-retry/issues
[codecov-img]: https://codecov.io/gh/schaier-io/advanced-retry/branch/main/graph/badge.svg
[codecov-url]: https://codecov.io/gh/schaier-io/advanced-retry
