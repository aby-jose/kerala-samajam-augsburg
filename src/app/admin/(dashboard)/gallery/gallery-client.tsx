"use client";

import React, { useState } from "react";
import {
  Plus,
  Filter,
  Edit,
  Trash2,
  Image as ImageIcon,
  MoreVertical,
  ExternalLink,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { SearchInput } from "@/components/admin/ui/search-input";
import AlbumFormModal from "@/components/admin/album-form-modal";
import { deleteAlbum } from "@/lib/gallery-actions";
import { cardSurface, toolbarChip } from "@/components/admin/ui/surface";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function GalleryClient({
  initialAlbums,
  availableEvents
}: {
  initialAlbums: any[],
  availableEvents: any[]
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "Events" | "Community" | "Culture">("ALL");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest" | "title">("recent");
  const confirm = useConfirm();
  const router = useRouter();

  const SORT_LABELS = { recent: "Recent", oldest: "Oldest", title: "Title (A–Z)" } as const;

  const handleCreateNew = () => {
    setSelectedAlbum(null);
    setIsModalOpen(true);
  };

  const handleEdit = (album: any) => {
    setSelectedAlbum(album);
    setIsModalOpen(true);
  };

  const handleDelete = async (album: any) => {
    const isConfirmed = await confirm({
      title: "Delete Album",
      message: `Are you sure you want to delete "${album.title}"? This action cannot be undone and will permanently delete all photos and videos inside this album.`,
      variant: "danger",
      confirmText: "Delete Album"
    });

    if (isConfirmed) {
      // Deletion can partially fail — if Cloudinary rejects some assets the
      // album is deliberately left intact rather than orphaning the files, so
      // the admin has to be told rather than seeing the row silently stay.
      const result = await deleteAlbum(album.id);
      if (result && "error" in result && result.error) {
        window.alert(result.error);
        return;
      }
      router.refresh();
    }
  };

  const filteredAlbums = initialAlbums
    .filter(album =>
      album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.event?.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(album => categoryFilter === "ALL" || album.category === categoryFilter)
    .sort((a, b) => {
      if (sortOrder === "title") return a.title.localeCompare(b.title);
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === "recent" ? -diff : diff;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gallery"
        description="Create and manage photo albums for the community."
      >
        <Button onClick={handleCreateNew} className="h-9 rounded-lg">
          <Plus className="mr-2 h-4 w-4" />
          Create album
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search albums…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-72"
        />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
                <Filter className="mr-2 h-4 w-4" />
                {categoryFilter === "ALL" ? "Filter" : categoryFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-lg">
              <DropdownMenuRadioGroup value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
                {(["ALL", "Events", "Community", "Culture"] as const).map((c) => (
                  <DropdownMenuRadioItem key={c} value={c} className="rounded-md text-sm">
                    {c === "ALL" ? "All categories" : c}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className={cn("h-9 rounded-lg", toolbarChip)}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {SORT_LABELS[sortOrder]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-lg">
              <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as typeof sortOrder)}>
                {(["recent", "oldest", "title"] as const).map((s) => (
                  <DropdownMenuRadioItem key={s} value={s} className="rounded-md text-sm">
                    {SORT_LABELS[s]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filteredAlbums.length === 0 ? (
        <div className={cardSurface}>
          <EmptyState
            icon={ImageIcon}
            title={searchQuery || categoryFilter !== "ALL" ? "No results found" : "No albums yet"}
            description={
              searchQuery || categoryFilter !== "ALL"
                ? "Try a different search term or filter."
                : "Create an album to start collecting photos and videos."
            }
            action={
              !searchQuery && categoryFilter === "ALL" ? (
                <Button onClick={handleCreateNew} className="h-9 rounded-lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create album
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAlbums.map((album) => (
            <div
              key={album.id}
              className={cn(cardSurface, "group relative overflow-hidden transition-colors hover:border-primary/40")}
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                {album.coverImage ? (
                  <img
                    src={album.coverImage}
                    alt={album.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="absolute right-2 top-2">
                  {album.isPublished ? (
                    <StatusBadge tone="success">Published</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Draft</StatusBadge>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-sans text-sm font-semibold text-foreground">
                      {album.title}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {album._count.media} {album._count.media === 1 ? "item" : "items"}
                      {album.event ? ` · ${album.event.title}` : ""}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-1 -mt-1 h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 rounded-lg">
                      <DropdownMenuItem
                        onClick={() => handleEdit(album)}
                        className="cursor-pointer gap-2 rounded-md text-sm"
                      >
                        <Edit className="h-4 w-4" /> Edit details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(album)}
                        className="cursor-pointer gap-2 rounded-md text-sm text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" /> Delete album
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="mt-2 line-clamp-2 min-h-[32px] text-xs text-muted-foreground">
                  {album.description || "No description provided."}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/admin/gallery/${album.id}`} className="flex-1">
                    <Button variant="outline" className="h-8 w-full rounded-lg text-xs">
                      Manage media
                    </Button>
                  </Link>
                  <Link href={`/gallery/${album.id}`} target="_blank">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                      aria-label="View on site"
                      title="View on site"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlbumFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={selectedAlbum}
        availableEvents={availableEvents}
      />
    </div>
  );
}
