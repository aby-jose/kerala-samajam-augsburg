// Regenerates src/lib/icons/lucide-icon-names.ts from the installed
// lucide-react package. Run this after bumping the lucide-react version so
// the icon picker (and the schemas it validates against) pick up any icons
// added, renamed or removed upstream:
//
//   node scripts/generate-lucide-icon-names.mjs
//
// It cross-references two manifests lucide-react ships for its own tooling:
//  - dist/esm/lucide-react.js       — the canonical PascalCase export name
//                                     per icon (what we already store, e.g.
//                                     "Flower2"), keyed by icon file.
//  - dist/esm/dynamicIconImports.js — the canonical kebab-case name per icon
//                                     file, which is what lucide-react's
//                                     DynamicIcon component needs at render
//                                     time to lazily import just that icon.
// Joining them by file gives an exact, non-guessed Pascal<->kebab mapping —
// no name-casing heuristics that could drift from what the package actually
// ships.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const pkgDir = path.join(root, "node_modules", "lucide-react");

const staticSrc = fs.readFileSync(path.join(pkgDir, "dist/esm/lucide-react.js"), "utf8");
const fileToPascal = new Map();
for (const line of staticSrc.split("\n")) {
  const m = line.match(/^export \{ (.+) \} from '\.\/icons\/(.+)\.js';$/);
  if (!m) continue;
  const [, aliasesRaw, file] = m;
  if (fileToPascal.has(file)) continue; // first export line per file is canonical; later lines are legacy aliases
  const aliases = aliasesRaw.split(",").map((s) => s.trim().replace("default as ", ""));
  const canonical = aliases.find((a) => !a.startsWith("Lucide") && !a.endsWith("Icon"));
  if (canonical) fileToPascal.set(file, canonical);
}

const dynamicSrc = fs.readFileSync(path.join(pkgDir, "dist/esm/dynamicIconImports.js"), "utf8");
const fileToKebab = new Map();
for (const [, key, file] of dynamicSrc.matchAll(
  /["']([a-z0-9-]+)["']\s*:\s*\(\)\s*=>\s*import\('\.\/icons\/([a-zA-Z0-9-]+)\.js'\)/g
)) {
  if (!fileToKebab.has(file)) fileToKebab.set(file, key); // same first-wins rule
}

const pairs = [...fileToPascal.entries()]
  .map(([file, pascal]) => ({ pascal, kebab: fileToKebab.get(file) }))
  .filter((p) => p.kebab)
  .sort((a, b) => a.pascal.localeCompare(b.pascal));

if (pairs.length < 1000) {
  throw new Error(`Only found ${pairs.length} icons — lucide-react's internal file layout may have changed.`);
}

const version = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8")).version;

const out = `// GENERATED FILE — do not hand-edit.
// Regenerate with: node scripts/generate-lucide-icon-names.mjs
// Source: lucide-react@${version}
//
// The full set of icons lucide-react ships, in the PascalCase form already
// used for stored icon names (e.g. "Flower2"), each paired with the
// kebab-case name lucide's DynamicIcon needs to lazily load it. Backing the
// icon picker and every icon-typed zod schema, so any name here is
// guaranteed to render — see components/icons/lucide-icon.tsx.

export const LUCIDE_ICON_NAMES = [
${pairs.map((p) => `  "${p.pascal}",`).join("\n")}
] as const;

export type LucideIconName = (typeof LUCIDE_ICON_NAMES)[number];

export const LUCIDE_ICON_KEBAB: Record<LucideIconName, string> = {
${pairs.map((p) => `  ${p.pascal}: "${p.kebab}",`).join("\n")}
};
`;

const outPath = path.join(root, "src/lib/icons/lucide-icon-names.ts");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`Wrote ${pairs.length} icons to ${path.relative(root, outPath)}`);
