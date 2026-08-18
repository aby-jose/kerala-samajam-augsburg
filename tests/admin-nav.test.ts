import { describe, expect, it } from "vitest";

import { filterNavGroups } from "@/lib/admin-nav";

describe("filterNavGroups", () => {
  it("keeps a permissioned item only when the caller holds that permission", () => {
    const groups = [
      { label: "System", items: [{ href: "/a", permission: "settings.edit" }] },
    ];

    expect(filterNavGroups(groups, [])).toEqual([]);
    expect(filterNavGroups(groups, ["settings.edit"])).toEqual(groups);
  });

  it("always keeps an item with no permission, even with zero permissions held", () => {
    const groups = [{ label: "Account", items: [{ href: "/admin/account", permission: undefined }] }];

    expect(filterNavGroups(groups, [])).toEqual(groups);
  });

  it("drops a group entirely once every one of its items is filtered out", () => {
    const groups = [
      { label: "System", items: [{ href: "/a", permission: "settings.edit" }] },
      { label: "Account", items: [{ href: "/admin/account", permission: undefined }] },
    ];

    expect(filterNavGroups(groups, [])).toEqual([
      { label: "Account", items: [{ href: "/admin/account", permission: undefined }] },
    ]);
  });

  it("keeps only the matching items within a mixed group", () => {
    const groups = [
      {
        label: "Mixed",
        items: [
          { href: "/a", permission: "settings.edit" },
          { href: "/b", permission: undefined },
          { href: "/c", permission: "staff.view" },
        ],
      },
    ];

    expect(filterNavGroups(groups, ["staff.view"])).toEqual([
      {
        label: "Mixed",
        items: [
          { href: "/b", permission: undefined },
          { href: "/c", permission: "staff.view" },
        ],
      },
    ]);
  });
});
