/**
 * The bill.
 *
 * A house hangs its company's name on the front cloth in a serif, and sets
 * everything operational — the clock, the state of the evening, the control —
 * in something plainer. The old lockup had that backwards: the name in the
 * heavy sans the site uses for section headings, with a serif italic caption
 * under it, which is a web page's hierarchy, not a stage's. So the two faces
 * swap roles here and keep them across the pre-show and the title card, and
 * both screens read from this file so they cannot drift apart mid-ceremony.
 *
 * The name is Newsreader at 500. A serif this size on a dark ground blooms
 * optically — light type on black gains weight — so extrabold clots and a
 * medium holds its counters open from the back of a hall.
 */

/**
 * Type here is #F6EEE0 — lit silk, not a lit screen. Pure white glares against
 * the cloth and reads as a browser dropped in front of the curtain. The value
 * is written into the class strings literally because Tailwind has to see it.
 */
const GOLD = "#C9A227";

/**
 * The association's name.
 *
 * Sized against `vmin` for the hall and capped against `vw` so a narrow
 * portrait screen cannot run it off the edge — on a phone the width is what
 * binds, on a projector the height is. On anything between, the cap lets the
 * name take two lines rather than shrink, which is the trade a bill wants.
 *
 * It ran a third larger for a while. On the hall screen that read as a
 * banner, not a bill: the name is meant to be read, not to fill the opening.
 */
export const BILL_NAME =
  "max-w-[84vw] text-balance font-serif text-[min(6.4vmin,6.6vw)] " +
  "font-medium leading-[1.06] tracking-[-0.005em] text-[#F6EEE0] " +
  "drop-shadow-[0_0.4vmin_1.8vmin_rgba(0,0,0,0.75)] mt-[3vmin]";

/** Whatever the evening is currently doing. Plain, warm, and not a whisper. */
export const BILL_STATUS =
  "font-sans text-[1.9vmin] font-medium leading-none tracking-[0.015em] " +
  "text-[#E3D5C0]/85";

/**
 * The braid again, at hairline weight.
 *
 * It separates the fixed half of the bill — logo and name — from the half that
 * changes as the evening runs, and it is the curtain's own gold rather than a
 * decorative rule, so the card reads as something hung on the cloth.
 *
 * It scales with the screen instead of sitting at one device pixel. A true
 * hairline vanished on a projector and left the status line floating with
 * nothing to hang from, which is worse than not drawing it at all.
 */
export function Braid() {
  return (
    <span
      aria-hidden
      className="mt-[2.8vmin] block h-[0.22vmin] min-h-px w-[9vmin] min-w-[3.5rem]"
      style={{
        background: `linear-gradient(90deg, transparent, ${GOLD} 18%, ${GOLD} 82%, transparent)`,
        opacity: 0.85,
      }}
    />
  );
}
