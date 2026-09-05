/**
 * Where the proscenium opening is, as percentages of the stage.
 *
 * One source of truth, because three separate things have to agree on it to
 * the pixel: the pavilion frame drawn around it, the curtain that fills it,
 * and the content the curtain uncovers. When these drifted apart the cloth
 * showed past the pillars, which is the sort of thing nobody notices until it
 * is on a wall four metres wide.
 *
 * Percentages rather than vh/vw so the frame holds its proportions on a 16:9
 * projector and a 4:3 one alike.
 */
export const OPENING = {
  /** Roof and carved beam sit above this. */
  top: 25,
  /** Stage floor below. */
  bottom: 12,
  /** Carved pillars either side. */
  side: 10.5,
} as const;

/**
 * How far the garlands hang down INTO the opening, as a percentage of the
 * stage.
 *
 * Content has to clear this. The showcase's address line was drawn straight
 * behind a swag of marigolds the first time, which is the sort of thing that
 * only shows up once the whole frame is on screen together.
 */
export const GARLAND_DROP = 9;

/** `inset` for anything that should exactly fill the opening — the curtain. */
export const openingInset = {
  top: `${OPENING.top}%`,
  bottom: `${OPENING.bottom}%`,
  left: `${OPENING.side}%`,
  right: `${OPENING.side}%`,
} as const;

/** `inset` for CONTENT, which additionally has to clear the hanging garlands. */
export const contentInset = {
  top: `${OPENING.top + GARLAND_DROP}%`,
  bottom: `${OPENING.bottom + 1.5}%`,
  left: `${OPENING.side + 1.5}%`,
  right: `${OPENING.side + 1.5}%`,
} as const;

/* ---------------------------------------------------------------------------
   The pavilion's materials. Kept here so the frame, the curtain hem and the
   lamps all pull from one set rather than each inventing its own brown.
   --------------------------------------------------------------------------- */

export const WOOD = {
  deep: "#2A1810",
  dark: "#4A2C18",
  mid: "#6B4423",
  light: "#8B5A2B",
  lit: "#A9713A",
} as const;

export const TILE = {
  dark: "#8C3A22",
  mid: "#B4512F",
  light: "#D2703F",
  lit: "#E28B55",
} as const;

export const GOLD = {
  dark: "#8A6A1E",
  mid: "#C9A227",
  bright: "#F0CE72",
  pale: "#FBEFC0",
} as const;

export const MARIGOLD = {
  orange: "#E8781F",
  yellow: "#F2A81D",
  cream: "#F7F0DC",
  leaf: "#3F7A34",
} as const;
