/**
 * The cloth.
 *
 * The curtain and the Unveil control are meant to read as the same material —
 * the chief guest presses a piece of the drape itself — so the gradient passes
 * that make up that material live here rather than inside either component.
 *
 * Every pass is a static `linear-gradient`. Nothing here animates: the stage
 * has to hold 60fps on whatever machine is driving the hall projector, and
 * animated gradients and filters are non-composited.
 *
 * The three passes deliberately run on three DIFFERENT irregular intervals.
 * One pass — however uneven its stops — still resolves into a repeat once it
 * is stretched across half a projector screen. Three passes whose periods
 * never line up do not.
 */

/**
 * Irregular pleats — the base bands.
 *
 * Evenly spaced bands read as exactly what they are — a repeating CSS
 * gradient. Real fabric bunches unevenly, so these stops are deliberately
 * uneven, and callers pass different phases for the two halves so the eye
 * never catches the symmetry.
 */
export function pleats(phase: number): string {
  const stops: string[] = [];
  let at = 0;

  for (let i = 0; at < 100; i++) {
    const width = 3.2 + ((i * 7 + phase) % 5) * 0.9;
    const shade = i % 2 === 0 ? "rgba(0,0,0,0.34)" : "rgba(255,255,255,0.05)";
    stops.push(`${shade} ${at}%`, `${shade} ${Math.min(at + width, 100)}%`);
    at += width;
  }

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/**
 * Deep folds — a broad, soft shadow pass on a much longer period than
 * `pleats`, and a different irregularity (`% 7` against `% 5`, stepping by 5
 * against 7), so the two never fall into step.
 *
 * Soft-edged on purpose — transparent, shadow, transparent — so each fold
 * darkens a whole run of bands at once instead of drawing yet another hard
 * line. This is the pass that says "the panel is hanging in waves" rather than
 * "the panel is striped".
 *
 * Stops are allowed to run past 100%; CSS clamps them and it keeps the last
 * fold from being cut into a hard edge at the panel's outer margin.
 */
export function deepFolds(phase: number): string {
  const stops: string[] = [];
  let at = 0;

  for (let i = 0; at < 100; i++) {
    const width = 12 + ((i * 5 + phase) % 7) * 2.4;
    stops.push(
      `rgba(0,0,0,0) ${at}%`,
      `rgba(0,0,0,0.3) ${at + width * 0.5}%`,
      `rgba(0,0,0,0) ${at + width}%`
    );
    at += width;
  }

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/**
 * Crests — a narrow highlight where the light catches the front of a fold.
 *
 * A third period again (`% 4`, stepping by 11), and the highlight is much
 * narrower than the gap it sits in, so this pass is mostly transparent and
 * only ever adds a thread of light. Anything wider stops reading as a crest
 * and starts reading as a second set of stripes.
 */
export function crests(phase: number): string {
  const stops: string[] = [];
  let at = 0;

  for (let i = 0; at < 100; i++) {
    const period = 6.5 + ((i * 11 + phase) % 4) * 1.6;
    const lit = 2.2;
    stops.push(
      `rgba(255,255,255,0) ${at}%`,
      `rgba(255,255,255,0.085) ${at + lit * 0.5}%`,
      `rgba(255,255,255,0) ${at + lit}%`
    );
    at += period;
  }

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
