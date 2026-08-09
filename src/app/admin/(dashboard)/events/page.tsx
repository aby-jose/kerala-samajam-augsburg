"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Filter,
  ArrowUpDown,
  Edit,
  Users,
  Trash2,
  Calendar,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import EventFormModal from "@/components/admin/event-form-modal";
import { deleteEvent, getAdminEvents, toggleEventPublish } from "@/lib/event-actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { SearchInput } from "@/components/admin/ui/search-input";
import { toolbarChip } from "@/components/admin/ui/surface";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";

const FILTER_LABELS: Record<string, string> = {
  all: "All",
  published: "Published",
  draft: "Draft"
};

const SORT_LABELS: Record<string, string> = {
  newest: "Newest",
  oldest: "Oldest",
  title: "Title"
};

const ITEMS_PER_PAGE = 10;

export default function AdminEventsPage() {
  const confirm = useConfirm();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const data = await getAdminEvents();
      setEvents(data);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateNew = () => {
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleEdit = (event: any) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Delete Event",
      message: "Are you sure you want to delete this event? This action cannot be undone and will remove all associated registrations.",
      confirmText: "Delete",
      variant: "danger"
    });

    if (isConfirmed) {
      await deleteEvent(id);
      fetchEvents();
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: boolean) => {
    await toggleEventPublish(id, !currentStatus);
    fetchEvents();
  };

  const filteredEvents = events
    .filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          event.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === "all" ||
                          (filterStatus === "published" && event.isPublished) ||
                          (filterStatus === "draft" && !event.isPublished);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortOrder === "newest") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortOrder === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortOrder === "title") return a.title.localeCompare(b.title);
      return 0;
    });

  const totalPages = Math.ceil(filteredEvents.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedEvents = filteredEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, sortOrder]);

  const columns: DataTableColumn<any>[] = [
    {
      key: "event",
      header: "Event",
      width: "w-[38%]",
      render: (event) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-violet-500/20 to-violet-500/5 text-xs font-semibold text-violet-600 dark:text-violet-400">
            {event.imageUrl ? (
              <img src={event.imageUrl} className="h-full w-full object-cover" alt="" />
            ) : (
              event.title.substring(0, 1)
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
            <p className="text-xs text-muted-foreground">{event.category || "General"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "schedule",
      header: "Schedule",
      width: "w-[22%]",
      render: (event) => (
        <>
          <div className="flex items-center gap-1.5 text-sm text-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {formatDate(event.date)}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.location}</p>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[14%]",
      render: (event) => (
        <button
          type="button"
          onClick={() => handleTogglePublish(event.id, event.isPublished)}
          title={event.isPublished ? "Unpublish" : "Publish"}
          className="cursor-pointer"
        >
          <StatusBadge tone={event.isPublished ? "success" : "neutral"}>
            {event.isPublished ? "Published" : "Draft"}
          </StatusBadge>
        </button>
      ),
    },
    {
      key: "registrations",
      header: "Registrations",
      width: "w-[12%]",
      render: (event) => (
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm text-foreground tabular-nums">{event._count?.registrations || 0}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-[14%]",
      align: "right",
      render: (event) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(event)}
            className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
            title="Edit event"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Link href={`/admin/registrations?event=${event.id}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              title="View registrations"
            >
              <Users className="h-4 w-4" />
            </Button>
          </Link>
          <Link href={`/events/${event.slug}`} target="_blank">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
              title="View public page"
            >
              <Globe className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(event.id)}
            className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            title="Delete event"
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
        title="Events"
        description="Create, publish and manage community events."
      >
        <Button onClick={handleCreateNew} className="h-9 rounded-lg">
          <Plus className="mr-2 h-4 w-4" />
          Create event
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={paginatedEvents}
        keyExtractor={(event) => event.id}
        isLoading={isLoading}
        skeletonRows={6}
        empty={{
          icon: Calendar,
          title: "No events found",
          description: "Try adjusting your search or create a new event.",
        }}
        pagination={{
          page: currentPage,
          totalPages,
          totalItems: filteredEvents.length,
          itemLabel: "event",
          onPageChange: setCurrentPage,
        }}
        toolbar={
          <>
            <SearchInput
              placeholder="Search events…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
                    <Filter className="mr-2 h-4 w-4" />
                    Status: {FILTER_LABELS[filterStatus]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-lg">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={filterStatus} onValueChange={setFilterStatus}>
                    <DropdownMenuRadioItem value="all" className="rounded-md text-sm">All events</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="published" className="rounded-md text-sm">Published</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="draft" className="rounded-md text-sm">Drafts</DropdownMenuRadioItem>
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
                <DropdownMenuContent align="end" className="w-44 rounded-lg">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Order by</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={sortOrder} onValueChange={setSortOrder}>
                    <DropdownMenuRadioItem value="newest" className="rounded-md text-sm">Newest date</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="oldest" className="rounded-md text-sm">Oldest date</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="title" className="rounded-md text-sm">Title (A–Z)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        }
      />

      <EventFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchEvents();
        }}
        initialData={selectedEvent}
      />
    </div>
  );
}
