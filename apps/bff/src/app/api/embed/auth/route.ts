import { NextResponse } from 'next/server';

/**
 * Returns the SSR'd AuthPage as { html, inlineCss } JSON.
 *
 * Why server-side inline CSS instead of letting the host fetch <link>s:
 * - Next.js dev mode's blockCrossSiteDEV (see
 *   next/dist/server/lib/router-utils/block-cross-site-dev.js) rejects
 *   cross-site fetches of /_next/static/* unless the Referer host is in
 *   allowedDevOrigins. The default allowlist is `*.localhost` +
 *   `localhost` + the dev server's own hostname. In this project the web
 *   dev server is accessed via the Docker bridge IP (e.g. 172.30.x.x)
 *   rather than localhost, so the Referer falls outside the allowlist
 *   and the browser sees 403 on every CSS chunk.
 * - We side-step the entire check by fetching the CSS chunks server-side
 *   (same origin, no Referer issue) and inlining their text into the
 *   embed JSON. The host injects <style> tags instead of <link> tags.
 *   Step 2a (Shadow DOM) will put these <style>s inside the shadow root
 *   for full style isolation.
 *
 * Why we don't render via react-dom/server's renderToString:
 * - renderToString bypasses Next.js's CSS pipeline. The CSS chunks the
 *   AuthPage needs (its index.module.css, ui-components styles,
 *   globals.css, fonts) wouldn't be emitted as <link> tags at all.
 *
 * Why we fetch the page route instead of importing AuthPage directly:
 * - Same reason — only the page route goes through Next.js's HTML
 *   pipeline that emits <link rel="stylesheet"> tags.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  // cache: 'no-store' so the embed API never serves a stale render —
  // each fetch reflects the current AuthPage source.
  const pageResponse = await fetch(`${origin}/embed/auth`, {
    headers: { Accept: 'text/html' },
    cache: 'no-store',
  });

  if (!pageResponse.ok) {
    return NextResponse.json(
      { error: `Failed to render embed page: HTTP ${pageResponse.status}` },
      { status: 502 },
    );
  }

  const pageHtml = await pageResponse.text();

  const cssHrefs = extractStylesheetLinks(pageHtml);
  const html = extractBodyContent(pageHtml);

  // Resolve relative hrefs to absolute URLs (the API route may be hit via
  // a different host than the page route in some proxy setups).
  const absoluteUrls = cssHrefs.map((href) =>
    href.startsWith('http') ? href : new URL(href, origin).href,
  );

  // Fetch each CSS chunk server-side and inline its content. Same-origin
  // fetch — no cross-site Referer to trip blockCrossSiteDEV.
  const inlineCss = await Promise.all(
    absoluteUrls.map(async (cssUrl) => {
      try {
        const cssRes = await fetch(cssUrl, { cache: 'no-store' });
        if (!cssRes.ok) return '';
        return await cssRes.text();
      } catch {
        // A single CSS chunk failing shouldn't kill the whole embed —
        // return an empty string for that slot.
        return '';
      }
    }),
  );

  // Step 2a: also surface the client bundle URL so the host can load
  // it into the shadow root. The bundle (apps/bff/rspack.embed.config.mjs)
  // exports window.__AUTH_EMBED_MOUNT__(shadowRoot, hostElement) which
  // mounts AuthPage using its own inlined React 19.2.4 — independent of
  // the host's React 19.2.6. See embed-mount.tsx for the full rationale.
  return NextResponse.json({
    html,
    inlineCss,
    bundleUrl: '/mf-auth-embed/embed.js',
  });
}

function extractStylesheetLinks(html: string): string[] {
  // Match <link ...> tags regardless of attribute order, then filter
  // for rel="stylesheet". Next.js typically also emits <link rel="preload"
  // as="style"> tags pointing at the same CSS chunks — we don't need
  // those (the stylesheet link will trigger the browser fetch anyway).
  return Array.from(html.matchAll(/<link\b([^>]*)>/gi))
    .map((m) => m[1])
    .filter((attrs) => /\brel=["']stylesheet["']/i.test(attrs))
    .map((attrs) => {
      const m = attrs.match(/\bhref=["']([^"']+)["']/i);
      return m ? m[1] : null;
    })
    .filter((href): href is string => href !== null);
}

function extractBodyContent(html: string): string {
  // Non-greedy match between <body ...> and </body>. Step 1 keeps
  // Next.js's <script> tags inside <body> — they're inert when injected
  // via dangerouslySetInnerHTML. Step 2 may strip them to slim payload.
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1] : '';
}