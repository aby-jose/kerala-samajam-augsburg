import type { SiteConfig } from "./config-schema";

/**
 * Who the association is, in the words the public surfaces need.
 *
 * The facts — city, country, founding year, registered name — all come from
 * Settings. Only the connective English ("Kerala in", "since", "ESTABLISHED")
 * lives here, so changing where or when KSA was founded is a settings edit
 * rather than a hunt through the components that happen to say so.
 *
 * `defaultLegalEntity` seeds several fields as `{{PLACEHOLDER}}` for the board
 * to fill in, so every reader has to treat an unfilled field as absent — a
 * card reading "AUGSBURG, {{LAND}}" would be worse than one reading
 * "AUGSBURG".
 */
const isPlaceholder = (value: string | undefined | null): boolean =>
  !value || value.includes("{{");

/** Falls back to Augsburg — the association is named after it. */
export function orgCity(config: SiteConfig): string {
  return isPlaceholder(config.legal.city) ? "Augsburg" : config.legal.city;
}

/** The registered name, or the site name while the register entry is unfilled. */
export function orgLegalName(config: SiteConfig): string {
  return isPlaceholder(config.legal.entityName) ? config.siteName : config.legal.entityName;
}

/** Caption over the membership benefits image, e.g. "Kerala in Augsburg, since 2012." */
export function foundingCaption(config: SiteConfig): string {
  const city = orgCity(config);
  const year = config.foundedYear?.trim();
  return year ? `Kerala in ${city}, since ${year}.` : `Kerala in ${city}.`;
}

/**
 * The two stacked lines in the membership dossier's sidebar. Returned as parts
 * rather than one string because the card renders them on separate lines.
 */
export function establishedLine(config: SiteConfig): { year: string | null; place: string } {
  const year = config.foundedYear?.trim();
  const country = config.legal.country;
  const place = isPlaceholder(country) ? orgCity(config) : `${orgCity(config)}, ${country}`;

  return {
    year: year ? `ESTABLISHED ${year}` : null,
    place: place.toUpperCase(),
  };
}
