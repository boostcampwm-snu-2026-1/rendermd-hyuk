/**
 * Render-corpus harness.
 *
 * Paste each markdown fixture under scripts/fixtures/ into the running
 * site, capture a screenshot, and assert minimum render counts (KaTeX
 * displays, hljs code blocks, page-break markers). Used both by the
 * naive-client agent during PR review (see workflow.md §3.A) and as a
 * CI guard against rendering regressions.
 *
 * Usage:
 *   pnpm dlx tsx scripts/render-corpus.ts                          # live URL
 *   SITE=http://localhost:8080 pnpm dlx tsx scripts/render-corpus.ts
 *
 * Per-fixture expectations live in the EXPECTATIONS table below, keyed
 * by file basename. To add a new fixture: drop it under fixtures/ and
 * add a row. Defaults (all zeros) apply for unlisted fixtures.
 *
 * A `noConsoleErrors: true` row also requires zero browser-console
 * errors during render — catches things like KaTeX parse failures
 * that would otherwise look fine in a screenshot.
 */

import { chromium, type Page } from 'playwright';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SITE = process.env.SITE ?? 'https://boostcampwm-snu-2026-1.github.io/rendermd-hyuk/';
const FIXTURES_DIR = path.resolve(process.cwd(), 'scripts/fixtures');
const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/corpus');

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
  expected: Expect;
  reason?: string;
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
    const { pass, reason } = evaluate(name, observed, exp);
    results.push({ name, pass, observed, expected: exp, reason });
    const file = path.join(OUT_DIR, name.replace(/\.md$/, '.png'));
    await page.screenshot({ path: file, fullPage: false });
    console.log(`${pass ? '✓' : '✗'} ${name}  ${pass ? '' : `— ${reason}`}`);
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
