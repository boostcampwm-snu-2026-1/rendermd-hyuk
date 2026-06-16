/**
 * Render-corpus harness.
 *
 * Paste each markdown fixture under scripts/fixtures/ into the running
 * site, capture a screenshot, and assert:
 *   - DOM render counts (KaTeX displays, hljs blocks, page-break markers)
 *   - Zero console / pageerror noise (when noConsoleErrors)
 *   - L6 visual regression against committed baselines (pixelmatch)
 *
 * Used both by the naive-client agent during PR review (see
 * workflow.md §3.A) and as a CI guard against rendering regressions.
 *
 * Usage:
 *   pnpm dlx tsx scripts/render-corpus.ts                            # live URL
 *   SITE=http://localhost:8080 pnpm dlx tsx scripts/render-corpus.ts
 *   UPDATE_BASELINE=1 SITE=… pnpm dlx tsx scripts/render-corpus.ts   # accept current as baseline
 *
 * Per-fixture expectations live in the EXPECTATIONS table below, keyed
 * by file basename. To add a new fixture: drop it under fixtures/ and
 * add a row. Defaults (all zeros + DEFAULT_MAX_DIFF_PCT) apply for
 * unlisted fixtures.
 */

import { chromium, type Page } from 'playwright';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const DEFAULT_SITE = 'https://boostcampwm-snu-2026-1.github.io/rendermd-hyuk/';
const SITE = process.env.SITE ?? DEFAULT_SITE;
const FIXTURES_DIR = path.resolve(process.cwd(), 'scripts/fixtures');
const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/corpus');
const BASELINE_DIR = path.resolve(process.cwd(), 'docs/screenshots/corpus-baseline');
// 6% of pixels different is the per-fixture cap — covers font
// anti-aliasing variance between a developer's machine (where
// baselines are usually seeded) and the CI runner. Empirically, CI vs
// local WSL Ubuntu chromium drifts up to ~5% for text-heavy fixtures
// purely from sub-pixel font hinting; tighter caps fire on every PR.
// Override per-fixture (e.g. tighter for layout-only screens, looser
// for Korean/CJK-heavy ones) via EXPECTATIONS.maxDiffPct.
const DEFAULT_MAX_DIFF_PCT = 0.06;
// Per-channel color sensitivity. 0.1 is pixelmatch's default.
const PIXELMATCH_THRESHOLD = 0.1;
// Set UPDATE_BASELINE=1 to write the current screenshot as the new
// baseline instead of comparing. Use after intentional visual changes.
const UPDATE_BASELINE = process.env.UPDATE_BASELINE === '1';

// Loud warn when SITE wasn't set explicitly — otherwise a local "no
// regressions" pass actually proved nothing about the working tree.
if (!process.env.SITE) {
  console.warn(
    `[render-corpus] SITE env var not set — defaulting to ${DEFAULT_SITE}.\n` +
      `             Local runs without SITE test the deployed production site,\n` +
      `             NOT your working tree. Set SITE=http://localhost:PORT to\n` +
      `             test the local build.`,
  );
}

interface Expect {
  /** Minimum number of `.katex-display` block-math nodes. */
  katexDisplay?: number;
  /** Minimum number of `.katex` inline-math nodes (includes displays). */
  katexAny?: number;
  /** Minimum number of `.hljs` highlighted code blocks. */
  hljs?: number;
  /** Minimum number of `.rendermd-page-break` markers in the preview DOM. */
  pageBreaks?: number;
  /** Whether the preview must report zero console errors during render. */
  noConsoleErrors?: boolean;
  /** Skip render-count assertions entirely (use for empty / smoke). */
  smokeOnly?: boolean;
  /**
   * Max fraction of pixels allowed to differ from the baseline (L6
   * visual regression). Defaults to {@link DEFAULT_MAX_DIFF_PCT}. Skip
   * the diff entirely by setting to `Infinity` (e.g., for fixtures
   * whose rendering is intentionally non-deterministic).
   */
  maxDiffPct?: number;
}

