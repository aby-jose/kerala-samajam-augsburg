"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  Euro,
  Receipt
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
import { getAllPayments, type PaymentRecord } from "@/lib/payment-actions";
import { formatDate, cn, exportToCSV } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatCard } from "@/components/admin/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/admin/ui/status-badge";
import { SearchInput } from "@/components/admin/ui/search-input";
import { chipTone, toolbarChip } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

const ITEMS_PER_PAGE = 10;

const STATUS_FILTER_LABELS: Record<string, string> = {
  ALL: "All",
  PAID: "Paid",
  PENDING: "Pending",
  FAILED: "Failed",
  EXPIRED: "Expired"
};

const TYPE_FILTER_LABELS: Record<string, string> = {
  ALL: "All types",
  MEMBERSHIP: "Membership",
  EVENT: "Event"
};

function statusTone(status: string): StatusTone {
  if (status === "PAID") return "success";
  if (status === "PENDING") return "warning";
  if (status === "FAILED") return "destructive";
  return "neutral";
}

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PAID" | "PENDING" | "FAILED" | "EXPIRED">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "MEMBERSHIP" | "EVENT">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

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
    pending: payments.filter(p => p.status === "PENDING").length,
    success: payments.filter(p => p.status === "PAID").length,
    expired: payments.filter(p => p.status === "EXPIRED").length
  };

  const handleExport = () => {
    const headers = ["Date", "Description", "User", "Email", "Amount", "Status", "Reference", "Method"];
    const data = filteredPayments.map(p => [
      p.date.toLocaleDateString(),
      p.description,
      p.userName,
      p.userEmail,
      `€${p.amount.toFixed(2)}`,
      p.status,
      p.reference,
      p.method
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
      width: "w-[14%]",
      render: (payment) => (
        <>
          <p className="text-sm font-medium text-foreground tabular-nums">€{payment.amount}</p>
          <p className="text-xs text-muted-foreground">{payment.method}</p>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[12%]",
      render: (payment) => (
        <StatusBadge tone={statusTone(payment.status)}>
          {statusLabel(payment.status)}
        </StatusBadge>
      ),
    },
    {
      key: "expiration",
      header: "Expiration",
      width: "w-[14%]",
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
              {new Date(payment.expiryDate) < new Date() ? "Ended" : "Active"}
            </p>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "initiated",
      header: "Initiated",
      width: "w-[12%]",
      align: "right",
      render: (payment) => (
        <>
          <p className="text-sm text-foreground tabular-nums">{formatDate(payment.date)}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(payment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Track community transactions and payment statuses."
      >
        <Button variant="outline" onClick={handleExport} className="h-9 rounded-lg">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total revenue" value={`€${stats.total.toLocaleString()}`} icon={Euro} tone="emerald" />
        <StatCard label="Successful" value={stats.success} icon={CheckCircle2} tone="primary" />
        <StatCard label="Pending" value={stats.pending} icon={Clock} tone="amber" />
        <StatCard label="Expired" value={stats.expired} icon={XCircle} tone="neutral" />
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
                    <DropdownMenuRadioItem value="PAID" className="rounded-md text-sm">Paid</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="PENDING" className="rounded-md text-sm">Pending</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="FAILED" className="rounded-md text-sm">Failed</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="EXPIRED" className="rounded-md text-sm">Expired</DropdownMenuRadioItem>
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
    </div>
  );
}
