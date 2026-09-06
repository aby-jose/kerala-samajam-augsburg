"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GROW_MS, PARTING_MS, type CeremonyState } from "@/lib/ceremony-timing";
import { TROUGH, braid, foldStops, tone } from "./cloth";

/**
 * The draw: leans in, runs, settles. Not the expo-out the rest of the site
 * uses for entrances — that puts all its speed in the first fifth and coasts,
 * which is right for a card arriving and wrong for a curtain on a motor.
 */
const EASE = [0.42, 0.02, 0.22, 1] as const;

/**
 * The air in the room.
 *
 * Nothing on this page animated before, on the grounds that the stage has to
 * hold 60fps on whatever is driving the hall projector. That still holds for
 * the CLOTH — every filter here is rasterised once and never re-run. What
 * moves is a transform on a wrapper, which the compositor handles on its own
 * layer, so the wind costs no repaint however elaborate the velvet behind it.
 *
 * TWO layers per surface, not one. A single sine is a metronome: the hem
 * arrives at the same place at the same interval and the eye finds the period
 * within about two cycles, which is why one oscillation reads as "moving"
 * rather than as air. Nesting a long slow sway and a short shallow gust on
 * periods that share no common multiple means the hem traces a path that does
 * not repeat for minutes, and the gust carries a little sideways drift and a
 * breath of width so the folds compress and open instead of the whole panel
 * leaning as one rigid sheet.
 *
 * Hanging cloth pivots at the track, so every layer has its origin at the top.
 */
type Gust = {
  skewX?: readonly number[];
  x?: readonly number[];
  scaleX?: readonly number[];
  duration: number;
  delay: number;
};

const WIND = {
  left: {
    sway: { skewX: [0, 0.62, -0.3, 0.14, 0], duration: 13.1, delay: 0 },
    gust: {
      skewX: [0, -0.24, 0.31, -0.11, 0],
      x: [0, 2.4, -1.6, 0.7, 0],
      scaleX: [1, 1.0026, 0.9986, 1.0012, 1],
      duration: 5.3,
      delay: 0.4,
    },
  },
  right: {
    sway: { skewX: [0, -0.58, 0.34, -0.12, 0], duration: 14.9, delay: 1.7 },
    gust: {
      skewX: [0, 0.27, -0.29, 0.1, 0],
      x: [0, -2.1, 1.8, -0.6, 0],
      scaleX: [1, 0.9984, 1.0024, 0.999, 1],
      duration: 6.1,
      delay: 2.3,
    },
  },
  valance: {
    // Fixed to the pelmet board and gathered besides, so it stirs where the
    // legs swing — and its gust is slower, because there is far less of it
    // hanging free to be caught.
    sway: { skewX: [0, 0.2, -0.14, 0], duration: 17.3, delay: 0.8 },
    gust: { skewX: [0, -0.09, 0.11, 0], x: [0, 1.1, -0.8, 0], duration: 7.7, delay: 1.1 },
  },
} as const;

