import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        // retirement.ts is a Phase 4 stub — excluded until Phase 4 gate
        'src/game-kernel/retirement.ts',
        // ui/ runs in the browser — unit coverage not enforced (ARCHITECTURE.md)
        'src/ui/**',
        // game-session tests are a Phase 3 follow-up
        'src/game-session/**',
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
