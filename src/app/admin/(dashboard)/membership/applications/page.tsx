"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2,
  Check,
  X,
  AlertCircle,
  User as UserIcon,
  Eye,
  Ban,
  Download,
  Maximize2,
  Minimize2,
  Mail,
  School,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SearchInput } from "@/components/admin/ui/search-input";
import { StatusBadge, type StatusTone } from "@/components/admin/ui/status-badge";
import { heroSurface } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

import {
  getPendingSubscriptions,
  approveMembership,
  rejectMembership,
  recordSubscriptionPayment
} from "@/lib/membership-actions";
import RecordPaymentModal from "@/components/admin/record-payment-modal";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatDate, cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function statusTone(status?: string): StatusTone {
  const s = (status || "").toUpperCase();
  if (["ACTIVE", "APPROVED", "PAID"].includes(s)) return "success";
  if (s.includes("PENDING")) return "warning";
  if (["REJECTED", "EXPIRED", "CANCELLED"].includes(s)) return "destructive";
  return "neutral";
}

function formatStatus(status?: string) {
  if (!status) return "";
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ITEMS_PER_PAGE = 10;

export default function AdminApplicationsPage() {
  const confirm = useConfirm();
  const { success, error } = useToast();
  const [pendingSubs, setPendingSubs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Document Viewer State
  const [viewingSub, setViewingSub] = useState<any | null>(null);
  const [zoom, setZoom] = useState(1);

  // Rejection State
  const [rejectingSub, setRejectingSub] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Payment State
  const [recordingSub, setRecordingSub] = useState<any | null>(null);

  const fetchPending = async () => {
    setIsLoading(true);
    try {
      const data = await getPendingSubscriptions();
      setPendingSubs(data);
    } catch (err) {
      console.error("Failed to fetch pending:", err);
      error("Failed to load applications.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: string) => {
    const isConfirmed = await confirm({
      // Verification and payment are two separate steps now — approving used
      // to activate a cash membership outright, so the wording has to be
      // clear that this only unlocks the payment request.
      title: "Verify student ID",
      message:
        "Confirm that you have checked the ID card. The applicant will be asked to pay; " +
        "their membership starts once you record that payment.",
      confirmText: "Verify & request payment",
      variant: "info"
    });

    if (!isConfirmed) return;

    setIsProcessing(id);
    try {
      await approveMembership(id);
      success("ID verified — payment details sent to the member.");
      fetchPending();
      if (viewingSub?.id === id) setViewingSub(null);
    } catch (err: any) {
      error(err?.message || "Failed to verify the application.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRecordPayment = async (values: {
    receivedOn: string;
    method: "BANK_TRANSFER" | "CASH";
    reference: string;
    note: string;
  }) => {
    if (!recordingSub) return;
    await recordSubscriptionPayment(recordingSub.id, values);
    setRecordingSub(null);
    success("Payment recorded — the membership is now active.");
    fetchPending();
  };

  const handleRejectSubmit = async () => {
    if (!rejectingSub) return;
    if (!rejectionReason.trim()) {
       error("Please provide a reason for rejection.");
       return;
    }

    setIsProcessing(rejectingSub.id);
    try {
      await rejectMembership(rejectingSub.id, rejectionReason);
      success("Application rejected and member notified.");
      setRejectingSub(null);
      setRejectionReason("");
      fetchPending();
      if (viewingSub?.id === rejectingSub.id) setViewingSub(null);
    } catch (err) {
      error("Failed to reject application.");
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredSubs = pendingSubs.filter(sub =>
    sub.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const actionableCount = pendingSubs.filter(s => s.status !== "REJECTED").length;

  const totalPages = Math.ceil(filteredSubs.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSubs = filteredSubs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const columns: DataTableColumn<any>[] = [
    {
      key: "applicant",
      header: "Applicant",
      width: "w-[35%]",
      render: (sub) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xs font-semibold text-primary">
            {sub.user.name?.substring(0, 2).toUpperCase() || "??"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{sub.user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{sub.user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      width: "w-[20%]",
      render: (sub) => (
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium text-foreground">{sub.plan.name}</p>
          {(sub.details as any)?.institution && (
            <p className="truncate text-xs text-muted-foreground">{(sub.details as any).institution}</p>
          )}
          {(sub.details as any)?.studentIdUrl && (
            <button
              onClick={() => { setViewingSub(sub); setZoom(1); }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Eye className="h-3.5 w-3.5" /> View ID document
            </button>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[20%]",
      render: (sub) => (
        <>
          <StatusBadge tone={statusTone(sub.status)}>{formatStatus(sub.status)}</StatusBadge>
          <p className="mt-1 text-xs text-muted-foreground">{formatDate(sub.createdAt)}</p>
        </>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[25%]",
      align: "right",
      render: (sub) => {
        if (sub.status === "REJECTED") {
          return (
            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                <Ban className="h-3.5 w-3.5" /> Rejected
              </span>
              <p className="max-w-[220px] text-right text-xs text-muted-foreground">
                &ldquo;{(sub.details as any)?.rejectionReason || "No reason provided."}&rdquo;
              </p>
            </div>
          );
        }

        // Two distinct steps, and only one of them applies to a given row:
        // an unverified student ID cannot be paid for, and a verified
        // application has nothing left to verify.
        if (sub.status === "AWAITING_PAYMENT") {
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                onClick={() => setRejectingSub(sub)}
                disabled={isProcessing === sub.id}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                aria-label="Reject application"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button onClick={() => setRecordingSub(sub)} className="h-9 rounded-lg">
                <Wallet className="mr-2 h-4 w-4" />
                Record payment
              </Button>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={() => setRejectingSub(sub)}
              disabled={isProcessing === sub.id}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
              aria-label="Reject application"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleApprove(sub.id)}
              disabled={isProcessing === sub.id}
              className="h-9 rounded-lg"
            >
              {isProcessing === sub.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Verify ID
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership applications"
        description="Verify student IDs, then record payments to start membership terms."
      />

      <DataTable
        columns={columns}
        data={paginatedSubs}
        keyExtractor={(sub) => sub.id}
        isLoading={isLoading}
        skeletonRows={6}
        empty={{
          icon: CheckCircle2,
          title: "No applications found",
          description: searchQuery ? "Try a different search term." : "All caught up. New applications will appear here.",
          tone: "emerald",
        }}
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredSubs.length,
          itemLabel: "application",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <>
            <SearchInput
              placeholder="Search applications…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <p className="text-sm text-muted-foreground tabular-nums">
              {actionableCount} awaiting review
            </p>
          </>
        }
      />

      {/* Document viewer modal */}
      <AnimatePresence>
        {viewingSub && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setViewingSub(null)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className={cn(heroSurface, "relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none md:h-auto md:flex-row md:rounded-3xl")}
            >
              {/* Left panel: the image */}
              <div className="relative flex min-h-[400px] flex-1 items-center justify-center overflow-hidden bg-muted">
                <div className="absolute left-4 top-4 z-10 flex gap-1.5">
                  <button
                    onClick={() => setZoom(prev => Math.min(prev + 0.5, 3))}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                    aria-label="Zoom in"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setZoom(prev => Math.max(prev - 0.5, 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                    aria-label="Zoom out"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="absolute right-4 top-4 z-10">
                  <a
                    href={(viewingSub.details as any).studentIdUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </div>

                <motion.img
                  animate={{ scale: zoom }}
                  src={(viewingSub.details as any).studentIdUrl}
                  alt="ID Document"
                  className="max-h-[85vh] max-w-full cursor-zoom-in object-contain transition-transform"
                />
              </div>

              {/* Right panel: context and actions */}
              <div className="flex w-full flex-col justify-between overflow-y-auto border-t border-border bg-card p-6 md:w-96 md:border-l md:border-t-0">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-sans text-base font-semibold text-foreground">Review ID document</h3>
                    <button
                      onClick={() => setViewingSub(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Applicant</p>
                    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-primary">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{viewingSub.user.name}</p>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <p className="truncate text-xs">{viewingSub.user.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 border-t border-border pt-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">Institution</span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <School className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {(viewingSub.details as any).institution}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">Plan</span>
                          <span className="text-xs font-medium text-foreground">{viewingSub.plan.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Verification checklist</span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {[
                        "Is the ID card currently valid?",
                        "Does the name match the applicant?",
                        "Is the photo clear and unedited?"
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-2 pt-6">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => { setRejectingSub(viewingSub); }}
                      variant="outline"
                      className="h-9 flex-1 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      <X className="mr-2 h-4 w-4" /> Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(viewingSub.id)}
                      disabled={isProcessing === viewingSub.id}
                      className="h-9 flex-1 rounded-lg"
                    >
                      {isProcessing === viewingSub.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Verify ID
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    This notifies {viewingSub.user.name} by email and sends them the payment details.
                    Their membership starts when you record the payment.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection modal */}
      <AnimatePresence>
        {rejectingSub && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectingSub(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className={cn(heroSurface, "relative w-full max-w-md overflow-hidden")}
            >
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-sans text-base font-semibold text-foreground">Reject application</h3>
                <p className="text-xs text-muted-foreground">
                  The reason will be emailed to {rejectingSub.user.name}.
                </p>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Reason</label>
                  <Textarea
                    placeholder="e.g. The student ID provided is expired or unclear."
                    className="min-h-[120px] rounded-lg border-input px-3 py-2"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <Button variant="outline" onClick={() => setRejectingSub(null)} className="h-9 rounded-lg">
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleRejectSubmit}
                  disabled={isProcessing === rejectingSub.id || !rejectionReason.trim()}
                  className="h-9 rounded-lg"
                >
                  {isProcessing === rejectingSub.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject application"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Record payment modal */}
      <AnimatePresence>
        {recordingSub && (
          <RecordPaymentModal
            target={{
              id: recordingSub.id,
              description: `${recordingSub.plan.name} membership`,
              who: recordingSub.user.name || recordingSub.user.email || "Member",
              amount: recordingSub.plan.price,
              method: recordingSub.paymentMethod,
              startsTerm: true,
            }}
            onClose={() => setRecordingSub(null)}
            onSubmit={handleRecordPayment}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
