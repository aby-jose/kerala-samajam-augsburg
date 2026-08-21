import type { NextConfig } from "next";

import { LEGAL_ALIASES } from "./src/lib/legal-schema";
import { MAX_VIDEO_BYTES } from "./src/lib/upload-validation";

const nextConfig: NextConfig = {
  /**
   * pdfkit reads its built-in font metrics (`data/Helvetica.afm` and friends)
   * off disk relative to `__dirname`. Bundled into the server chunk that
   * becomes `/ROOT`, so every PDF failed with ENOENT on
   * `<drive>:\ROOT\node_modules\pdfkit\js\data\Helvetica.afm`. Loading it as a
   * plain runtime require keeps `__dirname` pointing at the real package.
   */
  serverExternalPackages: ["pdfkit"],

  /**
   * Every user-facing upload — gallery media, event covers, sponsor logos,
   * profile pictures, the site logo — goes through `uploadToCloudinary()`
   * and comes back as a `res.cloudinary.com` URL (see `src/lib/cloudinary.ts`).
   * That is the only external host `next/image` needs to trust; OAuth avatar
   * URLs (Google/Facebook) stay on plain `<img>` deliberately, since they're
   * small and their host varies by provider.
   */
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },

  /**
   * Every media upload in the app (gallery images, event covers, profile
   * pictures, the site logo) goes through a Server Action, not a route
   * handler — the file rides along as part of the action's request body.
   * Next's default body limit for that is 1 MB, so anything past a tiny
   * thumbnail was rejected before it ever reached `validateUpload()`'s own
   * (much larger) size check. Match it to the biggest thing we actually
   * accept — video — so the app's own limits are what govern uploads.
   */
  experimental: {
    serverActions: {
      bodySizeLimit: MAX_VIDEO_BYTES,
    },
  },

  /**
   * Short and German-language aliases for the legal pages.
   *
   * The canonical route is `/legal/<slug>`, but German visitors (and German
   * authorities) look for `/impressum` and `/datenschutz`, and the footer has
   * always linked `/privacy` and `/terms`. All of them resolve here rather
   * than duplicating the page.
   */
  async redirects() {
    return Object.entries(LEGAL_ALIASES).map(([source, slug]) => ({
      source,
      destination: `/legal/${slug}`,
      permanent: true,
    }));
  },

  /**
   * Baseline security headers.
   *
   * `frame-ancestors 'none'` is the one that matters most here: without it the
   * admin panel could be framed by another site and clicked through by a
   * signed-in administrator.
   *
   * There is deliberately no `script-src` CSP yet. Next's inline bootstrap and
   * the runtime style injection need either a nonce or `unsafe-inline`, and a
   * CSP containing `unsafe-inline` mostly provides reassurance rather than
   * protection. Doing it properly means a nonce threaded through the proxy —
   * worth doing, but not something to switch on untested.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // The gallery's face search uses the camera, so it stays enabled
            // for our own origin; nothing here needs mic or location.
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            // Only meaningful over HTTPS; browsers ignore it on plain HTTP,
            // so it is safe to send in development too.
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
      {
        // Nothing under the admin panel or the ticket endpoint should ever be
        // indexed or held in a shared cache — both serve personal data.
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
