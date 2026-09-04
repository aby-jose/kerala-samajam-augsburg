/**
 * The cloth.
 *
 * The curtain, the valance and the Unveil control are one material — the chief
 * guest presses a piece of the drape itself — so the fold model lives here and
 * every surface renders from the same stops.
 *
 * Hard-edged bands read as a barcode, however irregular their widths. Velvet
 * hangs in SMOOTH folds: luminance climbs from the shadow in each trough to a
 * soft sheen on the crest and falls away again, and the crest sits off-centre
 * because the light comes from one side of the house. So every fold here is
 * five soft stops on an irregular period, never a step.
 *
 * The red is a deep theatre red, not the brand crimson. Crimson at this scale
 * went pink and read as fabric dye rather than stage velvet; pulling the hue
 * warm (toward 355) and dropping the crest's saturation gives the dusty,
 * light-absorbing look real velvet has. The brand crimson still owns the
 * accents, where it now stands out against the cloth instead of blending in.
 *
 * Nothing here animates. The stage has to hold 60fps on whatever machine is
 * driving the hall projector, so the material is rasterised once and only the
 * container ever transforms.
 */

export interface FoldStop {
  /** 0–100, percent across the panel. */
  at: number;
  color: string;
}

/** Deep in the trough between folds — almost black, with the red still in it. */
const TROUGH = "hsl(355 55% 7%)";
/** The body of the cloth. */
const SHADE = "hsl(355 58% 18%)";
/** Where the nap catches the light. Desaturated, because velvet scatters. */
const CREST = "hsl(357 38% 33%)";

/**
 * The fold stops across one panel.
 *
 * Widths are irregular on two interleaved periods (`% 5` stepping by 7,
 * `% 3` stepping by 3) so no repeat resolves even across half a projector
 * screen, and `phase` shifts both so the two halves are never mirror images.
 * The crest sits at 38% of each fold: one light source, one side lit.
 */
export function foldStops(phase: number, folds = 22): FoldStop[] {
  const widths: number[] = [];
  for (let i = 0; i < folds; i++) {
    widths.push(3.4 + ((i * 7 + phase) % 5) * 0.75 + ((i * 3 + phase) % 3) * 0.4);
  }
  const total = widths.reduce((a, b) => a + b, 0);

  const stops: FoldStop[] = [];
  let at = 0;
  for (const raw of widths) {
    const w = (raw / total) * 100;
    stops.push(
      { at, color: TROUGH },
      { at: at + w * 0.18, color: SHADE },
      { at: at + w * 0.38, color: CREST },
      { at: at + w * 0.62, color: SHADE },
      { at: at + w, color: TROUGH }
    );
    at += w;
  }
  return stops;
}

/** The same folds as a CSS gradient, for surfaces that are plain elements. */
export function velvetCss(phase: number, folds = 22): string {
  return `linear-gradient(90deg, ${foldStops(phase, folds)
    .map((s) => `${s.color} ${s.at.toFixed(2)}%`)
    .join(", ")})`;
}
