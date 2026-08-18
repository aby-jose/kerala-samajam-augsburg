/**
 * The site's own address, from the same variables every email link uses.
 *
 * This used to be hardcoded in `app/layout.tsx` as the string
 * "https://ksaugsburg.de" — a domain that does not resolve. Every WhatsApp,
 * Facebook and LinkedIn preview of every page therefore pointed at nothing.
 * Reading it from the environment means the value is wrong in exactly one
 * place if it is wrong at all, and `email/tokens.ts` already warns when it is
 * unset or still localhost.
 *
 * Returns undefined rather than guessing when nothing is configured: callers
 * that build absolute URLs (metadata, sitemap, robots.txt, JSON-LD) then omit
 * them rather than advertising a dead address.
 */
export function siteUrl(): string | undefined {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "").trim();
  if (!raw || raw.includes("localhost") || raw.includes("127.0.0.1")) return undefined;

  // Tolerate a value saved without a scheme, and prefer https — a bare or
  // http:// origin here would publish insecure canonical links.
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/^http:\/\//, "https://").replace(/\/+$/, "");
}
