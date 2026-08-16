"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2,
  Users,
  ShieldCheck,
  User as UserIcon,
  MoreVertical,
  Filter,
  Download,
  Eye,
  Pencil,
  X,
  UserX,
  UserCheck,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SearchInput } from "@/components/admin/ui/search-input";
import { StatusBadge, type StatusTone } from "@/components/admin/ui/status-badge";
import { heroSurface, toolbarChip } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

import {
  cancelSubscriptionAsAdmin,
  getAllMembers,
  suspendUser,
  updateMemberDetails,
} from "@/lib/membership-actions";
import { displayStatus, isTermRunning } from "@/lib/membership-term";
import { useToast } from "@/components/ui/toast";
import { formatDate, cn, exportToCSV } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirm } from "@/components/ui/confirm-dialog";

const ITEMS_PER_PAGE = 10;

const FILTER_LABELS: Record<string, string> = {
  ALL: "All",
  ACTIVE: "Active plan",
  PENDING: "Awaiting payment",
  NONE: "No plan",
};

function statusTone(status?: string): StatusTone {
  const s = (status || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "PAID"].includes(s)) return "success";
  if (s.includes("PENDING")) return "warning";
  if (["REJECTED", "EXPIRED", "CANCELLED", "SUSPENDED"].includes(s)) return "destructive";
  return "neutral";
}

