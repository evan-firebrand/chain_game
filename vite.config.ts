import { defineConfig } from 'vite';
import { execSync } from 'child_process';

function gitBranch(): string {
  // Vercel sets this during preview/production builds
  if (process.env.VERCEL_GIT_COMMIT_REF) return process.env.VERCEL_GIT_COMMIT_REF;
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  define: {
    __GIT_BRANCH__: JSON.stringify(gitBranch()),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 3000,
  },
});
