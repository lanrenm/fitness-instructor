import EmbedAuthClient from './EmbedAuthClient';

/**
 * BFF-side SSR for the embeddable AuthPage. Server component — the
 * client boundary is EmbedAuthClient. See EmbedAuthClient.tsx for why
 * the wrapper exists. /api/embed/auth fetches this route's HTML and
 * CSS chunks to produce the embed JSON the host injects.
 */
export default function EmbedAuthPage() {
  return <EmbedAuthClient />;
}
