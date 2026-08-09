"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Trash2,
  Archive,
  X,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getContactMessages,
  updateMessageStatus,
  deleteMessage
} from "@/lib/contact-actions";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { SearchInput } from "@/components/admin/ui/search-input";
import { toolbarChip } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";

const ITEMS_PER_PAGE = 10;

export default function AdminInquiriesPage() {
  const { success, error } = useToast();
  const confirm = useConfirm();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const data = await getContactMessages();
      setMessages(data);
    } catch (err) {
      error("Failed to fetch messages.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleStatusUpdate = async (id: string, status: any) => {
    try {
      await updateMessageStatus(id, status);
      setMessages(messages.map(m => m.id === id ? { ...m, status } : m));
      if (selectedMessage?.id === id) setSelectedMessage({ ...selectedMessage, status });
      success(`Message marked as ${status.toLowerCase()}.`);
    } catch (err) {
      error("Failed to update status.");
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Message",
      message: "This inquiry will be permanently removed. Are you sure?",
      confirmText: "Delete",
      variant: "danger"
    });

    if (isConfirmed) {
      try {
        await deleteMessage(id);
        setMessages(messages.filter(m => m.id !== id));
        if (selectedMessage?.id === id) setSelectedMessage(null);
        success("Message deleted.");
      } catch (err) {
        error("Failed to delete message.");
      }
    }
  };

  const filteredMessages = messages.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subject.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = filterStatus === "ALL" || m.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredMessages.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedMessages = filteredMessages.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  const columns: DataTableColumn<any>[] = [
    {
      key: "status",
      header: "Status",
      width: "w-[12%]",
      render: (msg) => (
        msg.status === "UNREAD" ? (
          <StatusBadge tone="info">Unread</StatusBadge>
        ) : msg.status === "ARCHIVED" ? (
          <StatusBadge tone="neutral">Archived</StatusBadge>
        ) : (
          <StatusBadge tone="success">Read</StatusBadge>
        )
      ),
    },
    {
      key: "sender",
      header: "Sender",
      width: "w-[26%]",
      render: (msg) => (
        <div className="min-w-0">
          <p className={cn(
            "truncate text-sm text-foreground leading-tight",
            msg.status === "UNREAD" ? "font-semibold" : "font-medium"
          )}>
            {msg.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{msg.email}</p>
        </div>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      width: "w-[35%]",
      render: (msg) => (
        <p className="line-clamp-1 max-w-xs text-sm text-foreground">{msg.subject}</p>
      ),
    },
    {
      key: "date",
      header: "Date",
      width: "w-[15%]",
      render: (msg) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(msg.createdAt), 'MMM dd, HH:mm')}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[12%]",
      align: "right",
      render: (msg) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleStatusUpdate(msg.id, msg.status === "ARCHIVED" ? "READ" : "ARCHIVED")}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Archive message"
          >
            <Archive className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(msg.id)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            aria-label="Delete message"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inquiries"
        description="Manage and respond to contact messages."
      />

      <DataTable
        columns={columns}
        data={paginatedMessages}
        keyExtractor={(msg) => msg.id}
        isLoading={isLoading}
        skeletonRows={6}
        onRowClick={(msg) => {
          setSelectedMessage(msg);
          if (msg.status === "UNREAD") handleStatusUpdate(msg.id, "READ");
        }}
        empty={{
          icon: Mail,
          title: "No inquiries found",
          description: "Messages sent through the contact form will appear here.",
        }}
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredMessages.length,
          itemLabel: "message",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <>
            <SearchInput
              placeholder="Search inquiries…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <Button
              variant="outline"
              onClick={() => setFilterStatus(filterStatus === "UNREAD" ? "ALL" : "UNREAD")}
              className={cn(
                "h-9 rounded-lg",
                filterStatus === "UNREAD"
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                  : toolbarChip
              )}
            >
              <Filter className="mr-2 h-4 w-4" />
              {filterStatus === "UNREAD" ? "Showing unread" : "Filter unread"}
            </Button>
          </>
        }
      />

      {/* Message View Drawer */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex h-screen w-full max-w-xl flex-col rounded-l-3xl border-l border-border bg-card shadow-[0_2px_4px_rgba(0,0,0,0.04),0_24px_48px_-24px_rgba(0,0,0,0.24)]">
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedMessage(null)}
                  className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <h2 className="font-sans text-base font-semibold text-foreground">Inquiry details</h2>
                  <p className="truncate text-xs text-muted-foreground">Message from {selectedMessage.name}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate(selectedMessage.id, "ARCHIVED")}
                  className="h-9 rounded-lg"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(selectedMessage.id)}
                  className="h-9 rounded-lg"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 border-b border-border pb-5 sm:grid-cols-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Sender</p>
                  <p className="text-sm font-medium text-foreground">{selectedMessage.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedMessage.email}</p>
                </div>
                <div className="space-y-0.5 sm:text-right">
                  <p className="text-xs font-medium text-muted-foreground">Received</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(selectedMessage.createdAt), 'EEEE, MMMM dd, yyyy')}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {format(new Date(selectedMessage.createdAt), 'HH:mm:ss')}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">Subject</p>
                  <h3 className="font-sans text-lg font-semibold text-foreground">{selectedMessage.subject}</h3>
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {selectedMessage.message}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-border px-6 py-4">
              <a href={`mailto:${selectedMessage.email}?subject=Re: ${selectedMessage.subject}`}>
                <Button className="h-9 rounded-lg">
                  <Mail className="mr-2 h-4 w-4" />
                  Reply via email
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
