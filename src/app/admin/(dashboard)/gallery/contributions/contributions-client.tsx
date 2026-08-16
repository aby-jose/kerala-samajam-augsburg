"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  User,
  Check,
  X,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { SearchInput } from "@/components/admin/ui/search-input";
import { heroSurface } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

import { getPendingContributions, moderateContribution, bulkModerateContributions } from "@/lib/gallery-actions";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirm } from "@/components/ui/confirm-dialog";

const ITEMS_PER_PAGE = 10;

export default function ContributionsClient() {
  const { success, error, loading, dismiss } = useToast();
  const confirm = useConfirm();
  const [contributions, setContributions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingItem, setViewingItem] = useState<any | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rejectingItem, setRejectingItem] = useState<any | null>(null);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchContributions = async () => {
    setIsLoading(true);
    try {
      const data = await getPendingContributions();
      setContributions(data);
    } catch (err) {
      console.error("Failed to fetch contributions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContributions();
  }, []);

  const handleModerate = async (id: string, status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED") {
      const item = contributions.find(c => c.id === id);
      setRejectingItem(item);
      return;
    }

    const confirmed = await confirm({
      title: "Approve Contribution",
      message: "This will add the media to the public gallery album immediately.",
      confirmText: "Approve",
      variant: "info"
    });

    if (!confirmed) return;

    setIsProcessing(id);
    try {
      await moderateContribution(id, "APPROVED", "");
      success("Contribution approved and published.");
      setContributions(contributions.filter(c => c.id !== id));
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } catch (err: any) {
      error(err.message || "Action failed.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRejectSubmit = async () => {
    if ((!rejectingItem && !isBulkRejecting) || !rejectionReason.trim()) return;

    const idsToModerate = isBulkRejecting ? selectedIds : [rejectingItem!.id];
    const targetId = isBulkRejecting ? "bulk" : rejectingItem!.id;

    setIsProcessing(targetId);
    const toastId = loading(`Processing rejection...`);
    try {
      if (isBulkRejecting) {
        await bulkModerateContributions(selectedIds, "REJECTED", rejectionReason);
        success(`Rejected ${selectedIds.length} contributions.`);
        setContributions(contributions.filter(c => !selectedIds.includes(c.id)));
        setSelectedIds([]);
      } else {
        await moderateContribution(rejectingItem!.id, "REJECTED", rejectionReason);
        success("Contribution rejected.");
        setContributions(contributions.filter(c => c.id !== rejectingItem!.id));
        setSelectedIds(selectedIds.filter(id => id !== rejectingItem!.id));
      }

      setRejectingItem(null);
      setIsBulkRejecting(false);
      setViewingItem(null);
      setRejectionReason("");
    } catch (err: any) {
      error(err.message || "Action failed.");
    } finally {
      setIsProcessing(null);
      dismiss(toastId);
    }
  };

  const handleBulkModerate = async (status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED") {
      setIsBulkRejecting(true);
      return;
    }

    const confirmed = await confirm({
      title: `Bulk ${status.toLowerCase()}`,
      message: `Are you sure you want to approve ${selectedIds.length} contributions?`,
      confirmText: `Confirm Approval`,
      variant: "info"
    });

    if (!confirmed) return;

    const toastId = loading(`Processing ${selectedIds.length} items...`);
    try {
      await bulkModerateContributions(selectedIds, status);
      success(`Successfully approved ${selectedIds.length} items.`);
      setContributions(contributions.filter(c => !selectedIds.includes(c.id)));
      setSelectedIds([]);
    } catch (err: any) {
      error("Bulk action failed.");
    } finally {
      dismiss(toastId);
    }
  };

  const filteredContributions = contributions.filter(c =>
    c.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.caption?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredContributions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredContributions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map(c => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const columns: DataTableColumn<any>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={selectedIds.length === paginatedItems.length && paginatedItems.length > 0}
          onChange={toggleSelectAll}
          className="h-4 w-4 rounded border-border"
        />
      ),
      width: "w-12",
      render: (item) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={() => toggleSelectOne(item.id)}
          className="h-4 w-4 rounded border-border"
        />
      ),
    },
    {
      key: "media",
      header: "Media",
      width: "w-[16%]",
      render: (item) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setViewingItem(item); setZoom(1); }}
            className="group/preview relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-border bg-muted"
            aria-label="Preview media"
            title="Preview"
          >
            {item.type === "IMAGE" ? (
              <img src={item.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <VideoIcon className="h-4 w-4" />
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover/preview:opacity-100">
              <Maximize2 className="h-3.5 w-3.5 text-white" />
            </span>
          </button>
          <div className="min-w-0 max-w-[220px]">
            <p className="truncate text-sm font-medium text-foreground">{item.caption || "Untitled"}</p>
            <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "contributor",
      header: "Contributor",
      width: "w-[24%]",
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{item.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{item.user.email}</p>
        </div>
      ),
    },
    {
      key: "album",
      header: "Album",
      width: "w-[22%]",
      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.album.title}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[14%]",
      render: () => <StatusBadge tone="warning">Pending</StatusBadge>,
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[24%]",
      align: "right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleModerate(item.id, "APPROVED")}
            disabled={isProcessing === item.id}
            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
            aria-label="Approve"
            title="Approve"
          >
            {isProcessing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleModerate(item.id, "REJECTED")}
            disabled={isProcessing === item.id}
            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            aria-label="Reject"
            title="Reject"
          >
            {isProcessing === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contributions"
        description="Review community submissions before they are published."
      >
        <StatusBadge tone="warning">{contributions.length} pending</StatusBadge>
      </PageHeader>

      <DataTable
        columns={columns}
        data={paginatedItems}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        skeletonRows={6}
        empty={{
          icon: ImageIcon,
          title: "All caught up",
          description: "No pending contributions to review.",
        }}
        pagination={{
          page: currentPage,
          totalPages: totalPages || 1,
          totalItems: filteredContributions.length,
          itemLabel: "pending contribution",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <>
            <SearchInput
              placeholder="Search contributions…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-72"
            />
            <AnimatePresence>
              {selectedIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center gap-2"
                >
                  <Button
                    onClick={() => handleBulkModerate("APPROVED")}
                    variant="outline"
                    className="h-9 rounded-lg text-emerald-600 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve ({selectedIds.length})
                  </Button>
                  <Button
                    onClick={() => handleBulkModerate("REJECTED")}
                    variant="outline"
                    className="h-9 rounded-lg text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Reject ({selectedIds.length})
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        }
      />

      {/* Media viewer modal */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setViewingItem(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              className={cn(heroSurface, "relative flex h-[600px] w-full max-w-4xl flex-col overflow-hidden md:flex-row")}
            >
              {/* Media */}
              <div className="flex flex-1 items-center justify-center overflow-hidden bg-muted/50 p-4">
                {viewingItem.type === "IMAGE" ? (
                  <img
                    src={viewingItem.url}
                    alt="Contribution preview"
                    className="max-h-full max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <video
                    src={viewingItem.url}
                    controls
                    autoPlay
                    className="max-h-full max-w-full rounded-lg"
                  />
                )}
              </div>

              {/* Details */}
              <div className="flex w-full flex-col overflow-y-auto border-t border-border md:w-80 md:border-l md:border-t-0">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                  <h3 className="font-sans text-base font-semibold text-foreground">Review media</h3>
                  <button
                    onClick={() => setViewingItem(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-4 px-6 py-5">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Contributor</p>
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{viewingItem.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{viewingItem.user.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Album</p>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
                      <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm text-foreground">{viewingItem.album.title}</span>
                    </div>
                  </div>

                  {viewingItem.caption && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Caption</p>
                      <p className="rounded-lg border border-border bg-muted/50 p-3 text-sm leading-relaxed text-muted-foreground">
                        &ldquo;{viewingItem.caption}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-border px-6 py-4">
                  <Button
                    onClick={() => { handleModerate(viewingItem.id, "APPROVED"); setViewingItem(null); }}
                    disabled={isProcessing === viewingItem.id}
                    className="h-9 w-full rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {isProcessing === viewingItem.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Approve
                  </Button>
                  <Button
                    onClick={() => { setRejectingItem(viewingItem); }}
                    disabled={isProcessing === viewingItem.id}
                    variant="outline"
                    className="h-9 w-full rounded-lg text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
                  >
                    <X className="mr-2 h-4 w-4" /> Reject
                  </Button>
                  <p className="pt-1 text-center text-xs text-muted-foreground">
                    The contributor will be notified by email.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection modal */}
      <AnimatePresence>
        {(rejectingItem || isBulkRejecting) && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => { setRejectingItem(null); setIsBulkRejecting(false); }}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className={cn(heroSurface, "relative w-full max-w-md overflow-hidden")}
            >
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-sans text-base font-semibold text-foreground">
                  Reject {isBulkRejecting ? "selected contributions" : "contribution"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isBulkRejecting
                    ? `Please provide a reason for rejecting the ${selectedIds.length} selected contributions. This will be sent to each contributor via email.`
                    : <>Please provide a reason for rejecting this contribution from <b>{rejectingItem?.user.name}</b>. This will be sent to them via email.</>
                  }
                </p>
              </div>

              <div className="space-y-2 px-6 py-5">
                <label className="text-sm font-medium text-foreground">Reason</label>
                <Textarea
                  placeholder="e.g. This media does not meet our community quality standards."
                  className="min-h-[120px] rounded-lg text-sm"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <Button
                  variant="outline"
                  onClick={() => { setRejectingItem(null); setIsBulkRejecting(false); }}
                  className="h-9 rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRejectSubmit}
                  disabled={(isProcessing === "bulk" || (rejectingItem && isProcessing === rejectingItem.id)) || !rejectionReason.trim()}
                  className="h-9 rounded-lg"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
