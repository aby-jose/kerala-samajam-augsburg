"use client";

import React, { useState, useEffect } from "react";
import {
  Filter,
  ArrowUpDown,
  QrCode,
  Download,
  MoreVertical,
  Mail,
  Phone,
  Loader2,
  Trash2,
  Users,
  Euro,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, exportToCSV } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getRegistrationsByEvent, toggleCheckIn, deleteRegistration, updateRegistrationAmount } from "@/lib/event-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { SearchInput } from "@/components/admin/ui/search-input";
import { Skeleton, TableSkeleton } from "@/components/admin/ui/skeleton";
import { heroSurface, toolbarChip } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  "checked-in": "Checked in",
  pending: "Pending"
};

const SORT_LABELS: Record<string, string> = {
  newest: "Newest",
  oldest: "Oldest",
  name: "Name",
  event: "Event",
  attendees: "Attendees"
};

const ITEMS_PER_PAGE = 10;

function AdminRegistrationsContent() {
  const confirm = useConfirm();
  const { error: showError } = useToast();
  const searchParams = useSearchParams();
  const eventFilter = searchParams.get("event");

  const [registrations, setRegistrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRegistrations = async () => {
    setIsLoading(true);
    try {
      const data = await getRegistrationsByEvent(eventFilter || undefined);
      setRegistrations(data);
    } catch (error) {
      console.error("Failed to fetch registrations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [eventFilter]);

  const handleToggleCheckIn = async (id: string, currentStatus: boolean) => {
    try {
      await toggleCheckIn(id, !currentStatus);
      fetchRegistrations();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update check-in status.");
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Registration",
      message: "Are you sure you want to remove this attendee? This action cannot be undone.",
      confirmText: "Remove",
      variant: "danger"
    });

    if (isConfirmed) {
      await deleteRegistration(id);
      fetchRegistrations();
    }
  };

  const filteredRegistrations = registrations
    .filter(reg => {
      const matchesSearch = reg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          reg.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          reg.ticketId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === "all" ||
                          (filterStatus === "checked-in" && reg.isCheckedIn) ||
                          (filterStatus === "pending" && !reg.isCheckedIn);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortOrder === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortOrder === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOrder === "name") return a.name.localeCompare(b.name);
      if (sortOrder === "event") return (a.event?.title || "").localeCompare(b.event?.title || "");
      if (sortOrder === "attendees") return b.attendees - a.attendees;
      return 0;
    });

  const totalPages = Math.ceil(filteredRegistrations.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRegistrations = filteredRegistrations.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, sortOrder]);

  const [editingAmount, setEditingAmount] = useState<{ id: string, amount: number } | null>(null);
  const [isUpdatingAmount, setIsUpdatingAmount] = useState(false);

  const handleUpdateAmount = async () => {
    if (!editingAmount) return;
    setIsUpdatingAmount(true);
    try {
      await updateRegistrationAmount(editingAmount.id, editingAmount.amount);
      setEditingAmount(null);
      fetchRegistrations();
    } catch (error) {
      console.error("Failed to update amount:", error);
    } finally {
      setIsUpdatingAmount(false);
    }
  };

  const handleExport = () => {
    const headers = ["Name", "Email", "Phone", "Event", "Ticket ID", "Attendees", "Fee Paid", "Checked In", "Time"];
    const data = filteredRegistrations.map(reg => [
      reg.name,
      reg.email,
      reg.phone || "",
      reg.event?.title || "",
      reg.ticketId,
      reg.attendees,
      reg.pricePaid ? `€${reg.pricePaid.toFixed(2)}` : "€0.00",
      reg.isCheckedIn ? "Yes" : "No",
      reg.isCheckedIn ? new Date(reg.checkInTime!).toLocaleString() : ""
    ]);

    exportToCSV(headers, data, "registrations-report");
  };

  const columns: DataTableColumn<any>[] = [
    {
      key: "attendee",
      header: "Attendee",
      width: "w-[24%]",
      render: (reg) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary/20 to-primary/5 text-xs font-semibold text-primary">
            {reg.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{reg.name}</p>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {reg.email}
              </span>
              {reg.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {reg.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "event",
      header: "Event",
      width: "w-[20%]",
      render: (reg) => <p className="text-sm text-foreground">{reg.event?.title}</p>,
    },
    {
      key: "ticketId",
      header: "Ticket ID",
      width: "w-[14%]",
      render: (reg) => (
        <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">{reg.ticketId}</code>
      ),
    },
    {
      key: "attendees",
      header: "Attendees",
      width: "w-[10%]",
      render: (reg) => <span className="text-sm text-foreground tabular-nums">{reg.attendees}</span>,
    },
    {
      key: "feePaid",
      header: "Fee paid",
      width: "w-[10%]",
      render: (reg) => <span className="text-sm text-foreground tabular-nums">€{(reg.pricePaid || 0).toFixed(2)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "w-[12%]",
      render: (reg) =>
        reg.isCheckedIn ? (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge tone="success">Checked in</StatusBadge>
            <span className="text-xs text-muted-foreground">
              {new Date(reg.checkInTime!).toLocaleTimeString()}
            </span>
          </div>
        ) : (
          <StatusBadge tone="warning">Pending</StatusBadge>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[10%]",
      align: "right",
      render: (reg) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleCheckIn(reg.id, reg.isCheckedIn)}
            className={cn(
              "h-8 rounded-md px-2.5 text-xs font-medium",
              reg.isCheckedIn
                ? "text-muted-foreground hover:text-foreground"
                : "text-primary hover:bg-primary/10 hover:text-primary"
            )}
          >
            {reg.isCheckedIn ? "Undo check-in" : "Check in"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-lg">
              <DropdownMenuItem
                onClick={() => setEditingAmount({ id: reg.id, amount: reg.pricePaid || 0 })}
                className="rounded-md text-sm cursor-pointer"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Adjust amount
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDelete(reg.id)}
                className="rounded-md text-sm cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
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
        title="Registrations"
        description="Manage attendee registrations across all events."
      >
        <Button variant="outline" onClick={handleExport} className="h-9 rounded-lg">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Link href={`/admin/check-in/${eventFilter || 'all'}`}>
          <Button className="h-9 rounded-lg">
            <QrCode className="mr-2 h-4 w-4" />
            Open scanner
          </Button>
        </Link>
      </PageHeader>

      <DataTable
        columns={columns}
        data={paginatedRegistrations}
        keyExtractor={(reg) => reg.id}
        isLoading={isLoading}
        skeletonRows={6}
        empty={{
          icon: Users,
          title: "No registrations found",
          description: "Try adjusting your search or check another event.",
        }}
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredRegistrations.length,
          itemLabel: "registration",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <>
            <SearchInput
              placeholder="Search registrations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
                    <Filter className="mr-2 h-4 w-4" />
                    Status: {STATUS_LABELS[filterStatus]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-lg">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Check-in status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={filterStatus} onValueChange={setFilterStatus}>
                    <DropdownMenuRadioItem value="all" className="rounded-md text-sm">All attendees</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="checked-in" className="rounded-md text-sm">Checked in</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="pending" className="rounded-md text-sm">Pending</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Sort: {SORT_LABELS[sortOrder]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-lg">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Order by</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={sortOrder} onValueChange={setSortOrder}>
                    <DropdownMenuRadioItem value="newest" className="rounded-md text-sm">Recently registered</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest" className="rounded-md text-sm">First registered</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="name" className="rounded-md text-sm">Name (A–Z)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="event" className="rounded-md text-sm">Event name</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="attendees" className="rounded-md text-sm">Most attendees</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      />

      {editingAmount && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditingAmount(null)} />
          <div className={cn(heroSurface, "relative w-full max-w-sm animate-in fade-in zoom-in-95 duration-200")}>
            <div className="border-b border-border px-6 py-4">
              <h3 className="font-sans text-base font-semibold text-foreground">Adjust amount</h3>
              <p className="text-xs text-muted-foreground">Update the fee paid for this attendee.</p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="relative">
                <Euro className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  value={editingAmount.amount}
                  onChange={(e) => setEditingAmount({ ...editingAmount, amount: parseFloat(e.target.value) || 0 })}
                  className="h-9 rounded-lg pl-9"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setEditingAmount(null)} className="h-9 rounded-lg">
                Cancel
              </Button>
              <Button
                onClick={handleUpdateAmount}
                disabled={isUpdatingAmount}
                className="h-9 rounded-lg"
              >
                {isUpdatingAmount ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminRegistrationsPage() {
  return (
    <React.Suspense fallback={
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <TableSkeleton rows={6} />
      </div>
    }>
      <AdminRegistrationsContent />
    </React.Suspense>
  );
}
