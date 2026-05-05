import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        // ui/ runs in the browser — unit coverage not enforced (ARCHITECTURE.md)
        'src/ui/**',
        // tuning-console DOM modules — no jsdom configured; covered by Evan UAT
        'src/tuning-console/console.ts',
        'src/tuning-console/controls.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ['text', 'lcov', 'html'],
    },
    typecheck: {
      enabled: true,
    },
  },
});