/** Motion props for one layer of wind, or none at all if motion is reduced. */
function breeze(g: Gust, reduced: boolean) {
  if (reduced) return {};
  return {
    animate: {
      ...(g.skewX ? { skewX: [...g.skewX] } : {}),
      ...(g.x ? { x: [...g.x] } : {}),
      ...(g.scaleX ? { scaleX: [...g.scaleX] } : {}),
    },
    transition: {
      duration: g.duration,
      delay: g.delay,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  };
}

/** The wrapper every wind layer uses: full bleed, pivoting at the track. */
const BREEZE_BOX = "relative h-full w-full will-change-transform";
const BREEZE_ORIGIN = { transformOrigin: "50% 0%" } as const;

/**
 * How much of each half survives as a leg once the curtain is drawn.
 *
 * A stage curtain does not leave. It is pulled to the walls and bunches there
 * for the rest of the evening, framing whatever is on the stage. Scaling each
 * half about its OUTER edge is exactly that draw: the leading edge travels
 * from centre to wall, and every fold behind it compresses into the stack.
 */
const LEG_SCALE = 0.15;

/**
 * Each half is wider than half the screen, so the two OVERLAP at the centre.
 *
 * Two panels butted edge to edge leave a hard vertical seam straight down the
 * middle of the projection — a join no real curtain has, because real panels
 * lap. 54% each gives an 8% lap: the right panel hangs in front of the left,
 * and the shadow it casts is what the eye reads as depth instead of a line.
 */
const HALF_W = 54;

/**
 * The valance box, in the units its geometry is drawn in.
 *
 * The swags fill the top two thirds; the rest is empty room for the shadow the
 * scallop throws onto the cloth below, which has to be part of the same
 * drawing so it is displaced along with the hem that casts it.
 */
const VB_H = 420;
const SWAG_BELLY = 316;
const HEADER_H = 54;
const JABOT_W = 170;
const JABOT_TOP = 96;
const JABOT_DROP = 400;

/**
 * Where the house light sits across the row, 0 at the left wall and 1 at
 * the right.
 *
 * Front of house, dead centre. It sat off to one side for a while, on the
 * argument that a symmetric valance is a pattern rather than a lit object —
 * but that lit one end of the room and left the other in the dark, and a
 * proscenium is a symmetric object that the audience sees head on. The row
 * still isn't five identical stamps: the swags dim toward both walls and each
 * one's highlight leans inboard toward the source.
 */
const LIGHT = 0.5;

/**
 * How open the cloth is at the light, and how far it falls away at the walls.
 *
 * The floor matters more than the ceiling: at a steeper falloff the far wall
 * went muddy and the tail there stopped reading as cloth at all, which trades
 * one flatness for another.
 */
function liftAt(centre: number): number {
  return 1 - Math.min(Math.abs(centre - LIGHT), 0.72) * 0.5;
}


function Stops({ stops }: { stops: ReturnType<typeof foldStops> }) {
  return (
    <>
      {stops.map((s, i) => (
        <stop key={i} offset={`${s.at}%`} stopColor={s.color} />
      ))}
    </>
  );
}

/**
 * One half of the traveller.
 *
 * The cloth is an SVG so it can carry two things CSS cannot: a low-frequency
 * displacement that lets the folds wander off the vertical the way hanging
 * fabric does, and a fine noise pass for the nap of the velvet. Both are
 * rasterised once; the container is the only thing that ever moves.
 */
function Half({
  side,
  open,
  gone,
  reduced,
}: {
  side: "left" | "right";
  open: boolean;
  /** Flown out entirely: the site is full screen and the cloth is gone. */
  gone: boolean;
  reduced: boolean;
}) {
  const isLeft = side === "left";
  const id = `curtain-${side}`;
  const wind = WIND[side];
  const stops = foldStops(isLeft ? 0 : 3);

  // Anchored at the outer edge, so the draw compresses the folds toward the wall.
  const anchor: CSSProperties = isLeft
    ? { left: 0, transformOrigin: "0% 50%" }
    : { right: 0, transformOrigin: "100% 50%" };

  return (
    <motion.div
      className="absolute inset-y-0 will-change-transform"
      style={{ width: `${HALF_W}%`, ...anchor }}
      // Explicitly closed, never `initial={false}`: the rehearsal jump keys
      // remount this straight into PARTING, and with no initial state it would
      // snap open with no motion — the one thing the jump keys exist to show.
      initial={{ scaleX: 1 }}
      animate={{ scaleX: gone ? 0 : open ? LEG_SCALE : 1 }}
      // Reduced motion shortens the draw; it never removes it. The curtain is
      // the content of this beat, not decoration.
      transition={{
        duration: reduced ? 0.5 : (gone ? GROW_MS : PARTING_MS) / 1000,
        ease: EASE,
      }}
    >
      <motion.div className={BREEZE_BOX} style={BREEZE_ORIGIN} {...breeze(wind.sway, reduced)}>
      <motion.div className={BREEZE_BOX} style={BREEZE_ORIGIN} {...breeze(wind.gust, reduced)}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-folds`} x1="0" x2="1" y1="0" y2="0">
            <Stops stops={stops} />
          </linearGradient>
          {/* Hanging: shadow under the valance, weight at the hem. */}
          <linearGradient id={`${id}-hang`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.66" />
            <stop offset="0.15" stopColor="#000" stopOpacity="0" />
            <stop offset="0.8" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.6" />
          </linearGradient>
          {/* The lap. The left panel lies UNDER the right, so it takes a wide,
              soft shadow across its leading edge; the right panel's leading
              edge is in the light and takes a thin highlight. Together they
              read as one panel in front of another instead of a seam. */}
          <linearGradient id={`${id}-lap`} x1="0" x2="1" y1="0" y2="0">
            {isLeft ? (
              <>
                <stop offset="0.72" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#000" stopOpacity="0.42" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#fff" stopOpacity="0.05" />
                <stop offset="0.05" stopColor="#fff" stopOpacity="0" />
              </>
            )}
          </linearGradient>
          {/* Folds wander: a very low-frequency warp pushes the vertical folds
              a little off true, more so lower down where the cloth is freer. */}
          <filter id={`${id}-drape`} x="-6%" y="-6%" width="112%" height="112%" colorInterpolationFilters="sRGB">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.0045 0.0018"
              numOctaves="2"
              seed={isLeft ? 3 : 11}
              result="warp"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="warp"
              scale="26"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          {/* The nap. */}
          <filter id={`${id}-nap`} colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed={isLeft ? 5 : 17} />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        {/* Oversized so the displaced edges never expose the stage behind. */}
        <rect x="-60" y="-60" width="1120" height="1120" fill={`url(#${id}-folds)`} filter={`url(#${id}-drape)`} />
        <rect x="0" y="0" width="1000" height="1000" filter={`url(#${id}-nap)`} opacity="0.1" style={{ mixBlendMode: "overlay" }} />
        <rect x="0" y="0" width="1000" height="1000" fill={`url(#${id}-hang)`} />
        <rect x="0" y="0" width="1000" height="1000" fill={`url(#${id}-lap)`} />
      </svg>
      </motion.div>
      </motion.div>

      {/* Bunched cloth is in its own shadow. Fades in as the leg gathers. */}
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 0.4 : 0 }}
        transition={{ duration: reduced ? 0.5 : PARTING_MS / 1000, ease: EASE }}
      />
    </motion.div>
  );
}

/**
 * The lower edge of one swag: a cubic that leaves each gather point steeply
 * and runs flat across the belly, which is how hung cloth actually sits.
 *
 * Controls at `depth / 0.75` put the belly of the curve exactly at `depth`,
 * so the same function draws the hem, every gather line inside the swag, and
 * the braid, and they can never drift apart.
 */
function arc(xa: number, xb: number, depth: number, inset = 0.16): string {
  const w = xb - xa;
  const c = depth / 0.75;
  return `M${xa} 0 C${xa + w * inset} ${c} ${xb - w * inset} ${c} ${xb} 0`;
}

/**
 * A deterministic 0–1 from an integer: the same "random" every render, so
 * the server and the client draw the same cloth and hydration has nothing to
 * argue about. It only has to look uncorrelated from one fold to the next.
 *
 * Built from integer multiply and shift ONLY — no `Math.sin`. The classic
 * `sin(x) * hugeConstant` trick is not actually deterministic across engines:
 * the spec allows `Math.sin` to differ in its last bit between two V8 builds,
 * and multiplying by 43758.5453 blows a last-bit difference up into a visibly
 * different decimal. That was landing server numbers and client numbers a
 * few ULPs apart, and React's hydration check compares the rendered strings
 * character for character, so a swag's fold count of jitter calls was enough
 * to fail on nearly every path in the valance. `Math.imul` and the bitwise
 * operators are exact per the ECMAScript spec — every engine agrees on them
 * — so this is bit-identical on the server and in the browser.
 */
function jitter(n: number): number {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  x = x ^ (x >>> 15);
  return (x >>> 0) / 4294967296;
}

/**
 * Bullion fringe.
 *
 * Drawn as a BAND filled with a thread pattern, not as one path per thread.
 * The per-thread version was honest about what fringe is and looked wrong
 * anyway: at any spacing loose enough to keep the path data sane, the threads
 * read as a row of ticks — a comb hung under the braid. Real fringe is mostly
 * thread and hardly any gap, and you get that density for three paths instead
 * of four hundred by letting a pattern tile it.
 *
 * The band is the shape the hem sweeps when you drag it straight down, so the
 * threads hang under gravity and the band's ends stay tucked at the gathers.
 */

