"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Users,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  Undo2,
  Calendar,
  Euro,
  Receipt,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import {
  getAllPayments,
  recordRegistrationPayment,
  revertRegistrationPayment,
  type PaymentRecord
} from "@/lib/payment-actions";
import { recordSubscriptionPayment, revertSubscriptionPayment } from "@/lib/membership-actions";
import RecordPaymentModal, { type RecordPaymentTarget } from "@/components/admin/record-payment-modal";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatDate, cn, exportToCSV } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatCard } from "@/components/admin/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/admin/ui/status-badge";
import { SearchInput } from "@/components/admin/ui/search-input";
import { chipTone, toolbarChip } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

const ITEMS_PER_PAGE = 10;

/**
 * There is no gateway, so there is no FAILED and no EXPIRED session: a payment
 * has either been recorded or it has not.
 */
const STATUS_FILTER_LABELS: Record<string, string> = {
  ALL: "All",
  PAID: "Recorded",
  PENDING: "Outstanding"
};

const TYPE_FILTER_LABELS: Record<string, string> = {
  ALL: "All types",
  MEMBERSHIP: "Membership",
  EVENT: "Event"
};

function statusTone(status: string): StatusTone {
  if (status === "PAID") return "success";
  if (status === "PENDING") return "warning";
  return "neutral";
}

function statusLabel(status: string) {
  return status === "PAID" ? "Recorded" : "Outstanding";
}

function methodLabel(method: string) {
  if (method === "BANK_TRANSFER") return "Bank transfer";
  if (method === "CASH") return "Cash";
  return method;
}

