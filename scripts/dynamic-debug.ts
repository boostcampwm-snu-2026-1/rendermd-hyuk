/**
 * Multi-modal dynamic-debug harness.
 *
 * Opens the (built / deployed) page in headless chromium and, for each
 * scripted UI state, captures three signals side-by-side:
 *   - screenshot.png         (what the user would see)
 *   - console.txt            (window.console.* + pageerror)
 *   - network.json           (request URL, status, content-type, ms)
 *
 * These are written under docs/screenshots/dynamic/<state>/. The
 * directory is the input an AI dynamic-debug agent reads to flag
 * undefined visual / UX regressions — anything the lint/test/visual-
 * regression gates can't pre-define.
 *
 * Usage:
 *   pnpm dlx tsx scripts/dynamic-debug.ts                # against deployed
 *   SITE=http://localhost:4173/ pnpm dlx tsx scripts/dynamic-debug.ts
 */

import { chromium, type Page, type Request, type Response } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_SITE = 'https://boostcampwm-snu-2026-1.github.io/rendermd-hyuk/';
const SITE = process.env.SITE ?? DEFAULT_SITE;
const OUT_ROOT = path.resolve(process.cwd(), 'docs/screenshots/dynamic');

interface NetEntry {
  url: string;
  method: string;
  status: number;
  contentType: string;
  durationMs: number;
  failure: string | null;
}

interface StateCapture {
  name: string;
  prepare: (page: Page) => Promise<void>;
}

const STATES: StateCapture[] = [
  {
    name: '01-initial',
    prepare: async (_p) => {
      // No-op — capture the page as it loads.
    },
  },
  {
    name: '02-after-typing',
    prepare: async (page) => {
      await page.locator('.cm-content').click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Delete');
      await page.keyboard.type(
        '# Hello\n\nA paragraph with $E=mc^2$ inline math.\n\n```ts\nconst x: number = 1;\n```\n',
      );
      await page.waitForTimeout(400);
    },
  },
  {
    name: '03-insert-link-modal',
    prepare: async (page) => {
      // Open the Insert > Link dialog from the toolbar. This is the
      // platform-independent modal: ExportButton's modal is iOS-Safari-
      // only (handleClick goes straight to window.print() on other
      // platforms — discovered via this harness).
      const linkBtn = page.getByRole('button', { name: /link/i }).first();
      await linkBtn.waitFor({ state: 'visible', timeout: 5_000 });
      await linkBtn.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
      await page.waitForTimeout(200);
    },
  },
  {
    name: '04-theme-cycled',
    prepare: async (page) => {
      // Click the theme switcher button — cycles to next theme.
      const themeBtn = page.locator('button[aria-label*="theme" i]').first();
      if ((await themeBtn.count()) > 0) {
        await themeBtn.click();
        await page.waitForTimeout(200);
      }
    },
  },
  {
    name: '05-mobile-viewport',
    prepare: async (page) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
    },
  },
];

async function captureState(
  page: Page,
  state: StateCapture,
  reset: () => Promise<void>,
): Promise<void> {
  await reset();
  const consoleLog: string[] = [];
  const network: NetEntry[] = [];
  const timing = new Map<string, number>();

  const consoleHandler = (msg: import('playwright').ConsoleMessage) => {
    consoleLog.push(`[${msg.type()}] ${msg.text()}`);
  };
  const errorHandler = (err: Error) => {
    consoleLog.push(`[pageerror] ${err.message}`);
  };
  const requestHandler = (req: Request) => {
    timing.set(req.url(), Date.now());
  };
  const responseHandler = async (res: Response) => {
    const url = res.url();
    const started = timing.get(url) ?? Date.now();
    network.push({
      url,
      method: res.request().method(),
      status: res.status(),
      contentType: res.headers()['content-type'] ?? '',
      durationMs: Date.now() - started,
      failure: null,
    });
  };
  const requestFailedHandler = (req: Request) => {
    const url = req.url();
    const started = timing.get(url) ?? Date.now();
    network.push({
      url,
      method: req.method(),
      status: 0,
      contentType: '',
      durationMs: Date.now() - started,
      failure: req.failure()?.errorText ?? 'unknown',
    });
  };

  page.on('console', consoleHandler);
  page.on('pageerror', errorHandler);
  page.on('request', requestHandler);
  page.on('response', responseHandler);
  page.on('requestfailed', requestFailedHandler);
  try {
    await state.prepare(page);
  } finally {
    page.off('console', consoleHandler);
    page.off('pageerror', errorHandler);
    page.off('request', requestHandler);
    page.off('response', responseHandler);
    page.off('requestfailed', requestFailedHandler);
  }

  const dir = path.join(OUT_ROOT, state.name);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, 'screenshot.png'), fullPage: false });
  writeFileSync(
    path.join(dir, 'console.txt'),
    consoleLog.length > 0 ? consoleLog.join('\n') + '\n' : '(no console output)\n',
  );
  writeFileSync(path.join(dir, 'network.json'), JSON.stringify(network, null, 2) + '\n');
  const failures = network.filter((n) => n.failure || n.status >= 400);
  const errors = consoleLog.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  console.log(
    `✓ ${state.name}  (${network.length} req, ${failures.length} fail, ${errors.length} err)`,
  );
}

async function main() {
  mkdirSync(OUT_ROOT, { recursive: true });
  console.log(`Capturing dynamic-debug states against ${SITE}\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const reset = async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(SITE + (SITE.includes('?') ? '&' : '?') + 'cb=' + Date.now(), {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('.cm-editor', { timeout: 15_000 });
  };

  for (const state of STATES) {
    await captureState(page, state, reset);
  }

  await browser.close();
  console.log(`\nDone. Inspect ${path.relative(process.cwd(), OUT_ROOT)}/<state>/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