/**
 * The band under a swag hem: the hem, down by `len`, and back along it — but
 * the cut edge is RAGGED. Every cord in a fringe is cut and hangs on its own,
 * so the bottom is a little uneven; a smooth cut edge was the single thing
 * that most made the fringe read as a printed stripe. The bottom is walked
 * back along the hem in short steps with each step's drop nudged by `jitter`.
 */
function fringeBand(xa: number, xb: number, depth: number, len: number, seed: number): string {
  const w = xb - xa;
  const c = depth / 0.75;
  const a = xa + w * 0.16;
  const b = xb - w * 0.16;
  let d = `M${xa} 0 C${a} ${c} ${b} ${c} ${xb} 0`;
  const n = Math.max(8, Math.round(w / 4.5));
  for (let k = n; k >= 0; k--) {
    const t = k / n;
    const u = 1 - t;
    const x = u * u * u * xa + 3 * u * u * t * a + 3 * u * t * t * b + t * t * t * xb;
    const y = 3 * c * t * u;
    const drop = len * (0.85 + jitter(seed + k) * 0.19);
    d += ` L${x.toFixed(1)} ${(y + drop).toFixed(1)}`;
  }
  return d + " Z";
}

/** A smooth strip between two drops under a swag hem, for shading the tips. */
function hemStrip(xa: number, xb: number, depth: number, l1: number, l2: number): string {
  const w = xb - xa;
  const c = depth / 0.75;
  const a = xa + w * 0.16;
  const b = xb - w * 0.16;
  return (
    `M${xa} ${l1} C${a} ${c + l1} ${b} ${c + l1} ${xb} ${l1}` +
    ` L${xb} ${l2} C${b} ${c + l2} ${a} ${c + l2} ${xa} ${l2} Z`
  );
}

/** The same under one run of a jabot hem, which is a quadratic. */
function quadBand(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  l1: number,
  l2: number
): string {
  return (
    `M${x0} ${y0 + l1} Q${cx} ${cy + l1} ${x1} ${y1 + l1}` +
    ` L${x1} ${y1 + l2} Q${cx} ${cy + l2} ${x0} ${y0 + l2} Z`
  );
}

type Pt = { x: number; y: number };

/** Points along a swag hem, evenly in x, for hanging things from. */
function alongArc(xa: number, xb: number, depth: number, step: number): Pt[] {
  const w = xb - xa;
  const c = depth / 0.75;
  const a = xa + w * 0.16;
  const b = xb - w * 0.16;
  const n = Math.max(2, Math.round(w / step));
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const u = 1 - t;
    pts.push({
      x: u * u * u * xa + 3 * u * u * t * a + 3 * u * t * t * b + t * t * t * xb,
      y: 3 * c * t * u,
    });
  }
  return pts;
}

/** The same, along the quadratic a jabot pleat is cut to. */
function alongQuad(p0: Pt, p1: Pt, p2: Pt, step: number): Pt[] {
  const n = Math.max(2, Math.round(Math.abs(p2.x - p0.x) / step));
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const u = 1 - t;
    pts.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return pts;
}

/**
 * The light on a cord.
 *
 * Bullion is twisted cord, and a twisted cord has light running along it in a
 * spiral — bright where a strand turns toward you, dark where it turns away.
 * Each thread is stroked with one of three gradients that repeat every five
 * units or so along a DIAGONAL, in user space rather than the thread's own
 * box (a line has no box), so a thread gets the same twist wherever on the
 * hem it hangs, and three phases keep the highlights from lining up across
 * neighbours into a mesh.
 */
