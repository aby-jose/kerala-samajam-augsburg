/**
 * The email design system's palette and type scale.
 *
 * These values are lifted from `globals.css` rather than invented, so an email
 * and the page it links to are recognisably the same thing. Where the site
 * expresses a colour as `hsl(var(--primary))`, here it is a literal hex: mail
 * clients have no custom properties, and Outlook's Word engine has no `hsl()`
 * either.
 *
 * The accent colours are *derived* from whatever an administrator has set as
 * the brand colour in settings, not hard-coded, so re-branding the site
 * re-brands the mail without anyone editing a template.
 */

/** Site default — rose 600, matching `--primary: 346.8 77.2% 49.8%`. */
export const DEFAULT_PRIMARY = "#e11d48";

export interface EmailBranding {
  logoUrl?: string;
  siteName?: string;
  primaryColor?: string;
}

export interface EmailTheme {
  /** Brand colour. Buttons, rules, accent marks. */
  primary: string;
  /** Brand at ~6% over white. Highlight panel fills. */
  primaryTint: string;
  /** Brand at ~15% over white. Panel borders on tinted fills. */
  primaryEdge: string;
  /** Brand darkened. Button borders, and link text where the flat brand
   *  colour would not clear 4.5:1 on white. */
  primaryDeep: string;
  /** Readable foreground on top of `primary`. */
  onPrimary: string;

  ink: string;
  body: string;
  muted: string;
  hairline: string;
  canvas: string;
  surface: string;
  surfaceAlt: string;

  /**
   * Section bands — the brand colour at 2.5% and 5% over white.
   *
   * The site's equivalents (`--surface-2` warm cream, `--surface-3` faint
   * blush) are hardcoded in `globals.css` and tuned to the rose default, so an
   * administrator who sets green would get pink bands beside green buttons.
   * Deriving them keeps the message in one colour family whatever they choose.
   *
   * Both are deliberately *fainter* than `primaryTint` (6%). A block that
   * filled itself with the tint would otherwise vanish on `bandB` — which is
   * why nothing in `blocks.ts` fills itself at all. The band is the container;
   * hairlines do the dividing inside it.
   */
  bandA: string;
  bandB: string;

  /**
   * The closing band, matching the site's `--surface-deep` (0 0% 6%).
   *
   * The home page ends on a dark call-to-action band before the footer, and
   * the message does the same. These are flat hex rather than white-at-alpha
   * because Outlook's Word engine does not composite 8-digit hex.
   */
  deep: string;
  deepInk: string;
  deepBody: string;
  deepMuted: string;
  deepHairline: string;
  deepEdge: string;
  /**
   * A step above `deep` — the same neutral the closing band's pill and ghost
   * button already sit on. Reused as the dark-mode fill for section panels and
   * chips on the light surface, so a message rendered in a dark-aware client
   * looks like one more layer of the same closing band rather than a second,
   * invented dark palette.
   */
  deepPanel: string;

  sans: string;
  mono: string;

  radius: string;
  radiusSm: string;
}

/**
 * The spacing scale.
 *
 * Every gap in every template comes from here. The previous version picked
 * margins per component — 22px here, 26px there, 16px somewhere else — which
 * is why the messages read as a pile of blocks rather than a document: there
 * was no rhythm for the eye to lock onto.
 */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  xxl: 34,
} as const;

/** Card width, and the horizontal padding that defines the text column. */
export const LAYOUT = {
  width: 600,
  gutter: 34,
  gutterMobile: 22,
} as const;

// --- Colour maths -----------------------------------------------------------
// Just enough to derive a tint and a shade. Nothing here needs a colour
// library, and pulling one in for two operations would be silly.

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const toHex = ([r, g, b]: [number, number, number]) =>
  "#" +
  [r, g, b]
    .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
    .join("");

/** `amount` of 0 returns `rgb` untouched, 1 returns pure `target`. */
const mix = (
  rgb: [number, number, number],
  target: [number, number, number],
  amount: number
): [number, number, number] => [
  rgb[0] + (target[0] - rgb[0]) * amount,
  rgb[1] + (target[1] - rgb[1]) * amount,
  rgb[2] + (target[2] - rgb[2]) * amount,
];

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/** WCAG relative luminance. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Build the full palette from one brand colour.
 *
 * An administrator can type any hex they like into settings, including a pale
 * yellow. Deriving `onPrimary` and `primaryDeep` by measured contrast rather
 * than assuming white-on-brand is what stops a legitimate brand choice from
 * producing an unreadable button.
 */
