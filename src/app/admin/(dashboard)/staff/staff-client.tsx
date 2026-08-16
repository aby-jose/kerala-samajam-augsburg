"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, RefreshCw, ShieldCheck, UserPlus, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import { cn, getErrorMessage } from "@/lib/utils";
import {
  changeStaffRole,
  inviteStaff,
  resendInvite,
  revokeInvite,
  revokeStaffAccess,
  type PendingInvite,
  type StaffRow,
} from "@/lib/staff-actions";

interface RoleOption {
  id: string;
  name: string;
}

export function StaffClient({
  staff,
  invites,
  roles,
  currentUserId,
  canInvite,
  canManage,
}: {
  staff: StaffRow[];
  invites: PendingInvite[];
  roles: RoleOption[];
  currentUserId: string;
  canInvite: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRoleId, setInviteRoleId] = React.useState(roles[0]?.id ?? "");
  const [inviting, setInviting] = React.useState(false);

  async function handleChangeRole(userId: string, roleId: string) {
    setBusyId(userId);
    try {
      const result = await changeStaffRole(userId, roleId);
      if ("error" in result && result.error) {
        toastError(result.error);
        return;
      }
      success("Role updated");
      router.refresh();
    } catch (e) {
      toastError(getErrorMessage(e, "Could not change the role."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeAccess(row: StaffRow) {
    const confirmed = await confirm({
      title: "Remove admin access",
      message: `Remove ${row.name || row.email}'s admin access? Their member account is kept, but they will lose access to this dashboard.`,
      variant: "danger",
      confirmText: "Remove access",
    });
    if (!confirmed) return;

    setBusyId(row.id);
    try {
      const result = await revokeStaffAccess(row.id);
      if ("error" in result && result.error) {
        toastError(result.error);
        return;
      }
      success("Access removed");
      router.refresh();
    } catch (e) {
      toastError(getErrorMessage(e, "Could not remove access."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteRoleId) return;

    setInviting(true);
    try {
      const result = await inviteStaff(inviteEmail.trim(), inviteRoleId);
      if ("error" in result && result.error) {
        toastError(result.error);
        return;
      }
      success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      router.refresh();
    } catch (e) {
      toastError(getErrorMessage(e, "Could not send the invitation."));
    } finally {
      setInviting(false);
    }
  }

  async function handleResend(invite: PendingInvite) {
    setBusyId(invite.id);
    try {
      const result = await resendInvite(invite.id);
      if ("error" in result && result.error) {
        toastError(result.error);
        return;
      }
      success(`Invitation resent to ${invite.email}`);
      router.refresh();
    } catch (e) {
      toastError(getErrorMessage(e, "Could not resend the invitation."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevokeInvite(invite: PendingInvite) {
    const confirmed = await confirm({
      title: "Cancel invitation",
      message: `Cancel the invitation to ${invite.email}?`,
      variant: "warning",
      confirmText: "Cancel invitation",
    });
    if (!confirmed) return;

    setBusyId(invite.id);
    try {
      const result = await revokeInvite(invite.id);
      if ("error" in result && result.error) {
        toastError(result.error);
        return;
      }
      success("Invitation cancelled");
      router.refresh();
    } catch (e) {
      toastError(getErrorMessage(e, "Could not cancel the invitation."));
    } finally {
      setBusyId(null);
    }
  }

  const staffColumns: DataTableColumn<StaffRow>[] = [
    {
      key: "member",
      header: "Staff member",
      width: "w-[36%]",
      cellClassName: "min-w-0",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      width: "w-[36%]",
      render: (row) => {
        const isSelf = row.id === currentUserId;
        if (isSelf) {
          return (
            <div>
              <p className="flex items-center gap-1.5 text-sm text-foreground">
                {row.isSystem && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
                {row.roleName}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">You cannot change your own access</p>
            </div>
          );
        }
        if (canManage) {
          return (
            <Select
              value={row.roleId}
              onValueChange={(value) => handleChangeRole(row.id, value)}
              disabled={busyId === row.id}
            >
              <SelectTrigger className="h-9 w-full max-w-[220px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        return (
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            {row.isSystem && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
            {row.roleName}
          </p>
        );
      },
    },
    {
      key: "actions",
      header: "",
      width: "w-[28%]",
      align: "right",
      render: (row) => {
        const isSelf = row.id === currentUserId;
        if (isSelf || !canManage) return null;
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRevokeAccess(row)}
            disabled={busyId === row.id}
            className="h-8 rounded-lg text-red-600 hover:text-red-600 dark:text-red-400"
          >
            {busyId === row.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Remove access
          </Button>
        );
      },
    },
  ];

  const inviteColumns: DataTableColumn<PendingInvite>[] = [
    {
      key: "email",
      header: "Email",
      width: "w-[28%]",
      cellClassName: "min-w-0",
      render: (i) => <p className="truncate text-sm font-medium text-foreground">{i.email}</p>,
    },
    { key: "role", header: "Role", width: "w-[18%]", render: (i) => i.roleName },
    { key: "invitedBy", header: "Invited by", width: "w-[22%]", render: (i) => i.invitedByEmail },
    {
      key: "expires",
      header: "Expires",
      width: "w-[16%]",
      render: (i) =>
        new Date(i.expires).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    },
    {
      key: "actions",
      header: "",
      width: "w-[16%]",
      align: "right",
      render: (i) =>
        canInvite ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Resend"
              onClick={() => handleResend(i)}
              disabled={busyId === i.id}
              className="h-8 w-8"
            >
              <RefreshCw className={cn("h-4 w-4", busyId === i.id && "animate-spin")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Cancel"
              onClick={() => handleRevokeInvite(i)}
              disabled={busyId === i.id}
              className="h-8 w-8 text-red-600 hover:text-red-600 dark:text-red-400"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Staff" description="Everyone with access to this admin panel, and who's been invited." />

      {canInvite && (
        <section className={cardSurface}>
          <header className={panelHeader}>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">Invite someone</h2>
              <p className="text-xs text-muted-foreground">Sends an email with a link to set a password and sign in.</p>
            </div>
          </header>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:px-6">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="name@example.org"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>
            <div className="space-y-1.5 sm:w-56">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger id="invite-role" className="h-10 rounded-lg">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={inviting || !inviteEmail.trim() || !inviteRoleId} className="h-10 rounded-lg">
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Send invite
            </Button>
          </form>
        </section>
      )}

      <DataTable
        columns={staffColumns}
        data={staff}
        keyExtractor={(row) => row.id}
        empty={{ icon: Users, title: "No staff yet", description: "Invite someone to get started." }}
      />

      <section className="space-y-3">
        <h2 className="font-sans text-sm font-semibold text-foreground">Pending invitations</h2>
        <DataTable
          columns={inviteColumns}
          data={invites}
          keyExtractor={(i) => i.id}
          empty={{ icon: Mail, title: "No pending invitations", description: "Every invitation sent has been accepted, cancelled, or has expired." }}
        />
      </section>
    </div>
  );
}