function Twist({ id, lift }: { id: string; lift: number }) {
  const dark = braid("thread", lift * 0.6);
  const mid = braid("thread", lift * 0.92);
  const lit = braid("lit", lift * 0.8);
  return (
    <>
      {/* The run is about seven units long — four or five times a thread's
          width. At half that it stopped reading as a spiral and read as
          beads on a string, dark and light alternating faster than the eye
          could join them into one twisted cord. */}
      {[0, 2.4, 4.7].map((ph, k) => (
        <linearGradient
          key={k}
          id={`${id}-tw${k}`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={ph}
          x2="2.6"
          y2={ph + 6.6}
          spreadMethod="repeat"
        >
          <stop offset="0" stopColor={dark} />
          <stop offset="0.38" stopColor={lit} />
          <stop offset="0.62" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      ))}
    </>
  );
}

/** Five cords of unequal width and weight, cycled, so no comb ever resolves. */
const CORDS = [
  { w: 2.0, o: 1 },
  { w: 1.5, o: 0.74 },
  { w: 2.2, o: 0.94 },
  { w: 1.3, o: 0.58 },
  { w: 2.1, o: 0.86 },
] as const;

/** How close together the threads hang. */
const THREAD_GAP = 2.4;

/**
 * The threads themselves: one `<line>` each, hanging straight down from a
 * point on the hem, at a length that varies a little so the cut edge is
 * ragged.
 *
 * One element per thread is the expensive way to draw fringe, and the page
 * had it as a pattern-filled band for a while, which cost three paths a swag.
 * The band came back out for one reason: MOTION. The only transform a band
 * can take is a transform of the whole band, and a whole band cannot swing —
 * it slides along the hem, because its threads are not anchored anywhere. A
 * `<line>` has a root. Give it `transform-box: fill-box` and an origin at its
 * top, and a skew leans it about that root the way a thread on a hem leans,
 * tips out and roots still. That is the difference between fringe stirring
 * and a strip of pattern being dragged sideways.
 *
 * `flip` mirrors x for the right-hand tail. The tail's geometry is mirrored
 * with a transform elsewhere, but a mirrored group would mirror the LEAN too,
 * and two tails leaning toward each other in the same breath of air read as
 * wrong; the threads are laid out in mirrored positions instead, and lean the
 * same way as everything else.
 */
function Threads({
  id,
  pts,
  seed,
  animate,
  flip = false,
}: {
  id: string;
  pts: Pt[];
  seed: number;
  animate: boolean;
  flip?: boolean;
}) {
  return (
    <>
      {pts.map((p, k) => {
        const cord = CORDS[k % CORDS.length];
        const len = FRINGE * (0.85 + jitter(seed + k) * 0.19);
        const x = (flip ? 1000 - p.x : p.x).toFixed(1);
        return (
          <line
            key={k}
            x1={x}
            y1={p.y.toFixed(1)}
            x2={x}
            y2={(p.y + len).toFixed(1)}
            stroke={`url(#${id}-tw${k % 3})`}
            strokeWidth={cord.w}
            strokeOpacity={cord.o}
            className={animate ? `thr thr-${k % 3}` : undefined}
          />
        );
      })}
    </>
  );
}

/**
 * The lean, as CSS. Three phases on three periods that share no common
 * multiple, so neighbouring threads never move in step — a gust catches the
 * whole hem, but no two threads answer it identically. Amplitudes are in the
 * SVG's own units; the box is stretched two to three to one across a
 * projector, so a five-degree lean over a thirty-unit thread lands its tip
 * seven or eight pixels out. Applied only when motion is not reduced.
 *
 * This is the one animation on the page that repaints. The threads sit alone
 * on an isolated layer with nothing filtered in it, so the repaint is a few
 * hundred short anti-aliased lines and nothing else — a fraction of a frame,
 * and no filter anywhere is touched.
 */
const THREAD_CSS = `
.thr{transform-box:fill-box;transform-origin:50% 0;animation-timing-function:ease-in-out;animation-iteration-count:infinite;will-change:transform}
.thr-0{animation-name:thr-a;animation-duration:3.9s}
.thr-1{animation-name:thr-b;animation-duration:4.7s;animation-delay:-1.3s}
.thr-2{animation-name:thr-c;animation-duration:3.3s;animation-delay:-2.1s}
@keyframes thr-a{0%{transform:skewX(0)}28%{transform:skewX(5deg)}56%{transform:skewX(-3.4deg)}80%{transform:skewX(1.6deg)}100%{transform:skewX(0)}}
@keyframes thr-b{0%{transform:skewX(0)}32%{transform:skewX(-4.2deg)}58%{transform:skewX(4.6deg)}82%{transform:skewX(-1.2deg)}100%{transform:skewX(0)}}
@keyframes thr-c{0%{transform:skewX(0)}25%{transform:skewX(6deg)}52%{transform:skewX(-2.8deg)}78%{transform:skewX(2.2deg)}100%{transform:skewX(0)}}
`;

/**
 * How far the fringe hangs. Thirty units is around a tenth of the valance's
 * own drop, which is what a house this size is trimmed with. At half that it
 * read as piping rather than fringe.
 *
 * Its shading is in three layers around the threads: under them, the shadow
 * the band throws onto the cloth behind (what stops it floating); over them, a
 * soft strip darkening the lower drop so the cut ends fall into shadow, and
 * the braid's own shadow across the roots, which is what binds thread and
 * header into one piece of trim.
 */
const FRINGE = 30;

/**
 * Where the folds sit, as a fraction of the swag's own depth — before each one
 * is nudged off true by `jitter`. Eleven, so that at the gathers, where they
 * all converge, they pile into the crush a real pinch has.
 */
const FOLDS = [0.09, 0.16, 0.24, 0.31, 0.4, 0.48, 0.57, 0.66, 0.74, 0.82, 0.9];

/**
 * A row of swags.
 *
 * A swag is not a wave drawn along the bottom of a band — it is cloth pinched
 * at intervals along the pelmet board, and everything that makes it read as
 * cloth comes from those pinches: the gather lines all converge on them, the
 * light collects in the belly between them, and each swag laps the one beside
 * it so the row has depth instead of a repeat.
 *
 * `count` is a prop because the swags are drawn into a stretched box. Five
 * across a projector gives each one roughly a 2:1 belly, the proportion a real
 * house valance is cut to; five across a phone would give five tall slivers.
 */
/**
 * Where the swags sit and how each is lit. Shared by the cloth and by the
 * trim that hangs off it, which live on different layers and must agree
 * about every number here or the fringe would hang from the wrong hem.
 */
function swagRow(count: number) {
  const slot = 1000 / count;
  const lap = slot * 0.2;
  return Array.from({ length: count }, (_, i) => {
    const centre = (i + 0.5) / count;
    const lift = liftAt(centre);
    // The highlight leans toward the light rather than sitting at the belly of
    // every swag, so the row reads as one lit object instead of five stamps.
    const cx = Math.min(0.74, Math.max(0.26, 0.5 - (centre - LIGHT) * 0.62));
    return { xa: i * slot - lap, xb: (i + 1) * slot + lap, lift, cx };
  });
}

/**
 * Drawn from the walls inward, not left to right.
 *
 * Lapping every swag over the one before it runs the overlap one way across
 * the whole row, so the swag at the left wall tucked under its neighbour while
 * the one at the right wall sat on top of its own — the two ends of the same
 * valance layered opposite ways. Ordering by distance from centre puts BOTH
 * end swags underneath, which is how a real row is hung and what makes the
 * two corners read as a pair. The trim layers use the same order, so a swag in
 * front shadows the fringe of the one it laps.
 */
function inward(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i).sort(
    (a, b) => Math.abs(b - (count - 1) / 2) - Math.abs(a - (count - 1) / 2)
  );
}