export function buildTheme(branding?: EmailBranding): EmailTheme {
  const rgb = parseHex(branding?.primaryColor || "") ?? parseHex(DEFAULT_PRIMARY)!;

  const onPrimary = contrast(rgb, WHITE) >= 3.5 ? "#ffffff" : "#1a1a1a";

  // Link and small-text uses need 4.5:1 on white; a mid-tone brand rarely
  // clears it, so darken until it does rather than shipping grey-on-white.
  let deep = mix(rgb, BLACK, 0.25);
  for (let i = 0; i < 8 && contrast(deep, WHITE) < 4.5; i++) {
    deep = mix(deep, BLACK, 0.12);
  }

  return {
    primary: toHex(rgb),
    primaryTint: toHex(mix(rgb, WHITE, 0.94)),
    primaryEdge: toHex(mix(rgb, WHITE, 0.82)),
    primaryDeep: toHex(deep),
    onPrimary,

    // Neutrals only, alongside the brand colour.
    //
    // There is deliberately no green/amber/red status palette. A message that
    // introduces its own hues stops looking like it came from this
    // association and starts looking like a dashboard — and with a
    // configurable brand colour, a fixed amber or teal will eventually clash
    // with it outright. Urgency is carried by the words in the eyebrow
    // ("SECURITY NOTICE", "EVENT CANCELLED") and by whether a block is
    // accented or plain, not by hue.
    // A warm neutral ramp rather than pure grey.
    //
    // The site's own surfaces are warm — `--surface-2` is a cream at hue 32 —
    // so pure-grey type on them reads slightly cold and slightly cheap. These
    // carry the faintest warmth, which is felt rather than seen. They are
    // still neutrals: no hue is doing any signalling.
    //
    // `muted` is the one that changed materially. At #8a8a8a it cleared only
    // 3.5:1 on white, and it is the colour every 11px section label and every
    // fact label is set in — the smallest type in the message was the least
    // legible. #78716c clears 4.8:1.
    ink: "#1c1a19",
    body: "#55504c",
    muted: "#78716c",
    hairline: "#eae7e4",
    canvas: "#f4f2f0",
    surface: "#ffffff",
    surfaceAlt: "#faf8f7",

    bandA: toHex(mix(rgb, WHITE, 0.975)),
    bandB: toHex(mix(rgb, WHITE, 0.95)),

    // Lifted from the home page's closing band — the "Become a Member of KSA"
    // section on `surface-deep`. That band expresses everything as white at an
    // alpha (`text-white/60`, `border-white/15`, `bg-white/[0.06]`); mail
    // clients composite 8-digit hex unreliably and Outlook's Word engine not
    // at all, so each one is precomputed flat over #0f0f0f.
    //
    // Neutral, not warm. An earlier pass warmed these to match the light ramp,
    // which put a set of greys in the message that appear nowhere on the site.
    deep: "#0f0f0f",
    deepInk: "#ffffff",
    /** white/60 — `SectionLead tone="dark"`. */
    deepBody: "#9f9f9f",
    /** white/40 — the faintest line, for the copyright. */
    deepMuted: "#6f6f6f",
    /** Divider between the closing band and the footer. */
    deepHairline: "#262626",
    /** white/15 — `border-white/15` on the eyebrow pill and the ghost button. */
    deepEdge: "#333333",
    deepPanel: "#1d1d1d",

    // One face, matching the site.
    //
    // `src/app/layout.tsx` loads Manrope and sets it on `body`; every heading
    // on the site is Manrope extrabold with tight tracking. Newsreader exists
    // there only as "the one italic serif word per headline" — a decorative
    // accent inside a sans heading, never a heading in its own right.
    //
    // These templates previously set whole headlines in a serif, which matched
    // nothing on the site and fell back to Georgia in every mail client that
    // strips web fonts. The fallback stack below is the ordinary system sans,
    // so a stripped Manrope degrades to something that still reads as the same
    // kind of type rather than a different voice.
    sans: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",

    radius: "16px",
    radiusSm: "10px",
  };
}

// --- Absolute URLs ----------------------------------------------------------

/**
 * The site's public origin.
 *
 * Every call to action in every email is built from this. When it is left at
 * its development value the mail still sends and still looks right, and every
 * button in it is dead — so a localhost value in a non-development environment
 * is escalated to a thrown error at render time rather than posted to members.
 */
export function siteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "").trim();
  const url = raw ? (raw.startsWith("http") ? raw : `https://${raw}`) : "https://keralasamajam.de";
  const normalised = url.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(normalised)) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL / SITE_URL still points at localhost in production. " +
        "Every link in every email would be dead — refusing to send."
    );
  }

  return normalised;
}

/** Resolve a possibly-relative path against the site origin. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Publicly reachable logo, hosted on Cloudinary.
 *
 * Used when no logo is configured, and in place of any configured logo that
 * resolves to localhost — a mail client fetching images from the developer's
 * machine gets a broken image for every recipient.
 */
export const FALLBACK_LOGO =
  "https://res.cloudinary.com/dpkek2omd/image/upload/v1778549068/branding/gsqzrnfmhg6ugkocjmho.png";

export function resolveLogo(logoUrl?: string): string {
  const candidate = logoUrl?.trim();
  if (!candidate) return FALLBACK_LOGO;
  if (/localhost|127\.0\.0\.1/.test(candidate)) return FALLBACK_LOGO;
  if (candidate.startsWith("/")) {
    const absolute = `${siteOrigin()}${candidate}`;
    return /localhost|127\.0\.0\.1/.test(absolute) ? FALLBACK_LOGO : absolute;
  }
  return candidate;
}
