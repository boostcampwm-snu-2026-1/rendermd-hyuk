/**
 * Build + assert First Load JS budget for the / route.
 * Used as a replacement for the plain `pnpm build` step in CI so a
 * bundle regression fails the PR instead of sneaking through silently.
 *
 * Usage:
 *   pnpm dlx tsx scripts/check-perf-budget.ts        # uses default budget
 *   PERF_BUDGET_KB=150 pnpm dlx tsx scripts/check-perf-budget.ts
 *
 * Source of truth: `.next/diagnostics/route-bundle-stats.json` (Next 16+).
 * Each route entry lists every chunk URL the client downloads on first
 * paint; we sum their gzipped sizes from `.next/static/chunks/`. The
 * gzipped total matches what Next 15 used to print as "First Load JS"
 * in its build table — staying with that metric keeps historical
 * budgets meaningful across the upgrade.
 */

import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const BUDGET_KB = Number(process.env.PERF_BUDGET_KB ?? '160');
const ROUTE = process.env.PERF_BUDGET_ROUTE ?? '/';
const STATS_PATH = resolve('.next/diagnostics/route-bundle-stats.json');

console.log(`Building with First Load JS budget: ${BUDGET_KB} kB on ${ROUTE} route\n`);

const build = spawnSync('pnpm', ['build'], {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (build.status !== 0) {
  console.error('\n✗ Build failed');
  process.exit(build.status ?? 1);
}

interface RouteBundleStat {
  route: string;
  firstLoadUncompressedJsBytes: number;
  firstLoadChunkPaths: string[];
}

let stats: RouteBundleStat[];
try {
  stats = JSON.parse(readFileSync(STATS_PATH, 'utf8'));
} catch (err) {
  console.error(`\n✗ Could not read ${STATS_PATH}: ${(err as Error).message}`);
  console.error('  (Next 16+ emits this file; older versions used the build-table parse path.)');
  process.exit(2);
}

const entry = stats.find((s) => s.route === ROUTE);
if (!entry) {
  console.error(`\n✗ Route ${ROUTE} not present in route-bundle-stats.json`);
  console.error(`  Available: ${stats.map((s) => s.route).join(', ')}`);
  process.exit(2);
}

const projectRoot = resolve('.');
let totalGzippedBytes = 0;
for (const chunk of entry.firstLoadChunkPaths) {
  const absolute = join(projectRoot, chunk);
  try {
    statSync(absolute);
  } catch {
    console.error(`\n✗ Chunk listed in stats but missing on disk: ${chunk}`);
    process.exit(2);
  }
  totalGzippedBytes += gzipSync(readFileSync(absolute)).length;
}

const kb = totalGzippedBytes / 1024;
const rawKb = entry.firstLoadUncompressedJsBytes / 1024;

console.log(`— Perf budget check —`);
console.log(`${ROUTE} route First Load JS:`);
console.log(`  ${kb.toFixed(2)} kB gzipped  (${rawKb.toFixed(2)} kB uncompressed)`);
console.log(
  `  ${entry.firstLoadChunkPaths.length} chunk${entry.firstLoadChunkPaths.length === 1 ? '' : 's'}`,
);
console.log(`Budget: ${BUDGET_KB.toFixed(2)} kB gzipped`);

if (kb > BUDGET_KB) {
  console.error(`\n✗ Exceeded budget by ${(kb - BUDGET_KB).toFixed(2)} kB.`);
  console.error('  Either: (a) justify the regression in the PR description and bump');
  console.error('  PERF_BUDGET_KB in .github/workflows/ci.yml, or (b) trim the bundle.');
  process.exit(1);
}

const margin = BUDGET_KB - kb;
console.log(`✓ Under budget (${margin.toFixed(2)} kB margin).`);
