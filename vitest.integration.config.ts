import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.int.test.ts'],
    setupFiles: ['tests/integration/setup-env.ts'],
    // Integration tests share one DB; run serially to avoid cross-test interference.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