const EXPECTATIONS: Record<string, Expect> = {
  '01-math-mixed-delimiters.md': {
    // 4 display blocks: $$E=mc^2$$, \[ integral \], \[\begin{aligned}\], $$\begin{aligned}$$
    katexDisplay: 4,
    // + 2 inline: $\pi$, \(\sigma\)
    katexAny: 6,
    noConsoleErrors: true,
  },
  '02-code-blocks.md': {
    hljs: 3, // ts, py, bash
    noConsoleErrors: true,
  },
  '03-tables.md': {
    noConsoleErrors: true,
  },
  '04-korean-and-emoji.md': {
    katexDisplay: 1,
    noConsoleErrors: true,
  },
  '05-nested-gfm.md': {
    katexAny: 1,
    noConsoleErrors: true,
  },
  '06-long-paragraph.md': {
    noConsoleErrors: true,
  },
  '07-page-break.md': {
    pageBreaks: 3,
    noConsoleErrors: true,
  },
  '08-empty.md': {
    smokeOnly: true,
  },
  '09-headings-only.md': {
    noConsoleErrors: true,
  },
  '10-edge-cases.md': {
    noConsoleErrors: true,
  },
};

interface VisualResult {
  status: 'ok' | 'diff' | 'no-baseline' | 'updated' | 'skipped';
  diffPct?: number;
  diffPath?: string;
}

interface FixtureResult {
  name: string;
  pass: boolean;
  observed: {
    katexDisplay: number;
    katexAny: number;
    hljs: number;
    pageBreaks: number;
    errors: string[];
  };
  visual?: VisualResult;
  expected: Expect;
  reason?: string;
}

/**
 * L6 visual regression: compare current screenshot against the
 * committed baseline using per-pixel diff. Writes a diff PNG when the
 * fixture exceeds its tolerance so reviewers can see what changed.
 *
 * - First run on a new fixture has no baseline → returns 'no-baseline'.
 *   Run with UPDATE_BASELINE=1 to populate.
 * - Set maxDiffPct=Infinity to skip the diff for intentionally
 *   non-deterministic fixtures.
 */
function compareVisual(name: string, currentPath: string, maxDiffPct: number): VisualResult {
  if (maxDiffPct === Infinity) return { status: 'skipped' };
  const baselinePath = path.join(BASELINE_DIR, name.replace(/\.md$/, '.png'));
  if (UPDATE_BASELINE) {
    mkdirSync(BASELINE_DIR, { recursive: true });
    writeFileSync(baselinePath, readFileSync(currentPath));
    return { status: 'updated' };
  }
  if (!existsSync(baselinePath)) return { status: 'no-baseline' };
  const baseline = PNG.sync.read(readFileSync(baselinePath));
  const current = PNG.sync.read(readFileSync(currentPath));
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return { status: 'diff', diffPct: 1 };
  }
  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(baseline.data, current.data, diff.data, width, height, {
    threshold: PIXELMATCH_THRESHOLD,
  });
  const diffPct = mismatched / (width * height);
  if (diffPct <= maxDiffPct) return { status: 'ok', diffPct };
  const diffPath = path.join(OUT_DIR, name.replace(/\.md$/, '.diff.png'));
  writeFileSync(diffPath, PNG.sync.write(diff));
  return { status: 'diff', diffPct, diffPath };
}

async function loadFixture(p: Page, body: string) {
  await p.locator('.cm-content').click();
  await p.keyboard.press('Control+A');
  await p.keyboard.press('Delete');
  await p.locator('.cm-content').focus();
  if (body.length > 0) {
    await p.keyboard.insertText(body);
  }
  // Settle: react-markdown rebuild + KaTeX/hljs render.
  await p.waitForTimeout(500);
}

async function measure(p: Page) {
  return p.evaluate(`(function(){
    return {
      katexDisplay: document.querySelectorAll('.katex-display').length,
      katexAny: document.querySelectorAll('.katex').length,
      hljs: document.querySelectorAll('pre code.hljs, pre code[class*="language-"]').length,
      pageBreaks: document.querySelectorAll('.rendermd-page-break').length,
    };
  })()`) as Promise<{ katexDisplay: number; katexAny: number; hljs: number; pageBreaks: number }>;
}

