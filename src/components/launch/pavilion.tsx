"use client";

import { motion, useReducedMotion } from "framer-motion";
import { GARLAND_DROP, GOLD, MARIGOLD, OPENING, TILE, WOOD } from "./stage-geometry";

/**
 * The pavilion: a Kerala nalukettu proscenium drawn in vector.
 *
 * Every part of it is SVG rather than artwork, for three reasons that all
 * matter here. It holds its proportions on a 16:9 projector and a 4:3 one
 * alike; it stays sharp at whatever resolution the hall's projector turns out
 * to run at; and it adds nothing to deploy, which matters in this repo more
 * than most — the hero video still has no working path to production, and a
 * photographic backdrop would inherit that same unsolved problem.
 *
 * It is drawn as bands positioned in percentages rather than one large
 * picture, so the opening it frames is plain CSS geometry the curtain and the
 * content can share exactly. See `stage-geometry.ts`.
 *
 * Nothing here animates except the lamp flames. The frame is scenery: painted
 * once, then it holds still while the ceremony happens inside it.
 */

/* -------------------------------------------------------------------------- */

function Rosette({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const petals = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={r} fill={WOOD.deep} opacity="0.6" />
      {petals.map((a) => (
        <ellipse
          key={a}
          rx={r * 0.15}
          ry={r * 0.42}
          cy={-r * 0.52}
          fill={WOOD.lit}
          opacity="0.85"
          transform={`rotate(${a})`}
        />
      ))}
      <circle r={r * 0.26} fill={GOLD.dark} />
      <circle r={r * 0.15} fill={GOLD.bright} />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/*  Roof, gable, carved beam                                                   */
/* -------------------------------------------------------------------------- */

function RoofAndBeam({ siteName }: { siteName: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: `${OPENING.top}%` }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 250" preserveAspectRatio="none" aria-hidden>
        <defs>
          {/* One clay tile, seen end-on: a barrel with a lit crest, a groove
              down its left side, and the head of the course below lapping
              over it. Vertical barrels are what stops a tiled roof reading as
              brickwork. */}
          <linearGradient id="tileBarrel" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={TILE.dark} />
            <stop offset="0.3" stopColor={TILE.lit} />
            <stop offset="0.52" stopColor={TILE.light} />
            <stop offset="0.8" stopColor={TILE.mid} />
            <stop offset="1" stopColor="#6E2A14" />
          </linearGradient>
          <pattern id="tiles" width="40" height="54" patternUnits="userSpaceOnUse">
            <rect width="40" height="54" fill="#7A3018" />
            <path d="M3 54 V14 Q20 4 37 14 V54 Z" fill="url(#tileBarrel)" />
            <path d="M0 54 V14 Q8 7 12 13 V54 Z" fill="#000" opacity="0.34" />
            <path d="M17 54 V13 Q20 10.5 23 13 V54 Z" fill="#FFF" opacity="0.1" />
            <path d="M0 12 Q20 2 40 12 L40 19 Q20 9 0 19 Z" fill="#000" opacity="0.3" />
          </pattern>

          <linearGradient id="beamWood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={WOOD.light} />
            <stop offset="0.26" stopColor={WOOD.lit} />
            <stop offset="0.62" stopColor={WOOD.mid} />
            <stop offset="1" stopColor={WOOD.deep} />
          </linearGradient>
          <linearGradient id="bargeWood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={WOOD.lit} />
            <stop offset="0.5" stopColor={WOOD.mid} />
            <stop offset="1" stopColor={WOOD.dark} />
          </linearGradient>
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7 0.03" numOctaves="3" seed="9" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        {/* Roof planes flanking the gable. */}
        <polygon points="0,178 1600,178 1568,96 32,96" fill="url(#tiles)" />
        <polygon points="32,96 1568,96 1564,84 36,84" fill="#5E2210" />

        {/* The gable over the centre. Deeper than the flanking roof and
            steeper than it looks it should be — a shallow pediment reads as a
            chevron rather than as a roof. */}
        <polygon points="800,4 1136,176 464,176" fill="url(#tiles)" />
        {/* Barge boards down both slopes, with a gold fillet inside them. */}
        <polygon points="800,-8 1162,178 1130,198 800,28 470,198 438,178" fill="url(#bargeWood)" />
        <polygon points="800,16 1120,176 1106,185 800,38 494,185 480,176" fill={GOLD.dark} opacity="0.55" />
        {/* Tie beam across the foot of the gable. */}
        <rect x="452" y="166" width="696" height="14" fill={WOOD.dark} />
        <rect x="452" y="166" width="696" height="3" fill={GOLD.dark} opacity="0.6" />
        {/* Finial. */}
        <path d="M800 -14 L813 8 L800 24 L787 8 Z" fill={GOLD.bright} />
        <circle cx="800" cy="28" r="7" fill={GOLD.mid} />

        {/* Eave fascia: the shadow line that makes the roof sit ON something. */}
        <rect y="172" width="1600" height="20" fill={WOOD.dark} />
        <rect y="172" width="1600" height="4" fill={WOOD.lit} opacity="0.55" />

        {/* The carved beam. */}
        <rect y="192" width="1600" height="52" fill="url(#beamWood)" />
        <rect y="192" width="1600" height="52" filter="url(#grain)" opacity="0.14" style={{ mixBlendMode: "overlay" }} />
        <rect y="192" width="1600" height="3" fill={GOLD.mid} opacity="0.8" />
        <rect y="241" width="1600" height="3" fill={GOLD.dark} opacity="0.9" />
        <Rosette cx={104} cy={218} r={19} />
        <Rosette cx={1496} cy={218} r={19} />

        {/* The beam throws a shadow onto the cloth below. */}
        <rect y="244" width="1600" height="6" fill="#000" opacity="0.6" />
      </svg>

      {/* The name is HTML, not SVG text: this band is stretched to the
          projector's width, and stretched lettering is the one thing on a
          stage that instantly reads as wrong. */}
      <div className="absolute inset-x-0 flex items-center justify-center" style={{ top: "77%", height: "21%" }}>
        <span
          className="whitespace-nowrap font-serif font-semibold uppercase"
          style={{
            fontSize: "clamp(0.7rem, 2.4vw, 3rem)",
            letterSpacing: "0.07em",
            color: GOLD.bright,
            textShadow: `0 0.1em 0 ${WOOD.deep}, 0 0.02em 0.05em rgba(0,0,0,0.85)`,
          }}
        >
          {siteName}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pillars                                                                    */
/* -------------------------------------------------------------------------- */

function Pillar({ side }: { side: "left" | "right" }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        [side]: 0,
        top: `${OPENING.top - 2}%`,
        bottom: `${OPENING.bottom - 5}%`,
        width: `${OPENING.side + 0.6}%`,
        transform: side === "right" ? "scaleX(-1)" : undefined,
      }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 700" preserveAspectRatio="none" aria-hidden>
        <defs>
          {/* A round column, not a plank: bright core, dark at both edges. */}
          <linearGradient id={`col-${side}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={WOOD.deep} />
            <stop offset="0.16" stopColor={WOOD.dark} />
            <stop offset="0.42" stopColor={WOOD.lit} />
            <stop offset="0.58" stopColor={WOOD.light} />
            <stop offset="0.84" stopColor={WOOD.mid} />
            <stop offset="1" stopColor={WOOD.deep} />
          </linearGradient>
          <filter id={`pgrain-${side}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.8 0.02" numOctaves="3" seed="4" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>

        {/* Capital, carrying the beam. */}
        <polygon points="0,0 200,0 178,40 22,40" fill={WOOD.dark} />
        <rect y="40" width="200" height="16" fill={WOOD.mid} />
        <rect y="40" width="200" height="3" fill={GOLD.dark} opacity="0.7" />
        {/* Corbel scrolls under the capital. */}
        <path d="M22 56 Q40 84 22 96 L46 96 Q60 76 52 56 Z" fill={WOOD.dark} />
        <path d="M178 56 Q160 84 178 96 L154 96 Q140 76 148 56 Z" fill={WOOD.dark} />

        {/* Shaft. */}
        <rect x="26" y="56" width="148" height="548" fill={`url(#col-${side})`} />
        <rect x="26" y="56" width="148" height="548" filter={`url(#pgrain-${side})`} opacity="0.16" style={{ mixBlendMode: "overlay" }} />

        {/* Carved collars, and a panel of flutes between each pair. */}
        {[112, 300, 488].map((y) => (
          <g key={y}>
            <rect x="16" y={y} width="168" height="34" fill={WOOD.dark} />
            <rect x="16" y={y} width="168" height="3" fill={GOLD.mid} opacity="0.5" />
            <rect x="16" y={y + 31} width="168" height="3" fill={WOOD.deep} />
            <Rosette cx={100} cy={y + 17} r={12} />
          </g>
        ))}
        {[
          [150, 296],
          [338, 484],
          [526, 600],
        ].map(([y0, y1], i) => (
          <g key={i}>
            {[46, 72, 98, 124, 150].map((x) => (
              <rect key={x} x={x} y={y0} width="5" height={y1 - y0} fill="#000" opacity="0.26" />
            ))}
          </g>
        ))}

        {/* Stepped base. */}
        <rect x="14" y="604" width="172" height="30" fill={WOOD.mid} />
        <rect x="4" y="634" width="192" height="26" fill={WOOD.dark} />
        <rect y="660" width="200" height="40" fill={WOOD.deep} />
        <rect x="4" y="634" width="192" height="4" fill={WOOD.lit} opacity="0.45" />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Garlands                                                                   */
/* -------------------------------------------------------------------------- */

function quadAt(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

/**
 * Marigold and jasmine swags, hung from the beam.
 *
 * Drawn ON TOP of the curtain, because that is where they hang in a real
 * pandal — and it means they stay put while the cloth draws away behind them,
 * which is the detail that sells the whole frame as a physical stage rather
 * than as layered graphics.
 */
function Garlands() {
  const SWAGS = 6;
  const W = 1600;
  const span = W / SWAGS;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${OPENING.side - 1}%`,
        right: `${OPENING.side - 1}%`,
        top: `${OPENING.top - 0.6}%`,
        height: `${GARLAND_DROP + 2}%`,
      }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 200" preserveAspectRatio="none" aria-hidden>
        {Array.from({ length: SWAGS }, (_, s) => {
          const x0 = s * span;
          const x1 = x0 + span;
          const beads = 40;

          return (
            <g key={s}>
              {Array.from({ length: beads }, (_, i) => {
                const t = i / (beads - 1);
                const p = quadAt(t, x0, 4, (x0 + x1) / 2, 128, x1, 4);
                const kind = i % 7;
                const fill =
                  kind === 0 || kind === 4
                    ? MARIGOLD.orange
                    : kind === 2 || kind === 5
                    ? MARIGOLD.yellow
                    : kind === 6
                    ? MARIGOLD.leaf
                    : MARIGOLD.cream;
                return (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y + 3} r={11} fill="#000" opacity="0.3" />
                    <circle cx={p.x} cy={p.y} r={11} fill={fill} />
                    <circle cx={p.x - 3} cy={p.y - 3.5} r={3.4} fill="#fff" opacity="0.28" />
                  </g>
                );
              })}
              {/* Hanging tassel where two swags meet. */}
              {s > 0 && (
                <g transform={`translate(${x0} 6)`}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <circle key={i} cy={i * 17} r={i < 4 ? 10 : 8} fill={i % 2 ? MARIGOLD.orange : MARIGOLD.yellow} />
                  ))}
                  <circle cy={88} r={6} fill={MARIGOLD.leaf} />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Nilavilakku                                                                */
/* -------------------------------------------------------------------------- */

function Flame({ x, y, scale, delay, reduced }: { x: number; y: number; scale: number; delay: number; reduced: boolean }) {
  return (
    <motion.g
      transform={`translate(${x} ${y}) scale(${scale})`}
      animate={reduced ? undefined : { scaleY: [1, 1.18, 0.93, 1.1, 1], opacity: [0.9, 1, 0.86, 1, 0.9] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay }}
      style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}
    >
      <path d="M0 0 C -8 -12 -7 -24 0 -36 C 7 -24 8 -12 0 0 Z" fill="#FFC65A" />
      <path d="M0 -3 C -4.5 -11 -4 -19 0 -26 C 4 -19 4.5 -11 0 -3 Z" fill="#FFF6D8" />
    </motion.g>
  );
}

/** The brass lamp: lit, and standing on the stage floor in front of a pillar. */
function Nilavilakku({ side, reduced }: { side: "left" | "right"; reduced: boolean }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        [side]: `${OPENING.side - 3.6}%`,
        bottom: `${OPENING.bottom - 4.5}%`,
        width: "7%",
        height: "40%",
      }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 130 460" preserveAspectRatio="xMidYMax meet" aria-hidden>
        <defs>
          <linearGradient id={`brass-${side}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#6B4E0E" />
            <stop offset="0.26" stopColor={GOLD.bright} />
            <stop offset="0.48" stopColor={GOLD.pale} />
            <stop offset="0.72" stopColor={GOLD.mid} />
            <stop offset="1" stopColor="#5A400B" />
          </linearGradient>
          <radialGradient id={`glow-${side}`}>
            <stop offset="0" stopColor="#FFC65A" stopOpacity="0.5" />
            <stop offset="0.55" stopColor="#FF9C3A" stopOpacity="0.16" />
            <stop offset="1" stopColor="#FF9C3A" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="65" cy="62" rx="74" ry="62" fill={`url(#glow-${side})`} />

        <Flame x={28} y={72} scale={0.8} delay={0} reduced={reduced} />
        <Flame x={65} y={64} scale={1} delay={0.6} reduced={reduced} />
        <Flame x={102} y={72} scale={0.8} delay={1.2} reduced={reduced} />

        {/* Bowl with the pointed spouts a nilavilakku has. */}
        <path d="M16 72 Q65 96 114 72 Q106 112 65 116 Q24 112 16 72 Z" fill={`url(#brass-${side})`} />
        <path d="M65 58 L72 76 L58 76 Z" fill={GOLD.pale} />

        {/* Stem: graduated discs down a tapering shaft. */}
        <rect x="56" y="116" width="18" height="228" fill={`url(#brass-${side})`} />
        {[140, 184, 228, 272, 316].map((y, i) => (
          <ellipse key={y} cx="65" cy={y} rx={26 - i * 2} ry="8" fill={`url(#brass-${side})`} />
        ))}

        {/* Flared foot. */}
        <path d="M30 344 Q65 334 100 344 L116 412 Q65 428 14 412 Z" fill={`url(#brass-${side})`} />
        <ellipse cx="65" cy="418" rx="56" ry="15" fill="#5A400B" />
        <ellipse cx="65" cy="413" rx="56" ry="14" fill={`url(#brass-${side})`} />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Floor                                                                      */
/* -------------------------------------------------------------------------- */

function Floor() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: `${OPENING.bottom}%` }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 160" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="floorWood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#B77C41" />
            <stop offset="0.3" stopColor="#8B5A2B" />
            <stop offset="0.72" stopColor="#5A3618" />
            <stop offset="1" stopColor="#2A1810" />
          </linearGradient>
          {/* The curtain's own light, pooling on a polished floor. */}
          <linearGradient id="floorPool" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#C2543C" stopOpacity="0.4" />
            <stop offset="0.55" stopColor="#8A2B22" stopOpacity="0.1" />
            <stop offset="1" stopColor="#8A2B22" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="floorSheen" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#FFD9A0" stopOpacity="0.3" />
            <stop offset="0.5" stopColor="#FFD9A0" stopOpacity="0.03" />
            <stop offset="1" stopColor="#FFD9A0" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="1600" height="160" fill="url(#floorWood)" />
        {/* Boards, converging very slightly so the floor reads as receding. */}
        {Array.from({ length: 30 }, (_, i) => {
          const x = (i * 1600) / 30;
          return <path key={i} d={`M${x} 0 L${x - 40} 132`} stroke="#2A1810" strokeWidth="2" opacity="0.38" />;
        })}
        <rect x="176" width="1248" height="132" fill="url(#floorPool)" />
        <rect width="1600" height="132" fill="url(#floorSheen)" />
        {/* Front edge of the platform. */}
        <rect y="132" width="1600" height="28" fill={WOOD.deep} />
        <rect y="132" width="1600" height="3" fill={WOOD.lit} opacity="0.4" />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The whole frame. Sits above the curtain so the garlands, the beam's shadow
 * and the pillars all overlap the cloth, exactly as they would on a real
 * stage.
 */
export function Pavilion({ siteName, logoUrl }: { siteName: string; logoUrl?: string }) {
  const reduced = Boolean(useReducedMotion());

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[16]">
      <Pillar side="left" />
      <Pillar side="right" />
      <RoofAndBeam siteName={siteName} />
      <Garlands />
      <Floor />

      {/* Lamps stand on the floor, in front of everything else. */}
      <Nilavilakku side="left" reduced={reduced} />
      <Nilavilakku side="right" reduced={reduced} />

      {/* House lights: two warm washes raking down across the frame. Static,
          and additive, so they lift the woodwork without flattening it. */}
      <div
        className="absolute inset-0"
        style={{
          mixBlendMode: "screen",
          opacity: 0.5,
          background:
            "radial-gradient(ellipse 40% 62% at 17% -6%, rgba(255,190,110,0.3), transparent 70%), radial-gradient(ellipse 40% 62% at 83% -6%, rgba(255,190,110,0.3), transparent 70%)",
        }}
      />

      {/* The mark, hung in the gable. HTML, so it is the same asset the rest
          of the site uses rather than a second copy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl || "/images/logo.png"}
        alt=""
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: `${OPENING.top * 0.24}%`,
          height: `${OPENING.top * 0.42}%`,
          boxShadow: `0 0 0 0.3vmin ${GOLD.mid}, 0 0.8vmin 2vmin rgba(0,0,0,0.75)`,
        }}
      />
    </div>
  );
}