export default function PaymentsClient() {
  const confirm = useConfirm();
  const { success, error } = useToast();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "MEMBERSHIP" | "EVENT">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [recording, setRecording] = useState<PaymentRecord | null>(null);
  const [isReverting, setIsReverting] = useState<string | null>(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const data = await getAllPayments();
      setPayments(data);
    } catch (err) {
      console.error("Failed to fetch payments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const filteredPayments = payments
    .filter(payment => {
      const matchesSearch =
        payment.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === "ALL" || payment.status === statusFilter;
      const matchesType = typeFilter === "ALL" || payment.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "date") {
        return sortOrder === "desc"
          ? b.date.getTime() - a.date.getTime()
          : a.date.getTime() - b.date.getTime();
      } else {
        return sortOrder === "desc" ? b.amount - a.amount : a.amount - b.amount;
      }
    });

  const totalPages = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, typeFilter]);

  const stats = {
    total: payments.reduce((acc, p) => p.status === "PAID" ? acc + p.amount : acc, 0),
    // What is still owed, which is the number that matters when nobody is
    // collecting money automatically.
    outstanding: payments.reduce((acc, p) => p.status === "PAID" ? acc : acc + p.amount, 0),
    pending: payments.filter(p => p.status === "PENDING").length,
    success: payments.filter(p => p.status === "PAID").length,
  };

  const handleRecord = async (values: {
    receivedOn: string;
    method: "BANK_TRANSFER" | "CASH";
    reference: string;
    note: string;
  }) => {
    if (!recording) return;

    if (recording.type === "MEMBERSHIP") {
      await recordSubscriptionPayment(recording.id, values);
    } else {
      await recordRegistrationPayment(recording.id, {
        receivedOn: values.receivedOn,
        method: values.method,
        reference: values.reference,
      });
    }

    setRecording(null);
    success(
      recording.type === "MEMBERSHIP"
        ? "Payment recorded — the membership is now active."
        : "Payment recorded."
    );
    fetchPayments();
  };

  const handleRevert = async (payment: PaymentRecord) => {
    const isConfirmed = await confirm({
      title: "Mark as unpaid",
      message:
        payment.type === "MEMBERSHIP"
          ? "This undoes the recorded payment and ends the membership term. The member goes back to awaiting payment."
          : "This undoes the recorded payment for this registration.",
      confirmText: "Mark unpaid",
      variant: "danger",
    });

    if (!isConfirmed) return;

    setIsReverting(payment.id);
    try {
      if (payment.type === "MEMBERSHIP") {
        await revertSubscriptionPayment(payment.id);
      } else {
        await revertRegistrationPayment(payment.id);
      }
      success("Payment reverted.");
      fetchPayments();
    } catch (err: any) {
      error(err?.message || "Could not revert the payment.");
    } finally {
      setIsReverting(null);
    }
  };

  const handleExport = () => {
    const headers = [
      "Applied", "Received", "Description", "User", "Email",
      "Amount", "Status", "Reference", "Method", "Term ends"
    ];
    const data = filteredPayments.map(p => [
      p.date.toLocaleDateString(),
      p.paidAt ? p.paidAt.toLocaleDateString() : "",
      p.description,
      p.userName,
      p.userEmail,
      `€${p.amount.toFixed(2)}`,
      statusLabel(p.status),
      p.reference,
      methodLabel(p.method),
      p.expiryDate ? p.expiryDate.toLocaleDateString() : ""
    ]);

    exportToCSV(headers, data, "payment-records");
  };

  const columns: DataTableColumn<PaymentRecord>[] = [
    {
      key: "transaction",
      header: "Transaction",
      width: "w-[28%]",
      render: (payment) => (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              chipTone(payment.type === "MEMBERSHIP" ? "blue" : "violet")
            )}
          >
            {payment.type === "MEMBERSHIP" ? <Users className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{payment.description}</p>
            <p className="text-xs text-muted-foreground">{payment.reference.slice(-12)}</p>
          </div>
        </div>
      ),
    },
    {
      key: "member",
      header: "Member",
      width: "w-[20%]",
      cellClassName: "min-w-0",
      render: (payment) => (
        <>
          <p className="truncate text-sm text-foreground">{payment.userName}</p>
          <p className="truncate text-xs text-muted-foreground">{payment.userEmail}</p>
        </>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      width: "w-[12%]",
      render: (payment) => (
        <>
          <p className="text-sm font-medium text-foreground tabular-nums">€{payment.amount.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{methodLabel(payment.method)}</p>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[12%]",
      render: (payment) => (
        <>
          <StatusBadge tone={statusTone(payment.status)}>
            {statusLabel(payment.status)}
          </StatusBadge>
          {payment.paidAt && (
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {formatDate(payment.paidAt)}
            </p>
          )}
        </>
      ),
    },
    {
      key: "term",
      header: "Term ends",
      width: "w-[12%]",
      render: (payment) =>
        payment.expiryDate ? (
          <div>
            <p className="text-sm text-foreground tabular-nums">{formatDate(payment.expiryDate)}</p>
            <p
              className={cn(
                "text-xs",
                new Date(payment.expiryDate) < new Date()
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {new Date(payment.expiryDate) < new Date() ? "Ended" : "Running"}
            </p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[14%]",
      align: "right",
      render: (payment) => {
        if (payment.status === "PAID") {
          return (
            <Button
              variant="ghost"
              onClick={() => handleRevert(payment)}
              disabled={isReverting === payment.id}
              className="h-8 rounded-md px-2 text-xs text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
            >
              <Undo2 className="mr-1.5 h-3.5 w-3.5" />
              Mark unpaid
            </Button>
          );
        }

        if (!payment.canRecord) {
          return (
            <span className="text-xs text-muted-foreground">
              {payment.blockedReason || "—"}
            </span>
          );
        }

        return (
          <Button onClick={() => setRecording(payment)} className="h-8 rounded-lg px-3 text-xs">
            <Wallet className="mr-1.5 h-3.5 w-3.5" />
            Record
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Record membership and event payments as they are received."
      >
        <Button variant="outline" onClick={handleExport} className="h-9 rounded-lg">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Recorded revenue" value={`€${stats.total.toLocaleString()}`} icon={Euro} tone="emerald" />
        <StatCard label="Outstanding" value={`€${stats.outstanding.toLocaleString()}`} icon={Wallet} tone="amber" />
        <StatCard label="Payments recorded" value={stats.success} icon={CheckCircle2} tone="primary" />
        <StatCard label="Awaiting payment" value={stats.pending} icon={Clock} tone="neutral" />
      </div>

      <DataTable
        columns={columns}
        data={paginatedPayments}
        keyExtractor={(payment) => payment.id}
        isLoading={isLoading}
        skeletonRows={8}
        empty={{
          icon: Receipt,
          title: "No payments found",
          description: "Try adjusting your search or filters.",
        }}
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredPayments.length,
          itemLabel: "record",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <>
            <SearchInput
              placeholder="Search payments…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
                    <Filter className="mr-2 h-4 w-4" />
                    Status: {STATUS_FILTER_LABELS[statusFilter]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-lg">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Payment status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                    <DropdownMenuRadioItem value="ALL" className="rounded-md text-sm">All statuses</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="PAID" className="rounded-md text-sm">Recorded</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="PENDING" className="rounded-md text-sm">Outstanding</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
                    Type: {TYPE_FILTER_LABELS[typeFilter]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-lg">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Payment type</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={typeFilter} onValueChange={(value) => setTypeFilter(value as any)}>
                    <DropdownMenuRadioItem value="ALL" className="rounded-md text-sm">All types</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="MEMBERSHIP" className="rounded-md text-sm">Membership</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="EVENT" className="rounded-md text-sm">Event</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      />

      <AnimatePresence>
        {recording && (
          <RecordPaymentModal
            target={{
              id: recording.id,
              description: recording.description,
              who: recording.userName,
              amount: recording.amount,
              method: recording.method,
              startsTerm: recording.type === "MEMBERSHIP",
            } satisfies RecordPaymentTarget}
            onClose={() => setRecording(null)}
            onSubmit={handleRecord}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