function expectations(name: string): Expect {
  return EXPECTATIONS[name] ?? {};
}

function evaluate(
  name: string,
  observed: FixtureResult['observed'],
  expected: Expect,
): { pass: boolean; reason?: string } {
  if (expected.smokeOnly) return { pass: true };
  const reasons: string[] = [];
  if (expected.katexDisplay !== undefined && observed.katexDisplay < expected.katexDisplay)
    reasons.push(`katex-display ${observed.katexDisplay} < expected ${expected.katexDisplay}`);
  if (expected.katexAny !== undefined && observed.katexAny < expected.katexAny)
    reasons.push(`katex ${observed.katexAny} < expected ${expected.katexAny}`);
  if (expected.hljs !== undefined && observed.hljs < expected.hljs)
    reasons.push(`hljs ${observed.hljs} < expected ${expected.hljs}`);
  if (expected.pageBreaks !== undefined && observed.pageBreaks < expected.pageBreaks)
    reasons.push(`page-breaks ${observed.pageBreaks} < expected ${expected.pageBreaks}`);
  if (expected.noConsoleErrors && observed.errors.length > 0)
    reasons.push(`console errors: ${observed.errors.length} (${observed.errors[0].slice(0, 120)})`);
  return reasons.length === 0 ? { pass: true } : { pass: false, reason: reasons.join('; ') };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const files = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();
  if (files.length === 0) {
    console.error('No fixtures found in', FIXTURES_DIR);
    process.exit(1);
  }
  console.log(`Running ${files.length} fixtures against ${SITE}\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  await page.goto(SITE + (SITE.includes('?') ? '&' : '?') + 'cb=' + Date.now(), {
    waitUntil: 'networkidle',
  });
  await page.waitForSelector('.cm-editor', { timeout: 15_000 });

  const results: FixtureResult[] = [];
  for (const name of files) {
    errors.length = 0; // reset between fixtures
    const body = readFileSync(path.join(FIXTURES_DIR, name), 'utf8');
    await loadFixture(page, body);
    const m = await measure(page);
    const observed = { ...m, errors: [...errors] };
    const exp = expectations(name);
    const countCheck = evaluate(name, observed, exp);
    const file = path.join(OUT_DIR, name.replace(/\.md$/, '.png'));
    await page.screenshot({ path: file, fullPage: false });
    // L6 visual diff against committed baseline.
    const visual = compareVisual(name, file, exp.maxDiffPct ?? DEFAULT_MAX_DIFF_PCT);
    const visualFail =
      visual.status === 'diff'
        ? `visual diff ${(visual.diffPct! * 100).toFixed(2)}%${visual.diffPath ? ` (see ${path.relative(process.cwd(), visual.diffPath)})` : ''}`
        : null;
    const pass = countCheck.pass && !visualFail;
    const reason = [countCheck.reason, visualFail].filter(Boolean).join('; ') || undefined;
    results.push({ name, pass, observed, visual, expected: exp, reason });
    const visualTag =
      visual.status === 'no-baseline'
        ? ' (no visual baseline — run UPDATE_BASELINE=1 to seed)'
        : visual.status === 'updated'
          ? ' (visual baseline updated)'
          : visual.status === 'skipped'
            ? ''
            : visual.status === 'ok'
              ? ` (visual ${(visual.diffPct! * 100).toFixed(2)}% diff)`
              : '';
    console.log(`${pass ? '✓' : '✗'} ${name}${visualTag}${pass ? '' : `  — ${reason}`}`);
  }

  // Persist a JSON summary so CI / agents can diff over runs.
  writeFileSync(
    path.join(OUT_DIR, 'summary.json'),
    JSON.stringify({ site: SITE, results }, null, 2) + '\n',
  );

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} fixtures passed`);
  if (failed.length > 0) {
    console.error(`\nFailures:`);
    for (const f of failed) console.error(`  - ${f.name}: ${f.reason}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