function Swags({ id, count }: { id: string; count: number }) {
  const swags = swagRow(count);

  return (
    <>
      <defs>
        {swags.map(({ lift, cx }, i) => (
          <g key={i}>
            <radialGradient id={`${id}-c${i}`} cx={cx} cy="0.46" r="0.72">
              <stop offset="0" stopColor={tone("crest", lift * 1.08)} />
              <stop offset="0.5" stopColor={tone("shade", lift)} />
              <stop offset="1" stopColor={tone("trough", lift)} />
            </radialGradient>
            <radialGradient id={`${id}-sheen${i}`} cx={cx} cy="0.62" r="0.5">
              <stop offset="0" stopColor="#fff" stopOpacity={0.11 * lift} />
              <stop offset="0.6" stopColor="#fff" stopOpacity={0.03 * lift} />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            {/* The braid takes the swag's own light, and takes it along its
                length: bright where the cloth faces the house, tarnished where
                it turns into the gather. */}
            <linearGradient id={`${id}-b${i}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={braid("dark", lift)} />
              <stop offset={Math.max(0.1, cx - 0.32)} stopColor={braid("mid", lift)} />
              <stop offset={cx} stopColor={braid("lit", lift)} />
              <stop offset={Math.min(0.9, cx + 0.32)} stopColor={braid("mid", lift)} />
              <stop offset="1" stopColor={braid("dark", lift)} />
            </linearGradient>
          </g>
        ))}
        {/* The pinch. Cloth crushed onto the board goes almost black. */}
        <linearGradient id={`${id}-cinch`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={TROUGH} stopOpacity="0.9" />
          <stop offset="0.13" stopColor={TROUGH} stopOpacity="0" />
          <stop offset="0.87" stopColor={TROUGH} stopOpacity="0" />
          <stop offset="1" stopColor={TROUGH} stopOpacity="0.9" />
        </linearGradient>
        {/* The board's own shadow, sitting on the top of every swag. */}
        <linearGradient id={`${id}-board`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.62" />
          <stop offset="0.2" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Over the threads, under every body: the shadow across the lower
          drop and the braid's shadow across the roots. The threads are on the
          layer beneath this one, and this is the nearest layer above them, so
          this is where anything that darkens the fringe has to live. Drawn
          before any body, so a swag in front still covers the strips of the
          one it laps. */}
      {swags.map(({ xa, xb }, i) => (
        <g key={`strip-${i}`}>
          <path
            d={hemStrip(xa, xb, SWAG_BELLY + 3, FRINGE * 0.5, FRINGE * 0.92)}
            fill="#000"
            opacity="0.24"
            filter="url(#valance-fold)"
          />
          <path
            d={arc(xa, xb, SWAG_BELLY + 7)}
            fill="none"
            stroke="#000"
            strokeOpacity="0.5"
            strokeWidth="9"
            filter="url(#valance-fold)"
          />
        </g>
      ))}

      {inward(count).map((i) => {
          const { xa, xb, lift } = swags[i];
          const seed = i * 97;
          return (
            <g key={i}>
              <path d={`${arc(xa, xb, SWAG_BELLY)} Z`} fill={`url(#${id}-c${i})`} />

              {/* The folds, as soft volume rather than drawn lines.

                  A fold is a ridge that catches the light with a valley in
                  its shadow, and both are broad and soft — the old treatment
                  stroked each one as a hairline and the swag read as a
                  contour map. Here every fold is a wide dark stroke for the
                  valley with a narrower pale one riding just above it for the
                  ridge, the pair blurred together into one rounded form.

                  Nothing about them is regular: depth, curve, width and
                  weight all take a little jitter, so no two folds are the same
                  arc scaled, and where they converge at the gathers they pile
                  up into the dark crush a real pinch has. */}
              <g filter="url(#valance-fold)">
                {FOLDS.map((k, f) => {
                  const n = seed + f;
                  const depth = SWAG_BELLY * k * (1 + (jitter(n) - 0.5) * 0.05);
                  const inset = 0.16 + (jitter(n + 41) - 0.5) * 0.07;
                  return (
                    <g key={f}>
                      <path
                        d={arc(xa, xb, depth - 3.2, inset)}
                        fill="none"
                        stroke={tone("crest", lift * 1.25)}
                        strokeOpacity={0.16 + jitter(n + 7) * 0.12}
                        strokeWidth={2.6 + jitter(n + 11) * 2.4}
                      />
                      <path
                        d={arc(xa, xb, depth, inset)}
                        fill="none"
                        stroke="#000"
                        strokeOpacity={0.3 + jitter(n + 19) * 0.22}
                        strokeWidth={5 + jitter(n + 23) * 5}
                      />
                    </g>
                  );
                })}
              </g>

              {/* The sheen: velvet's nap catches one broad soft light across
                  the belly of the swag. It is what separates velvet from felt. */}
              <path d={`${arc(xa, xb, SWAG_BELLY)} Z`} fill={`url(#${id}-sheen${i})`} />

              <path d={`${arc(xa, xb, SWAG_BELLY)} Z`} fill={`url(#${id}-cinch)`} />
              <path d={`${arc(xa, xb, SWAG_BELLY)} Z`} fill={`url(#${id}-board)`} />

              {/* The braid: a cord, with a lit crown and a dark underside, so
                  it has a round to it instead of lying flat on the hem. The
                  fringe it binds is on the layer BENEATH this one (see
                  `SwagThreads`), and the seat stroke here is what covers the
                  fringe's roots, so the two still read as one piece of trim. */}
              <path d={arc(xa, xb, SWAG_BELLY + 3)} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="7" />
              <path d={arc(xa, xb, SWAG_BELLY)} fill="none" stroke={`url(#${id}-b${i})`} strokeWidth="4.4" />
              <path
                d={arc(xa, xb, SWAG_BELLY - 1.2)}
                fill="none"
                stroke={braid("lit", lift)}
                strokeOpacity="0.32"
                strokeWidth="1.4"
              />
              <path
                d={arc(xa, xb, SWAG_BELLY + 1.6)}
                fill="none"
                stroke={braid("dark", lift * 0.7)}
                strokeOpacity="0.55"
                strokeWidth="1.1"
              />
            </g>
          );
        })}
    </>
  );
}

/**
 * What lies UNDER the swags' threads: each swag's cast shadow, and the shadow
 * its fringe throws. On the lowest layer of the valance, below the threads
 * and the cloth, so it lands on the legs and on the fringe of the swag behind
 * and never on this swag's own threads.
 *
 * The cast shadow used to be on the cloth with the body that casts it. It
 * moved down here when the threads moved out, because from the cloth it fell
 * across the top of the fringe — the one thing a hem's own shadow cannot do,
 * since the fringe hangs in front of it. What it no longer reaches is the
 * lapped swag's BODY, which is above; the cinch gradient darkens those ends
 * regardless.
 */
function TrimShade({ count }: { count: number }) {
  const swags = swagRow(count);
  return (
    <>
      {inward(count).map((i) => {
        const { xa, xb } = swags[i];
        return (
          <g key={i}>
            <path
              d={arc(xa, xb, SWAG_BELLY + 18)}
              fill="none"
              stroke="#000"
              strokeOpacity="0.55"
              strokeWidth="28"
              filter="url(#valance-soft)"
            />
            <path
              d={fringeBand(xa, xb, SWAG_BELLY + 3, FRINGE, i * 97)}
              fill="#000"
              opacity="0.36"
              transform="translate(3 5)"
              filter="url(#valance-fold)"
            />
          </g>
        );
      })}
    </>
  );
}

/**
 * The swags' threads, on their own layer BENEATH the cloth.
 *
 * Beneath, because everything that should hide fringe — the braid's seat over
 * the roots, a swag in front lapping the one behind, a tail over a swag's
 * end, the heading over the gathers — is cloth, and cloth is painted above
 * this, so the layering is right with no masks at all.
 *
 * No drape filter, on purpose twice over. The threads are the one thing on
 * the valance that repaints, and a filter here would be re-run with them;
 * and they do not need it — the cloth above is displaced at most three and a
 * half units, the roots sit under a seven-unit seat that covers that whole
 * range, and sideways a thread only slides along a hem that is horizontal
 * wherever it shows.
 */
function SwagThreads({ id, count, animate }: { id: string; count: number; animate: boolean }) {
  const swags = swagRow(count);
  return (
    <>
      <defs>
        {swags.map(({ lift }, i) => (
          <Twist key={i} id={`${id}-${i}`} lift={lift} />
        ))}
      </defs>
      {inward(count).map((i) => {
        const { xa, xb } = swags[i];
        return (
          <Threads
            key={i}
            id={`${id}-${i}`}
            pts={alongArc(xa, xb, SWAG_BELLY + 3, THREAD_GAP)}
            seed={i * 97}
            animate={animate}
          />
        );
      })}
    </>
  );
}

/**
 * A jabot — the pleated tail that hangs at each end of the valance.
 *
 * A row of swags that stops dead at the screen edge reads as a graphic; a tail
 * falling past the last swag and down over the leg is what joins the top of
 * the frame to the sides and makes the whole thing one hung object.
 *
 * Its hem is a STAIR: each pleat drops straight down at its leading edge
 * before the cloth runs out to the next one, and the vertical drops are what
 * say "these pleats stand in front of each other" rather than "this edge
 * waves". The first pleat has no drop — it is against the board with nothing
 * to stand in front of, and giving it one left a short vertical of braid at
 * the top of the tail that read as a detached gold tag.
 *
 * It was built for a while as nine separate overlapping panels instead, on the
 * theory that drawing the layers is the only honest way to show them. It was
 * not better: the extra pleats turned the corner into a ladder of little
 * fringed rungs and read busier at hall distance than the plain stair does.
 */
function jabotCut() {
  const J = JABOT_W;
  const pleats = 5;
  const step = (JABOT_DROP - JABOT_TOP) / pleats;

  const edges: Pt[] = [];
  const bands: string[] = [];
  const roots: Pt[] = [];
  let hem = `M${J} ${JABOT_TOP}`;
  for (let i = 0; i < pleats; i++) {
    const xa = J * (1 - i / pleats);
    const xb = J * (1 - (i + 1) / pleats);
    const ya = JABOT_TOP + i * step;
    const yb = JABOT_TOP + (i + 1) * step;
    const top = i > 0 ? ya + step * 0.3 : ya;
    if (i > 0) hem += ` L${xa} ${top}`;
    const cx = (xa + xb) / 2;
    const cy = yb + 3;
    hem += ` Q${cx} ${cy} ${xb} ${yb}`;
    // A band per run of hem, and none off the vertical drops — those are a
    // pleat's leading edge, not a hem, and nothing is bound there.
    bands.push(`${xa} ${top + 3} ${cx} ${cy + 3} ${xb} ${yb + 3}`);
    roots.push(
      ...alongQuad({ x: xa, y: top + 3 }, { x: cx, y: cy + 3 }, { x: xb, y: yb + 3 }, THREAD_GAP)
    );
    edges.push({ x: xb, y: yb });
  }
  const band = (l1: number, l2: number) =>
    bands
      .map((b) => {
        const [x0, y0, cx, cy, x1, y1] = b.split(" ").map(Number);
        return quadBand(x0, y0, cx, cy, x1, y1, l1, l2);
      })
      .join(" ");
  const body = `${hem} L0 0 L${J} 0 Z`;
  return { hem, body, edges, band, roots };
}

function Jabot({ id }: { id: string }) {
  const { hem, body, edges, band } = jabotCut();

  return (
    <g>
      {/* Two things separate the tail from the swag behind it and nothing else
          needs to: a shadow thrown inward off its edge, and its own cloth
          being a shade more open, since it hangs proud of everything. */}
      <path d={body} fill="#000" opacity="0.5" transform="translate(24 16)" filter="url(#valance-soft)" />
      <path d={body} fill={`url(#${id}-cloth)`} />

      {/* The pleat edges, as creases only. The swags get a lit ridge beside
          each crease and want it, because their gathers run across the stretch
          and stay hairlines; these run WITH it, so a white ridge here came out
          eight pixels wide on a projector and read as a scratch on the print. */}
      <g filter="url(#valance-fold)">
        {edges.map(({ x, y }, i) => (
          <g key={i}>
            <path d={`M${x + 3} 0 L${x + 3} ${y}`} stroke="#fff" strokeOpacity="0.07" strokeWidth="3" fill="none" />
            <path d={`M${x} 0 L${x} ${y}`} stroke="#000" strokeOpacity="0.5" strokeWidth="5" fill="none" />
          </g>
        ))}
      </g>
      {edges.map(({ x, y }, i) => (
        <path key={i} d={`M${x} 0 L${x} ${y}`} stroke="#000" strokeOpacity="0.3" strokeWidth="1.4" fill="none" />
      ))}

      <path d={body} fill="url(#valance-jshade)" />

      {/* What the fringe throws onto the cloth behind it. The threads are on
          the layer ABOVE this one (`JabotThreads`) — nothing laps a tail, so
          they can sit on top of everything — and their shadow goes here on
          the cloth, under them, where a shadow belongs. */}
      <path d={band(0, FRINGE)} fill="#000" opacity="0.36" transform="translate(3 5)" filter="url(#valance-fold)" />

      {/* The braid. Its seat still shows through under the threads' roots. */}
      <path d={hem} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="7" transform="translate(0 3)" />
      <path d={hem} fill="none" stroke={`url(#${id}-trim)`} strokeWidth="4" />
      <path d={hem} fill="none" stroke={braid("lit", 1)} strokeOpacity="0.3" strokeWidth="1.3" transform="translate(0 -1.2)" />
    </g>
  );
}

/**
 * Both tails' threads, on their own layer ABOVE the cloth.
 *
 * Above, because below a tail's hem is the body of the swag it stands in
 * front of, which would hide any thread painted beneath the cloth; and
 * nothing laps a tail, so nothing needs to hide these.
 */
function JabotThreads({ animate }: { animate: boolean }) {
  const { roots } = jabotCut();
  return (
    <>
      <defs>
        <Twist id="tail-l" lift={liftAt(0.06)} />
        <Twist id="tail-r" lift={liftAt(0.94)} />
      </defs>
      <Threads id="tail-l" pts={roots} seed={311} animate={animate} />
      <Threads id="tail-r" pts={roots} seed={523} animate={animate} flip />
    </>
  );
}

/** Over the tails' threads: the strip across the lower drop, the braid's shadow across the roots. */
function JabotOver() {
  const { hem, band } = jabotCut();
  return (
    <>
      {[false, true].map((flip) => (
        <g key={String(flip)} transform={flip ? "translate(1000 0) scale(-1 1)" : undefined}>
          <path d={band(FRINGE * 0.5, FRINGE * 0.92)} fill="#000" opacity="0.24" filter="url(#valance-fold)" />
          <path d={hem} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="9" transform="translate(0 7)" filter="url(#valance-fold)" />
        </g>
      ))}
    </>
  );
}

/**
 * The heading — the pleated tape the whole valance hangs from.
 *
 * Without it the swags are pinched at nothing: the gather points sit on the
 * top edge of the frame and the row looks sliced off rather than hung. It is
 * cut deep enough to read as a board with cloth gathered onto it rather than
 * as a rule drawn across the top of the screen. The
 * heading covers those pinches the way real tape does, gives the valance a
 * hard top, and is the one place the cloth's own vertical folds appear up
 * here, which ties the top of the frame to the legs at the sides.
 */
function Heading() {
  return (
    <>
      <g filter="url(#valance-fold)">
        <rect x="-10" y="-10" width="1020" height={HEADER_H + 10} fill="url(#valance-head)" />
      </g>
      <rect x="0" y="0" width="1000" height={HEADER_H} fill="url(#valance-headshade)" />
      <rect x="0" y={HEADER_H} width="1000" height="46" fill="url(#valance-headcast)" />
    </>
  );
}

/**
 * The valance — the pelmet across the top of the proscenium.
 *
 * Fixed, because in a real house it is fixed: only the traveller runs. It
 * stays for the whole evening and, with the two legs, is what frames the
 * showcase as a stage rather than a web page.
 *
 * The cloth is one displaced group so the swags, the tails, the heading and
 * the braid on every hem all warp together; a braid that stayed true while
 * the cloth wandered would read as a line printed onto a photograph.
 *
 * The FRINGE is not in that group. Its threads are on layers of their own —
 * one under the cloth for the swags, one over it for the tails — each thread
 * a line that leans about its own root (see `Threads`). Loose thread is the
 * first thing in a room to catch any air, and a fringe that only moved as
 * much as the board it hangs from read as painted on. The threads are the
 * one thing on the page that repaints, so they sit alone on isolated layers
 * with nothing filtered in them; everything that shades them is on static
 * layers either side. Animating them inside the cloth's group would re-run
 * every filter on the valance each frame, which is the one thing this page
 * must never do.
 *
 * The cloth reaches about 19vh down a phone and 26vh down a projector — three
 * quarters of the box, the rest being room for the shadow. Anything that has
 * to stand clear of it is padded to those numbers in `ceremony-overlay`.
 *
 * It is deliberately deep. At a shallower cut the valance framed the top of
 * the screen and then left a dead field of cloth between its hem and the name,
 * which read as a gap rather than as a stage; the swags now come down far
 * enough to meet the bill and close the frame around it.
 */
function Valance({ reduced, gone }: { reduced: boolean; gone: boolean }) {
  return (
    // Flown out when the site goes full screen: the whole valance rises clear
    // of the frame on its batten, breeze and all, in step with the legs.
    <motion.div
      className="absolute inset-x-0 top-0 h-[25vh] sm:h-[34vh]"
      initial={false}
      animate={{ y: gone ? "-125%" : "0%" }}
      transition={{ duration: reduced ? 0.5 : GROW_MS / 1000, ease: EASE }}
    >
    <motion.div
      className="absolute inset-0 will-change-transform"
      style={BREEZE_ORIGIN}
      {...breeze(WIND.valance.sway, reduced)}
    >
    <motion.div className={BREEZE_BOX} style={BREEZE_ORIGIN} {...breeze(WIND.valance.gust, reduced)}>
    {!reduced && <style>{THREAD_CSS}</style>}

    {/* Lowest: what lies under the swags' threads. */}
    <Layer>
      <g className="sm:hidden">
        <TrimShade count={2} />
      </g>
      <g className="hidden sm:inline">
        <TrimShade count={5} />
      </g>
    </Layer>

    {/* The swags' threads, isolated so their repaint touches nothing else. */}
    <Layer isolate>
      <g className="sm:hidden">
        <SwagThreads id="thr-n" count={2} animate={!reduced} />
      </g>
      <g className="hidden sm:inline">
        <SwagThreads id="thr-w" count={5} animate={!reduced} />
      </g>
    </Layer>

    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 1000 ${VB_H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {/* Blur is deliberately uneven: the box is stretched roughly three to
            one on a projector, so an even radius would smear sideways. */}
        {/* The softening every fold goes through. More blur across the
            stretch than along it, because the box is wider than it is tall by
            two or three to one on a projector and an even radius would smear. */}
        <filter id="valance-fold" x="-6%" y="-10%" width="112%" height="125%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.1 2.3" />
        </filter>
        {/* Every filter here is sRGB.

            SVG filter primitives default to linearRGB, where mid tones sit
            far brighter than the same numbers do on screen. Blending the nap
            onto the braid and the fringe in that space threw a pale wash
            around every gold edge on the valance — the whitish haze that kept
            appearing near the threads. It is a one-word fix and it also makes
            the blurs behave like the shadows they are meant to be. */}
        <filter
          id="valance-soft"
          x="-14%"
          y="-14%"
          width="128%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="4 10" />
        </filter>
        {/* Drape and nap in ONE filter, so the nap is clipped to the cloth's
            own alpha before it is blended.

            The nap used to be a separate full-box rect in overlay mode. Overlay
            only changes how a colour combines with its backdrop — it does not
            stop the source painting — so across every part of the box where
            the valance is transparent, that rect laid a faint grey veil over
            the curtain legs behind it and then stopped dead at the bottom edge
            of the SVG. What the hall saw was a pale horizontal line ruled
            across the full width of the stage at exactly 34vh. */}
        <filter
          id="valance-drape"
          x="-8%"
          y="-8%"
          width="116%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.012" numOctaves="2" seed="23" result="warp" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="warp"
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
            result="cloth"
          />
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="29" result="grain" />
          {/* To luminance, and force alpha opaque so the clip below decides it. */}
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1"
            result="grey"
          />
          <feComposite in="grey" in2="cloth" operator="in" result="clipped" />
          <feComponentTransfer in="clipped" result="faint">
            <feFuncA type="linear" slope="0.09" />
          </feComponentTransfer>
          <feBlend in="faint" in2="cloth" mode="overlay" />
        </filter>
        {/* The tail's cloth, one set per side. Broad folds, and a touch above
            its own swags' light because it hangs proud of them. */}
        {(["left", "right"] as const).map((side, i) => (
          <linearGradient key={side} id={`valance-${side}-cloth`} x1="0" x2="1" y1="0" y2="0">
            <Stops stops={foldStops(i === 0 ? 9 : 4, 4, liftAt(i === 0 ? 0.06 : 0.94) + 0.1)} />
          </linearGradient>
        ))}
        {/* Trim and fringe, per side and per tone. The hem runs from its inner
            edge outward, so in a pleat's own box the braid's bright end is at
            0 and it tarnishes toward the wall. */}
        {(["left", "right"] as const).map((side) => {
          const lf = liftAt(side === "left" ? 0.06 : 0.94);
          return (
            <g key={side}>
              <linearGradient id={`valance-${side}-trim`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={braid("lit", lf)} />
                <stop offset="0.45" stopColor={braid("mid", lf)} />
                <stop offset="1" stopColor={braid("dark", lf)} />
              </linearGradient>
            </g>
          );
        })}
        {/* Narrow, low-contrast folds running the full height of the strip.
            Wide ones read as a row of beads threaded along the top of the
            screen, and doubling their number only made the beads smaller —
            it was the vertical shading below that was capping each fold top
            and bottom into a lozenge. Gathered tape is unbroken vertical
            striation, so the shading now darkens the board line only. */}
        <linearGradient id="valance-head" x1="0" x2="1" y1="0" y2="0">
          <Stops stops={foldStops(13, 58, 0.85)} />
        </linearGradient>
        <linearGradient id="valance-headshade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.62" />
          <stop offset="0.4" stopColor="#000" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id="valance-headcast" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="valance-jshade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.5" />
          <stop offset="0.22" stopColor="#000" stopOpacity="0" />
          <stop offset="0.72" stopColor="#000" stopOpacity="0.08" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </linearGradient>
      </defs>

      <g filter="url(#valance-drape)">
        {/* Two cuts of the same valance. They swap on width alone: the count
            is a proportion problem, not a device one. */}
        <g className="sm:hidden">
          <Swags id="valance-n" count={2} />
        </g>
        <g className="hidden sm:inline">
          <Swags id="valance-w" count={5} />
        </g>

        <Jabot id="valance-left" />
        <g transform="translate(1000 0) scale(-1 1)">
          <Jabot id="valance-right" />
        </g>

        {/* Last, over the pinches and the tops of both tails. */}
        <Heading />
      </g>
    </svg>

    {/* Over the cloth: the tails' threads, then what shades them. */}
    <Layer isolate>
      <JabotThreads animate={!reduced} />
    </Layer>
    <Layer>
      <JabotOver />
    </Layer>
    </motion.div>
    </motion.div>
    </motion.div>
  );
}

/**
 * One layer of the valance: a full-bleed SVG in the valance's box. `isolate`
 * gives it a compositor layer of its own, for the two that repaint — the
 * threads — so a frame of theirs never touches the filtered cloth beside them.
 * Layers reference the cloth's filters by id; it is all one document.
 */
function Layer({ isolate = false, children }: { isolate?: boolean; children: ReactNode }) {
  return (
    <div className={isolate ? "absolute inset-0 will-change-transform" : "absolute inset-0"}>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 1000 ${VB_H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {children}
      </svg>
    </div>
  );
}

/**
 * The house curtain.
 *
 * Sits at `z-[15]`: above the stage atmosphere (`z-10`) and the STAGE layer
 * (`z-[12]`, where the browser, title card and showcase live), and below the
 * FRONT layer (`z-20`, the pre-show and the count-in). So before the reveal
 * the logo, clock and Unveil button read in front of the closed cloth, and
 * when the cloth draws it uncovers what was already standing behind it.
 *
 * Always mounted. The legs and the valance stay for the whole evening.
 */
export function Curtain({ state }: { state: CeremonyState }) {
  const reduced = Boolean(useReducedMotion());
  const open = state !== "PRESHOW" && state !== "COUNT_IN";
  // Full screen: the legs run the rest of the way into the wings and the
  // valance flies. The curtain stays mounted, so the operator's jump back to
  // any earlier beat brings it in again rather than remounting it.
  const gone = state === "GROW" || state === "AFTERGLOW" || state === "OFF";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
      <Half side="left" open={open} gone={gone} reduced={reduced} />
      <Half side="right" open={open} gone={gone} reduced={reduced} />
      <Valance reduced={reduced} gone={gone} />
    </div>
  );
}
