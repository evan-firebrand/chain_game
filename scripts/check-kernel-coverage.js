/**
 * Enforces 100% coverage on src/game-kernel/.
 * Reads the lcov.info output from vitest --coverage.
 * Run after: npm run test:coverage
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const LCOV = join(ROOT, 'coverage', 'lcov.info');

if (!existsSync(LCOV)) {
  console.error('No coverage/lcov.info found. Run npm run test:coverage first.');
  process.exit(1);
}

const content = readFileSync(LCOV, 'utf8');
const sections = content.split('SF:').slice(1);

let violations = 0;

for (const section of sections) {
  const filePath = section.split('\n')[0].trim();
  if (!filePath.includes('src/game-kernel/') || filePath.includes('index.ts')) continue;

  const linesFound = parseInt(section.match(/LF:(\d+)/)?.[1] ?? '0', 10);
  const linesHit = parseInt(section.match(/LH:(\d+)/)?.[1] ?? '0', 10);
  const fnFound = parseInt(section.match(/FNF:(\d+)/)?.[1] ?? '0', 10);
  const fnHit = parseInt(section.match(/FNH:(\d+)/)?.[1] ?? '0', 10);
  const branchFound = parseInt(section.match(/BRF:(\d+)/)?.[1] ?? '0', 10);
  const branchHit = parseInt(section.match(/BRH:(\d+)/)?.[1] ?? '0', 10);

  const lineCov = linesFound > 0 ? linesHit / linesFound : 1;
  const fnCov = fnFound > 0 ? fnHit / fnFound : 1;
  const branchCov = branchFound > 0 ? branchHit / branchFound : 1;

  if (lineCov < 1 || fnCov < 1 || branchCov < 1) {
    console.error(`COVERAGE BELOW 100% in ${filePath}:`);
    console.error(`  Lines: ${linesHit}/${linesFound} (${(lineCov * 100).toFixed(1)}%)`);
    console.error(`  Functions: ${fnHit}/${fnFound} (${(fnCov * 100).toFixed(1)}%)`);
    console.error(`  Branches: ${branchHit}/${branchFound} (${(branchCov * 100).toFixed(1)}%)`);
    console.error('');
    violations++;
  }
}

if (violations > 0) {
  console.error(`${violations} kernel file(s) below 100% coverage. Required for Phase 1 gate.`);
  process.exit(1);
} else {
  console.log('Kernel coverage check passed (100%).');
}
