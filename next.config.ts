import type { NextConfig } from "next";

import { LEGAL_ALIASES } from "./src/lib/legal-schema";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
