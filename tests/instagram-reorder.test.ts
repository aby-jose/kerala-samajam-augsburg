import { describe, expect, it } from "vitest";
import { reorderFeatured } from "@/lib/instagram-reorder";

describe("reorderFeatured", () => {
  it("swaps an item up with its neighbour", () => {
    expect(reorderFeatured(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
  });

  it("swaps an item down with its neighbour", () => {
    expect(reorderFeatured(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("is a no-op moving the first item up", () => {
    expect(reorderFeatured(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"]);
  });

  it("is a no-op moving the last item down", () => {
    expect(reorderFeatured(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"]);
  });

  it("is a no-op for an id that isn't in the list", () => {
    expect(reorderFeatured(["a", "b", "c"], "z", "up")).toEqual(["a", "b", "c"]);
  });
});
