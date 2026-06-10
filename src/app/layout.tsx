import type { Metadata, Viewport } from 'next';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import './globals.css';
import './themes.css';
import './print.css';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MathAlignProvider } from '@/contexts/MathAlignContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const SITE_NAME = 'rendermd';
const SITE_DESCRIPTION =
  'Realtime markdown preview and PDF export, built for cleaning up LLM-generated markdown.';

// Absolute base ORIGIN (no path) for OG/Twitter/canonical resolution.
// Next prepends basePath to image asset URLs automatically (so /og.png
// becomes /rendermd-hyuk/og.png), so metadataBase must NOT include basePath
// or we'd get /rendermd-hyuk/rendermd-hyuk/og.png. For text-link fields
// (canonical, og:url) Next does NOT auto-add basePath, so we prepend it
// manually.
const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://boostcampwm-snu-2026-1.github.io';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const SITE_PATH = `${BASE_PATH}/`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'jay20012024' }],
  keywords: ['markdown', 'pdf', 'preview', 'llm', 'editor', 'export'],
  alternates: {
    canonical: SITE_PATH,
  },
  openGraph: {
    type: 'website',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    url: SITE_PATH,
    // opengraph-image.png in app/ is picked up automatically.
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
  ],
};

// NOTE: storage keys and value literals are duplicated from
// src/contexts/ThemeContext.tsx and MathAlignContext.tsx because this
// script runs before React loads and cannot import TS modules. Keep
// them in sync.
const preReactInitScript = `(function(){try{
  var t=localStorage.getItem('rendermd:theme');
  if(t==='light'||t==='dark'||t==='sepia'||t==='hc'){document.documentElement.setAttribute('data-theme',t);}
  var m=localStorage.getItem('rendermd:math-align');
  if(m==='center'||m==='left'){document.documentElement.setAttribute('data-math-align',m);}
}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preReactInitScript }} />
      </head>
      <body>
        {/*
         * ErrorBoundary deliberately sits OUTSIDE the providers: if a
         * provider itself throws, the fallback still renders with sensible
         * colors because the inline script above has already applied
         * [data-theme] (and [data-math-align]) on <html> before React
         * mounts. The fallback CSS vars resolve against that.
         */}
        <ErrorBoundary>
          <ThemeProvider>
            <MathAlignProvider>{children}</MathAlignProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
