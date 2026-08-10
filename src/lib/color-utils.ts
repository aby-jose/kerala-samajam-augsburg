/**
 * Converts a hex colour to the bare `H S% L%` triplet that the CSS custom
 * properties in globals.css expect (they are wrapped by `hsl(...)` in @theme).
 * Returns null for anything that isn't a 3- or 6-digit hex value.
 */
export function hexToHsl(hex: string): string | null {
  hex = hex.replace(/^#/, "");

  if (hex.length === 3) {
    hex = hex.split("").map(s => s + s).join("");
  }

  if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return null;

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}