function formatStatus(status?: string) {
  if (!status) return "";
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function MembersClient() {
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "NONE">("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    zip: string;
    dob: string;
    occupation: string;
    bio: string;
    // Mirrors the roles the server will accept — anything else is rejected there.
    role: "MEMBER" | "ADMIN";
  }>({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
    dob: "",
    occupation: "",
    bio: "",
    role: "MEMBER"
  });

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const data = await getAllMembers();
      setMembers(data);
    } catch (err) {
      console.error("Failed to fetch members:", err);
      error("Failed to load members list.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  /**
   * End a running membership term early.
   *
   * Distinct from suspending the account: this closes the membership and
   * leaves the person able to sign in, see their history and apply again.
   */
  const handleCancelMembership = async (subscription: any) => {
    const confirmed = await confirm({
      title: "End membership early",
      message:
        `End the ${subscription.plan?.name || "current"} membership now? ` +
        "The term is closed today and the member keeps their account and history. " +
        "This cannot be undone — they would need to apply again.",
      confirmText: "End membership",
      variant: "danger",
    });

    if (!confirmed) return;

    setCancellingId(subscription.id);
    try {
      await cancelSubscriptionAsAdmin(subscription.id);
      success("Membership ended.");
      await fetchMembers();
      setSelectedMember(null);
    } catch (err) {
      error(err instanceof Error ? err.message : "Could not end the membership.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleSuspend = async (member: any) => {
    const isSuspended = member.status === "SUSPENDED";
    const confirmed = await confirm({
      title: isSuspended ? "Reactivate account" : "Suspend account",
      message: isSuspended
        ? `Reactivate ${member.name}'s account?`
        : `Suspend ${member.name}'s account? They will lose access to member features immediately.`,
      confirmText: isSuspended ? "Reactivate" : "Suspend",
      variant: isSuspended ? "info" : "danger"
    });

    if (!confirmed) return;

    setIsProcessing(member.id);
    try {
      const res = await suspendUser(member.id, member.status);
      if ("error" in res && res.error) {
        error(res.error);
        return;
      }
      success(isSuspended ? "Account reactivated." : "Account suspended.");
      setMembers(members.map(m => m.id === member.id ? { ...m, status: res.status } : m));
      if (selectedMember?.id === member.id) setSelectedMember({ ...selectedMember, status: res.status });
    } catch (err) {
      error("Action failed.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleEditOpen = (member: any) => {
    setEditingMember(member);
    setEditForm({
      name: member.name || "",
      email: member.email || "",
      phone: member.phone || "",
      address: member.address || "",
      city: member.city || "",
      zip: member.zip || "",
      dob: member.dob ? new Date(member.dob).toISOString().split('T')[0] : "",
      occupation: member.occupation || "",
      bio: member.bio || "",
      role: member.role === "ADMIN" ? "ADMIN" : "MEMBER"
    });
  };

  const handleEditSave = async () => {
    if (!editingMember) return;
    setIsProcessing(editingMember.id);
    try {
      const result = await updateMemberDetails(editingMember.id, editForm);
      if ("error" in result && result.error) {
        error(result.error);
        return;
      }
      success("Member details updated.");
      // Refresh to get full updated data or update local state manually
      await fetchMembers();
      setEditingMember(null);
    } catch (err: any) {
      error(err.message || "Failed to update details.");
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch =
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === "ALL") return matchesSearch;
    if (filter === "ACTIVE") return matchesSearch && isTermRunning(member.subscription);
    if (filter === "PENDING") return matchesSearch && ["AWAITING_PAYMENT", "PENDING_VERIFICATION"].includes(member.subscription?.status || "");
    if (filter === "NONE") return matchesSearch && !member.subscription;
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMembers = filteredMembers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filter]);

  const handleExport = () => {
    const headers = ["Name", "Email", "Phone", "Status", "Membership", "Expiry Date", "Role"];
    const data = filteredMembers.map(m => [
      m.name || "Anonymous",
      m.email,
      m.phone || "",
      m.status,
      m.subscription?.plan?.name || "None",
      m.subscription?.endDate ? new Date(m.subscription.endDate).toLocaleDateString() : "",
      m.role
    ]);

    exportToCSV(headers, data, "member-registry");
  };

  const columns: DataTableColumn<any>[] = [
    {
      key: "member",
      header: "Member",
      width: "w-[36%]",
      render: (member) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xs font-semibold text-primary">
            {member.image ? (
              <img src={member.image} alt="" className="h-full w-full object-cover" />
            ) : (
              member.name?.substring(0, 2).toUpperCase() || "??"
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{member.name || "Anonymous user"}</p>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "membership",
      header: "Membership",
      width: "w-[24%]",
      render: (member) =>
        member.subscription ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{member.subscription.plan.name}</p>
            {/*
              An unpaid application has no term yet, so there is no date to
              print — showing "Expires —" there implied a membership that had
              simply lost its end date.
            */}
            <p className="truncate text-xs text-muted-foreground">
              {member.subscription.endDate
                ? `${formatDate(member.subscription.startDate)} – ${formatDate(member.subscription.endDate)}`
                : formatStatus(member.subscription.status)}
            </p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No active plan</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[16%]",
      render: (member) => <StatusBadge tone={statusTone(member.status)}>{formatStatus(member.status)}</StatusBadge>,
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[24%]",
      align: "right",
      render: (member) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            onClick={() => setSelectedMember(member)}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="View details"
          >
            <Eye className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                aria-label="More actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-lg">
              <DropdownMenuItem
                onClick={() => handleEditOpen(member)}
                className="rounded-md text-sm"
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleSuspend(member)}
                className={cn(
                  "rounded-md text-sm",
                  member.status === "SUSPENDED"
                    ? "text-emerald-600 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                    : "text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                )}
              >
                {member.status === "SUSPENDED" ? <UserCheck className="mr-2 h-4 w-4" /> : <UserX className="mr-2 h-4 w-4" />}
                {member.status === "SUSPENDED" ? "Reactivate account" : "Suspend account"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Manage member accounts and membership status."
      >
        <Button variant="outline" onClick={handleExport} className="h-9 rounded-lg">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={paginatedMembers}
        keyExtractor={(member) => member.id}
        isLoading={isLoading}
        skeletonRows={8}
        empty={{
          icon: Users,
          title: "No members found",
          description: "Try adjusting your search or filters.",
          tone: "blue",
        }}
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredMembers.length,
          itemLabel: "member",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <>
            <SearchInput
              placeholder="Search members…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
                  <Filter className="mr-2 h-4 w-4" />
                  Plan: {FILTER_LABELS[filter]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 rounded-lg">
                <DropdownMenuRadioGroup value={filter} onValueChange={(v) => setFilter(v as any)}>
                  {(["ALL", "ACTIVE", "PENDING", "NONE"] as const).map((f) => (
                    <DropdownMenuRadioItem key={f} value={f} className="rounded-md text-sm">
                      {FILTER_LABELS[f]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Member details modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedMember(null)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className={cn(heroSurface, "relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden")}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-primary">
                    {selectedMember.image ? (
                      <img src={selectedMember.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-sans text-base font-semibold text-foreground">{selectedMember.name || "Anonymous user"}</h3>
                    <p className="truncate text-xs text-muted-foreground">{selectedMember.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Account status</p>
                    <div className="flex items-center gap-3">
                      <StatusBadge tone={statusTone(selectedMember.status)}>{formatStatus(selectedMember.status)}</StatusBadge>
                      {selectedMember.emailVerified && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-3.5 w-3.5" /> Email verified
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Joined</p>
                    <p className="text-sm font-medium text-foreground">{formatDate(selectedMember.joinedAt)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-sans text-sm font-semibold text-foreground">Subscription</h4>
                  {selectedMember.subscription ? (
                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">{selectedMember.subscription.plan.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedMember.subscription.endDate
                              ? `${formatDate(selectedMember.subscription.startDate)} – ${formatDate(selectedMember.subscription.endDate)}`
                              : "Term starts when the payment is recorded"}
                          </p>
                        </div>
                        <StatusBadge tone={statusTone(displayStatus(selectedMember.subscription) || undefined)}>
                          {formatStatus(displayStatus(selectedMember.subscription) || undefined)}
                        </StatusBadge>
                      </div>

                      {/*
                        Ending a term early — a member moving away, or one who
                        asked to stop. Suspending the account was the only
                        thing an admin could reach before, and that blocks
                        sign-in entirely, which is a different thing.
                      */}
                      {isTermRunning(selectedMember.subscription) && (
                        <div className="flex justify-end border-t border-border pt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelMembership(selectedMember.subscription)}
                            disabled={cancellingId === selectedMember.subscription.id}
                            className="h-8 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                          >
                            {cancellingId === selectedMember.subscription.id
                              ? "Cancelling…"
                              : "End membership early"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center">
                      <p className="text-sm text-muted-foreground">No active membership</p>
                    </div>
                  )}
                </div>

                {(selectedMember.subscription?.details?.institution || selectedMember.subscription?.details?.familyMembers) && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {selectedMember.subscription?.details?.institution && (
                      <div className="space-y-3">
                        <h4 className="font-sans text-sm font-semibold text-foreground">Institution</h4>
                        <p className="text-sm text-muted-foreground">{selectedMember.subscription.details.institution}</p>
                      </div>
                    )}
                    {selectedMember.subscription?.details?.familyMembers && (
                      <div className="space-y-3">
                        <h4 className="font-sans text-sm font-semibold text-foreground">Family members</h4>
                        <div className="space-y-2">
                          {selectedMember.subscription.details.familyMembers.map((m: any, i: number) => (
                            <div key={i} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                              <span className="text-sm font-medium text-foreground">{m.name}</span>
                              <span className="text-xs text-muted-foreground">{m.relation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="font-sans text-sm font-semibold text-foreground">Billing history</h4>
                  <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                    {selectedMember.allSubscriptions?.map((sub: any) => (
                      <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{sub.plan.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {sub.startDate
                              ? `Paid ${formatDate(sub.startDate)}`
                              : `Applied ${formatDate(sub.createdAt)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground tabular-nums">€{sub.plan.price}</p>
                          <p className="text-xs text-muted-foreground">{formatStatus(displayStatus(sub) || undefined)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit details modal */}
      <AnimatePresence>
        {editingMember && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingMember(null)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className={cn(heroSurface, "relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden")}
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div>
                  <h3 className="font-sans text-base font-semibold text-foreground">Edit member</h3>
                  <p className="text-xs text-muted-foreground">Update account and profile details.</p>
                </div>
                <button
                  onClick={() => setEditingMember(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Full name</label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Phone</label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Date of birth</label>
                    <Input
                      type="date"
                      value={editForm.dob}
                      onChange={(e) => setEditForm({...editForm, dob: e.target.value})}
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Address</label>
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    className="h-9 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">City</label>
                    <Input
                      value={editForm.city}
                      onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">ZIP code</label>
                    <Input
                      value={editForm.zip}
                      onChange={(e) => setEditForm({...editForm, zip: e.target.value})}
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Occupation</label>
                    <Input
                      value={editForm.occupation}
                      onChange={(e) => setEditForm({...editForm, occupation: e.target.value})}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Role</label>
                    {/* Read-only here on purpose — admin access is granted and
                        revoked through /admin/staff (staff.manage), which
                        applies the last-Super-Admin lockout rule. This modal
                        can no longer write `role` at all. */}
                    <div className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-muted/30 px-3 text-sm text-muted-foreground">
                      <span>{editForm.role === "ADMIN" ? "Admin" : "Member"}</span>
                      <a
                        href="/admin/staff"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Manage in Staff →
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                    className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                    placeholder="Brief background about the member…"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => setEditingMember(null)} className="h-9 rounded-lg">
                  Cancel
                </Button>
                <Button
                  onClick={handleEditSave}
                  disabled={isProcessing === editingMember.id}
                  className="h-9 rounded-lg"
                >
                  {isProcessing === editingMember.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save changes
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
