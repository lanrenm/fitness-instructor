import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

interface EmbedResponse {
  html: string;
  /**
   * Server-fetched CSS contents, in the order Next.js's CSS pipeline
   * emitted the corresponding <link rel="stylesheet"> tags. Injected as
   * <style> tags (NOT <link>) to avoid Next.js dev's blockCrossSiteDEV
   * 403 on cross-origin Referer fetches of /_next/static/*. See
   * apps/bff/src/app/api/embed/auth/route.ts for the full rationale.
   */
  inlineCss: string[];
  /**
   * Step 2a: URL of the BFF-built standalone embed bundle
   * (apps/bff/rspack.embed.config.mjs → public/mf-auth/embed.js). The
   * bundle exports window.__AUTH_EMBED_MOUNT__(shadowRoot, hostElement)
   * and mounts AuthPage with its own inlined React 19.2.4 inside the
   * shadow root. Cross-shadow-boundary success events come back as
   * `auth-success` CustomEvents on the host element.
   */
  bundleUrl: string;
}

export default function LoginPage() {
  const [embed, setEmbed] = useState<EmbedResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const unmountRef = useRef<(() => void) | null>(null);
  const navigate = useNavigate();

  const loadEmbed = async () => {
    setLoadError(null);
    try {
      const res = await fetch('/api/embed/auth');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EmbedResponse = await res.json();
      setEmbed(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '未知错误');
    }
  };

  useEffect(() => {
    loadEmbed();
  }, []);

  // Step 2a: build the shadow DOM, inject first-paint HTML+CSS, load
  // the bundle, hand off to its mount function. Tear down on unmount
  // (route change, retry after error, etc.).
  //
  // The auth-success CustomEvent listener is registered INSIDE this
  // effect (not in a separate one), because the host <div> doesn't
  // exist until the `if (!embed)` guard above returns true — the first
  // render JSX is the "加载中..." placeholder, and `hostRef.current`
  // is null until the placeholder is replaced by the real host div on
  // the post-embed re-render. A standalone useEffect would capture
  // null on mount and never re-run (deps `[navigate]` don't change
  // across the embed-state update).
  useEffect(() => {
    if (!embed || !hostRef.current) return;
    const hostEl = hostRef.current;

    // Listen for the bundle's `auth-success` CustomEvent. composed:true
    // on the bundle side lets it traverse the shadow boundary and reach
    // this listener on the host element.
    const handler = (e: Event) => {
      const { accessToken, refreshToken } = (e as CustomEvent).detail ?? {};
      if (!accessToken || !refreshToken) {
        // eslint-disable-next-line no-console
        console.error('[web] auth-success missing tokens:', (e as CustomEvent).detail);
        return;
      }
      // authService.setTokens writes memory first then tries localStorage;
      // returning { mode } so we could surface "running in private mode"
      // to the user, but we don't need to here — the navigate happens
      // regardless of which storage backend accepted the tokens.
      authService.setTokens(accessToken, refreshToken);
      // replace:true so the browser back button after Home doesn't drop
      // the user back into the (now-redirecting) login page.
      navigate('/', { replace: true });
    };
    hostEl.addEventListener('auth-success', handler);

    // attachShadow can only be called ONCE per host element — calling
    // it twice throws NotSupportedError. React StrictMode runs effects
    // twice in dev (mount → cleanup → mount) to surface this kind of
    // non-idempotent bug. We reuse any existing shadow root instead
    // of re-attaching; the cleanup function below clears the shadow
    // contents so the second mount starts clean.
    let shadow: ShadowRoot;
    if (hostEl.shadowRoot) {
      shadow = hostEl.shadowRoot;
      shadow.innerHTML = '';
    } else {
      shadow = hostEl.attachShadow({ mode: 'open' });
    }

    // First-paint: SSR HTML + Next.js's CSS chunks (Step 1 leftovers).
    // The SSR HTML uses Next.js's CSS Module hash format, which does
    // NOT match the bundle's class names — so once React mounts and
    // the bundle's CSS takes over, we remove the SSR scaffolding.
    if (embed.inlineCss.length) {
      const ssrStyle = document.createElement('style');
      ssrStyle.dataset.authEmbedSrc = 'ssr';
      ssrStyle.textContent = embed.inlineCss.join('\n');
      shadow.appendChild(ssrStyle);
    }

    const ssrContainer = document.createElement('div');
    ssrContainer.dataset.authEmbedSrc = 'ssr';
    ssrContainer.innerHTML = embed.html;
    shadow.appendChild(ssrContainer);

    // Load the embed bundle. <script src> inside a shadow root DOES
    // execute (BFF's next.config.ts has CORS headers for
    // /mf-auth-embed/*). The bundle uses style-loader's lazy mode —
    // styles are NOT injected at script-eval time. mountAuthPage
    // (called from this onload) calls .use() on each CSS module and
    // moves the resulting <style> tags into the shadow root.
    const script = document.createElement('script');
    script.src = embed.bundleUrl;
    script.onload = () => {
      const mount = (window as Window & {
        __AUTH_EMBED_MOUNT__?: (
          shadowRoot: ShadowRoot,
          hostElement: HTMLElement,
        ) => () => void;
      }).__AUTH_EMBED_MOUNT__;
      if (typeof mount !== 'function') {
        // eslint-disable-next-line no-console
        console.error('[web] __AUTH_EMBED_MOUNT__ missing after bundle load');
        return;
      }
      // mount() triggers lazy style injection (lands in document.head)
      // and moves each <style> into the shadow root, then renders
      // <AuthPage/> via createRoot.
      unmountRef.current = mount(shadow, hostEl);
      // SSR scaffolding no longer needed — its Next.js class names
      // don't match the bundle's CSS, so it would render unstyled
      // alongside the React tree.
      ssrContainer.remove();
    };
    script.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('[web] failed to load embed bundle:', embed.bundleUrl);
    };
    shadow.appendChild(script);

    return () => {
      hostEl.removeEventListener('auth-success', handler);
      unmountRef.current?.();
      unmountRef.current = null;
      // Clear shadow contents for StrictMode's re-mount. attachShadow
      // can only be called once per host, so we keep the same shadow
      // root and reset it via innerHTML = ''. The next mount's mount()
      // call re-injects CSS via .use() and re-renders the React tree.
      shadow.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed, navigate]);

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
        <p className="text-red-500 text-center">
          认证模块加载失败：{loadError}
        </p>
        <button
          onClick={loadEmbed}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          点击重试
        </button>
      </div>
    );
  }

  if (!embed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  // The host element. Everything inside lives in the shadow root.
  return <div ref={hostRef} data-auth-embed-host="" />;
}