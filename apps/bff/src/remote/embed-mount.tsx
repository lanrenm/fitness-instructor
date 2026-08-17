import { createRoot, type Root } from 'react-dom/client';
import AuthPage from './auth/_components/AuthPage';
import authPageStyles from './auth/_components/AuthPage/index.module.css';
import brandingStyles from './auth/_components/BrandingSection/index.module.css';
import loginFormStyles from './auth/_components/LoginForm/index.module.css';
import registerFormStyles from './auth/_components/RegisterForm/index.module.css';
import type { AuthSuccessPayload } from './auth/_components/LoginForm';

/**
 * Step 2a: Shadow DOM + React bundle injection.
 *
 * Why this exists:
 * - Step 1 only injects SSR'd HTML+CSS. The form is inert — no event
 *   handlers, no mode switching, no submit.
 * - The BFF bundles React 19.2.4 + ReactDOM 19.2.4 + lucide-react +
 *   @fitness/ui-components + AuthPage into a single standalone script
 *   (see rspack.embed.config.mjs). The bundle does NOT share a React
 *   instance with the host (apps/web uses 19.2.6) — fully inlined to
 *   sidestep every MF share-scope pitfall documented in memory.
 * - Mounting happens inside a Shadow DOM so the AuthPage's CSS (and
 *   any future token-leakage concerns) stay isolated from the host.
 *
 * CSS injection strategy (lazy mode + manual move):
 * - rspack.embed.config.mjs configures style-loader with
 *   `injectType: 'lazyStyleTag'`. Each CSS module's default export
 *   becomes `{ use, unuse }` instead of injecting at module-eval
 *   time. style-loader v4 rejects function `insert` options (the
 *   loader-time code calls path.isAbsolute on it), so we can't
 *   inject directly into the shadow root at config time.
 * - mountAuthPage() calls .use() on each CSS module (which injects
 *   a <style data-embed-src="auth"> tag into document.head), then
 *   immediately moves every such tag into the shadow root. Moving
 *   (vs cloning) is simpler — appendChild on an already-attached
 *   node detaches it from the old parent and attaches to the new
 *   one in one operation.
 */
export type UnmountFn = () => void;

// All CSS modules whose styles we need inside the shadow root. Keep
// this list in sync with the components imported above.
const STYLE_MODULES = [
  authPageStyles,
  brandingStyles,
  loginFormStyles,
  registerFormStyles,
] as const;

export function mountAuthPage(
  shadowRoot: ShadowRoot,
  hostElement: HTMLElement,
): UnmountFn {
  // 1. Trigger lazy injection of every CSS module into document.head,
  //    then move each resulting <style> tag into the shadow root.
  //    Lazy mode defers injection until .use() is called, which gives
  //    us a clean synchronously-controlled injection point.
  for (const styles of STYLE_MODULES) {
    styles.use();
  }
  document.head
    .querySelectorAll<HTMLStyleElement>('style[data-embed-src="auth"]')
    .forEach((style) => {
      // appendChild on an already-attached node moves it. The original
      // reference is preserved; the element simply changes parents.
      shadowRoot.appendChild(style);
    });

  // 2. Create the React mount point. The bundle's css-loader uses a
  //    different hash algorithm than Next.js's Turbopack, so SSR HTML
  //    class names don't match the bundle's. We render fresh into an
  //    empty div; the bundle's own <style> tags (now in the shadow
  //    root) carry the matching class names.
  const mountEl = document.createElement('div');
  mountEl.dataset.authEmbedMount = 'bundle';
  shadowRoot.appendChild(mountEl);

  const root: Root = createRoot(mountEl);
  root.render(
    <AuthPage
      onSuccess={(data: AuthSuccessPayload) => {
        // Cross the shadow boundary via CustomEvent. composed:true lets
        // the event traverse the shadow root and bubble to the host
        // element. Detail carries the tokens; host decides what to do
        // (Step 2b: persist + redirect).
        hostElement.dispatchEvent(
          new CustomEvent('auth-success', {
            detail: data,
            bubbles: true,
            composed: true,
          }),
        );
      }}
    />,
  );

  return () => {
    root.unmount();
    mountEl.remove();
    // Drop references for cleanliness; lazy CSS modules are reusable
    // across mounts but we don't currently remount within a page.
    for (const styles of STYLE_MODULES) {
      styles.unuse();
    }
  };
}

// Expose as a global so the host can call mountAuthPage after the
// <script> tag's onload fires. Rspack's output.library.type = 'window'
// wraps this module's exports onto window.__AUTH_EMBED_MOUNT__, but we
// also set the global here as a belt-and-suspenders measure in case
// the library config drifts.
declare global {
  interface Window {
    __AUTH_EMBED_MOUNT__?: typeof mountAuthPage;
  }
}

if (typeof window !== 'undefined') {
  window.__AUTH_EMBED_MOUNT__ = mountAuthPage;
}