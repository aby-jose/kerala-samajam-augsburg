"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import { cn, getErrorMessage } from "@/lib/utils";
import { deleteRole, upsertRole, type RoleSummary } from "@/lib/role-actions";

interface PermissionGroupView {
  group: string;
  permissions: { key: string; label: string; mutates: boolean }[];
}

/**
 * Roles down the left, the permission matrix for whichever one is selected
 * on the right. Super Admin renders fully ticked and read-only — its stored
 * `permissions` array is empty and `listRoles` hands back the computed set,
 * so there is nothing here to edit even for someone who holds `roles.edit`.
 */
export function RolesClient({
  roles,
  groups,
  canEdit,
}: {
  roles: RoleSummary[];
  groups: PermissionGroupView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();

  const [selectedId, setSelectedId] = React.useState<string | null>(roles[0]?.id ?? null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [permissions, setPermissions] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const selectedRole = isCreating ? null : roles.find((r) => r.id === selectedId) ?? null;

  // Reload the form whenever the selection changes, or whenever the roles
  // prop itself changes (a save/refresh brought back fresher data).
  React.useEffect(() => {
    if (isCreating) {
      setName("");
      setDescription("");
      setPermissions(new Set());
      return;
    }
    if (selectedRole) {
      setName(selectedRole.name);
      setDescription(selectedRole.description ?? "");
      setPermissions(new Set(selectedRole.permissions));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, isCreating, roles]);

  function selectRole(role: RoleSummary) {
    setIsCreating(false);
    setSelectedId(role.id);
  }

  function startCreating() {
    setIsCreating(true);
    setSelectedId(null);
  }

  function togglePermission(key: string) {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await upsertRole({
        id: selectedRole?.id,
        name,
        description,
        permissions: Array.from(permissions),
      });
      if ("error" in result && result.error) {
        toastError(result.error);
        return;
      }
      success(isCreating ? "Role created" : "Role saved");
      setIsCreating(false);
      router.refresh();
    } catch (e) {
      toastError(getErrorMessage(e, "Could not save the role."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(role: RoleSummary) {
    const confirmed = await confirm({
      title: "Delete role",
      message: `Delete the "${role.name}" role? This cannot be undone.`,
      variant: "danger",
      confirmText: "Delete role",
    });
    if (!confirmed) return;

    setDeletingId(role.id);
    try {
      const result = await deleteRole(role.id);
      if ("error" in result && result.error) {
        toastError(result.error);
        return;
      }
      success("Role deleted");
      if (selectedId === role.id) setSelectedId(null);
      router.refresh();
    } catch (e) {
      toastError(getErrorMessage(e, "Could not delete the role."));
    } finally {
      setDeletingId(null);
    }
  }

  const isSuperAdmin = selectedRole?.isSystem ?? false;
  const deleteDisabled =
    !canEdit || !selectedRole || isSuperAdmin || selectedRole.userCount > 0 || deletingId === selectedRole?.id;
  const deleteTitle = isSuperAdmin
    ? "Super Admin cannot be deleted."
    : selectedRole && selectedRole.userCount > 0
      ? "Move its holders to another role first."
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader title="Roles" description="Define what each role can see and do across the admin panel.">
        {canEdit && (
          <Button onClick={startCreating} className="h-9 rounded-lg">
            <Plus className="mr-2 h-4 w-4" />
            New role
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <section className={cn(cardSurface, "flex flex-col overflow-hidden")}>
          <header className={panelHeader}>
            <h2 className="font-sans text-sm font-semibold text-foreground">All roles</h2>
          </header>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {roles.map((role) => (
              <RoleListItem
                key={role.id}
                role={role}
                active={!isCreating && role.id === selectedId}
                onClick={() => selectRole(role)}
              />
            ))}
            {isCreating && (
              <div className="flex w-full items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 text-sm font-medium text-primary">
                <Plus className="h-3.5 w-3.5" />
                New role
              </div>
            )}
          </div>
        </section>

        <section className={cn(cardSurface, "flex flex-col overflow-hidden")}>
          {!selectedRole && !isCreating ? (
            <EmptyState
              icon={ShieldCheck}
              title="No role selected"
              description="Pick a role on the left to view or edit its permissions."
            />
          ) : (
            <>
              <header className={cn(panelHeader, "flex-col items-stretch gap-4 sm:flex-row sm:items-start")}>
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="role-name">Name</Label>
                    <Input
                      id="role-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!canEdit || isSuperAdmin}
                      placeholder="e.g. Treasurer"
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role-description">Description</Label>
                    <Input
                      id="role-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!canEdit || isSuperAdmin}
                      placeholder="What this role is for"
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>
                {!isCreating && selectedRole && (
                  <Button
                    variant="outline"
                    onClick={() => handleDelete(selectedRole)}
                    disabled={deleteDisabled}
                    title={deleteTitle}
                    className="h-9 shrink-0 gap-2 rounded-lg text-red-600 hover:text-red-600 disabled:text-muted-foreground dark:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                    {selectedRole.userCount > 0 && (
                      <span className="rounded-full bg-black/[0.05] px-1.5 py-0.5 text-xs font-semibold dark:bg-white/[0.08]">
                        {selectedRole.userCount}
                      </span>
                    )}
                  </Button>
                )}
              </header>

              {isSuperAdmin && (
                <p className="border-b border-black/[0.07] bg-primary/5 px-5 py-3 text-xs text-muted-foreground sm:px-6 dark:border-white/[0.08]">
                  Super Admin always holds every permission, including ones added in future updates.
                </p>
              )}

              <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
                {groups.map((g) => (
                  <div key={g.group} className="space-y-2.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {g.group}
                    </h3>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {g.permissions.map((p) => (
                        <label
                          key={p.key}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm text-foreground",
                            (!canEdit || isSuperAdmin) && "opacity-70"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSuperAdmin || permissions.has(p.key)}
                            disabled={!canEdit || isSuperAdmin}
                            onChange={() => togglePermission(p.key)}
                            className="h-4 w-4 rounded border-border"
                          />
                          <span className="truncate">{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {canEdit && !isSuperAdmin && (
                <div className="flex items-center justify-end gap-2 border-t border-black/[0.07] px-5 py-4 sm:px-6 dark:border-white/[0.08]">
                  {isCreating && (
                    <Button variant="outline" onClick={() => setIsCreating(false)} className="h-9 rounded-lg">
                      Cancel
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={saving || !name.trim()} className="h-9 rounded-lg">
                    {isCreating ? "Create role" : "Save changes"}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function RoleListItem({
  role,
  active,
  onClick,
}: {
  role: RoleSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-foreground">
          {role.isSystem && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="truncate">{role.name}</span>
        </span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {role.userCount}
        </span>
      </div>
      {role.description && (
        <span className="line-clamp-1 text-xs text-muted-foreground">{role.description}</span>
      )}
    </button>
  );
}
