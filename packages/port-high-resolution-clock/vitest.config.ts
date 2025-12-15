import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        // 95% branches: the remaining 5% are ?? null fallbacks in resolveEnvironment
        // for environments where globalThis.performance/process doesn't exist.
        // These are unreachable in Node.js where both globals always exist.
        branches: 95,
        statements: 100,
      },
    },
  },
});
