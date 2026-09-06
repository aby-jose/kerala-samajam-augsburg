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

/**
 * The three tones of the cloth, at a fraction of full light.
 *
 * A house has ONE light, so a valance is not five identical swags — the ones
 * near the source are open and the ones at the walls fall away. `lift` is that
 * falloff: 1 is full light, and everything below it walks the tone down toward
 * the trough it would reach in shadow. Hue and saturation hold, because velvet
 * losing light goes darker, not greyer.
 */
const TONES = {
  /** Deep in the trough between folds — almost black, with the red still in it. */
  trough: [355, 55, 7],
  /** The body of the cloth. */
  shade: [355, 58, 18],
  /** Where the nap catches the light. Desaturated, because velvet scatters. */
  crest: [357, 38, 33],
} as const;

export function tone(which: keyof typeof TONES, lift = 1): string {
  const [h, s, l] = TONES[which];
  return `hsl(${h} ${s}% ${(l * lift).toFixed(1)}%)`;
}

export const TROUGH = tone("trough");
export const SHADE = tone("shade");
export const CREST = tone("crest");

/**
 * The braid, on the same falloff.
 *
 * Trim that holds one value along its whole length is the single loudest tell
 * of a drawn curtain: real bullion is only bright where the cloth under it
 * faces the light, and goes to a dull tarnish where it turns away.
 */
export function braid(level: BraidLevel, lift = 1): string {
  const [h, s, l] = BRAID[level];
  return `hsl(${h} ${s}% ${(l * lift).toFixed(1)}%)`;
}

/**
 * Antique gold, not lemon.
 *
 * The old trim sat at one hue with a narrow tonal range, which is what paint
 * does; metal has a wide one and a warm shadow. Pulling the shadow toward
 * copper (34) and the highlight toward champagne (45) is what makes a flat
 * stroke read as bullion. `thread` is the fringe — duller and darker than the
 * braid it hangs from, because it hangs in the braid's own shadow.
 */
const BRAID = {
  dark: [34, 50, 19],
  thread: [38, 54, 41],
  mid: [40, 62, 44],
  lit: [45, 78, 70],
} as const;

type BraidLevel = keyof typeof BRAID;

/**
 * The fold stops across one panel.
 *
 * Widths are irregular on two interleaved periods (`% 5` stepping by 7,
 * `% 3` stepping by 3) so no repeat resolves even across half a projector
 * screen, and `phase` shifts both so the two halves are never mirror images.
 * The crest sits at 38% of each fold: one light source, one side lit.
 */
export function foldStops(phase: number, folds = 22, lift = 1): FoldStop[] {
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
      { at, color: tone("trough", lift) },
      { at: at + w * 0.18, color: tone("shade", lift) },
      { at: at + w * 0.38, color: tone("crest", lift) },
      { at: at + w * 0.62, color: tone("shade", lift) },
      { at: at + w, color: tone("trough", lift) }
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
