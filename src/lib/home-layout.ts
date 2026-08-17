import {
  repairLayout as repairGeneric,
  resolveSections as resolveGeneric,
  type ResolvedSection as GenericResolvedSection,
} from "./page-layout";
import { HOME_SECTION_IDS, type HomeContentT, type HomeSectionId } from "./home-schema";
import { HOME_SECTION_META } from "./home-sections";

// The generic function's `id` widens to `string` because it is parameterised
// over an arbitrary `Id extends string`. Every id it can actually produce
// here comes from HOME_SECTION_META, whose keys are HomeSectionId, so
// narrowing back is sound rather than papering over a mismatch.
export type ResolvedSection = Omit<GenericResolvedSection, "id"> & { id: HomeSectionId };

/**
 * Make any stored layout renderable: drop ids we no longer ship, collapse
 * duplicates keeping the first, append sections added since the document was
 * saved (visible, at the end), and pin the hero to the top. See
 * lib/page-layout.ts for the generic version every page shares.
 *
 * The cast is sound, not a mismatch papered over: `repairGeneric` only ever
 * returns ids drawn from `HOME_SECTION_IDS`, one entry per id, which is
 * exactly the shape `HomeContentT["layout"]` describes.
 */
export const repairLayout = (stored: unknown): HomeContentT["layout"] =>
  repairGeneric(HOME_SECTION_IDS, HOME_SECTION_META, stored) as HomeContentT["layout"];

export const resolveSections = (layout: HomeContentT["layout"]): ResolvedSection[] =>
  resolveGeneric(HOME_SECTION_META, layout) as ResolvedSection[];
