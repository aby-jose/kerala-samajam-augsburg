/**
 * Fired on `window` when the launch ceremony's overlay goes up or comes down,
 * with `detail.active`. Anything that would otherwise sit on top of the stage
 * — the cookie banner — listens for it. Its own module so the listener does
 * not import the ceremony.
 */
export const CEREMONY_EVENT = "ksa:ceremony";
