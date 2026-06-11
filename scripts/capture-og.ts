/**
 * Capture the OpenGraph image (1200×630) from the static HTML template.
 * Output: src/app/opengraph-image.png — Next 15 auto-emits the
 * appropriate <meta property="og:image"> tag.
 *
 * Apple Touch Icon (180×180) is generated from the same template at a
 * different crop / size.
 *
 * Usage:
 *   pnpm dlx tsx scripts/capture-og.ts
 */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEMPLATE = pathToFileURL(path.resolve('scripts/og-template.html')).href;
const OG_OUT = path.resolve('src/app/opengraph-image.png');
const APPLE_OUT = path.resolve('src/app/apple-icon.png');
const ICON_SVG_PATH = path.resolve('src/app/icon.svg');

// Read the canonical brand glyph from `src/app/icon.svg` so the apple-
// icon, the favicon, and any future brand renders stay byte-identical.
// Previously this script inlined a hand-written SVG that drifted away
// from icon.svg over time.
const ICON_PATHS =
  readFileSync(ICON_SVG_PATH, 'utf8')
    .replace(/<\?xml[^?]*\?>/, '')
    .match(/<(?:path|line)[^/]*\/>/g)
    ?.join('\n        ') ?? '';

async function main() {
  const browser = await chromium.launch();

  // OpenGraph: 1200×630, full template.
  {
    const ctx = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(TEMPLATE, { waitUntil: 'networkidle' });
    await page.screenshot({ path: OG_OUT, fullPage: false });
    console.log(`✓ ${path.relative(process.cwd(), OG_OUT)} (1200×630)`);
    await ctx.close();
  }

  // Apple Touch Icon: 180×180 square. Use the logo glyph alone (no
  // wordmark — illegible at 180px). Light-on-dark for OS tab and
  // homescreen consistency.
  {
    const ctx = await browser.newContext({
      viewport: { width: 180, height: 180 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(`<!doctype html><html><head><style>
      html, body { margin: 0; padding: 0; width: 180px; height: 180px;
        background: #111111; display: flex; align-items: center; justify-content: center; }
    </style></head><body>
      <svg width="118" height="118" viewBox="0 0 24 24" fill="none"
        stroke="#ededed" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        ${ICON_PATHS}
      </svg>
    </body></html>`);
    await page.screenshot({ path: APPLE_OUT, fullPage: false });
    console.log(`✓ ${path.relative(process.cwd(), APPLE_OUT)} (180×180)`);
    await ctx.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
