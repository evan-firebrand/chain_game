/**
 * Dependency boundary checker.
 * Enforces the module dependency rules from ARCHITECTURE.md.
 *
 * Run: node scripts/check-boundaries.js
 * CI: included in required checks before any merge.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const SRC = join(ROOT, 'src');

/** Rules: [importer-glob, forbidden-import-containing-string, message] */
const RULES = [
  // game-kernel must not import anything from src/
  [
    'src/game-kernel',
    'src/',
    'game-kernel must be self-contained: no imports from anywhere in src/',
  ],
  // ui must not import from game-kernel directly
  [
    'src/ui',
    'game-kernel',
    'ui must import from game-session, never directly from game-kernel',
  ],
  // tuning-console must not import from game-kernel directly
  [
    'src/tuning-console',
    'game-kernel',
    'tuning-console must import from game-session, never directly from game-kernel',
  ],
  // sim-harness must not import from game-session or ui
  [
    'src/sim-harness',
    'game-session',
    'sim-harness must import from game-kernel only, not from game-session',
  ],
  [
    'src/sim-harness',
    'src/ui',
    'sim-harness must not import from ui',
  ],
];

function getAllTsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...getAllTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results;
}

function extractImports(content) {
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

let violations = 0;

for (const file of getAllTsFiles(SRC)) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const content = readFileSync(file, 'utf8');
  const imports = extractImports(content);

  for (const [importerPattern, forbiddenPattern, message] of RULES) {
    if (rel.startsWith(importerPattern)) {
      for (const imp of imports) {
        if (imp.includes(forbiddenPattern)) {
          console.error(`BOUNDARY VIOLATION in ${rel}:`);
          console.error(`  Import: "${imp}"`);
          console.error(`  Rule: ${message}`);
          console.error('');
          violations++;
        }
      }
    }
  }
}

if (violations > 0) {
  console.error(`${violations} boundary violation(s) found. Fix before merging.`);
  process.exit(1);
} else {
  console.log('Boundary check passed.');
}
