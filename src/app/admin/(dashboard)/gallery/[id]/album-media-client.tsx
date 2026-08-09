"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronLeft,
  Image as ImageIcon,
  Video as VideoIcon,
  ExternalLink,
  CheckCircle2,
  X,
  Square,
  CheckSquare,
  Loader2,
  CheckCircle,
  ChevronUp,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { deleteMedia, bulkDeleteMedia, addMediaToAlbum, uploadImageAction } from "@/lib/gallery-actions";
import BulkMediaUpload from "@/components/admin/bulk-media-upload";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { SearchInput } from "@/components/admin/ui/search-input";
import { cardSurface } from "@/components/admin/ui/surface";
import * as faceapi from "face-api.js";
import { useRouter } from "next/navigation";

const MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/";

interface UploadTask {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "processing" | "success" | "error";
}

export default function AlbumMediaClient({ album, cloudName }: { album: any, cloudName?: string }) {
  const router = useRouter();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadTask[]>([]);
  const [showUploadToast, setShowUploadToast] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const confirm = useConfirm();
  const { loading, dismiss, success, error } = useToast();

  const isSelectionMode = selectedIds.size > 0;

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load face-api models:", err);
      }
    };
    loadModels();
  }, []);

  const handleUpload = async (files: File[]) => {
    setShowUploadToast(true);
    setIsExpanded(false);

    const newTasks: UploadTask[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      progress: 0,
      status: "uploading"
    }));

    setUploadQueue(prev => [...prev, ...newTasks]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const task = newTasks[i];

      try {
        const formData = new FormData();
        formData.append("file", file);

        const info = await uploadImageAction(formData, `kerala-samajam/gallery/album-${album.id}`) as any;
        if (info.error) throw new Error(info.error);

        setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: "processing", progress: 50 } : t));

        let faces: any[] = [];
        if (file.type.startsWith("image/")) {
          try {
            const img = await faceapi.bufferToImage(file);
            const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 1024, scoreThreshold: 0.1 }))
              .withFaceLandmarks()
              .withFaceDescriptors();

            faces = detections.map(d => ({
              descriptor: Array.from(d.descriptor),
              boundingBox: {
                x: d.detection.box.x,
                y: d.detection.box.y,
                width: d.detection.box.width,
                height: d.detection.box.height,
              }
            }));
          } catch (err) {
            console.error("AI index failed:", err);
          }
        }

        const dbResult = await addMediaToAlbum(album.id, [{
          url: info.url,
          publicId: info.publicId,
          type: file.type.startsWith("video") ? "VIDEO" : "IMAGE",
          width: info.width,
          height: info.height,
          faces,
        }]);

        if (dbResult.error) throw new Error(dbResult.error);

        setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: "success", progress: 100 } : t));
        router.refresh();
      } catch (err) {
        console.error("Background upload failed:", err);
        setUploadQueue(prev => prev.map(t => t.id === task.id ? { ...t, status: "error", progress: 0 } : t));
      }
    }
  };

  const handleDelete = async (media: any) => {
    const isConfirmed = await confirm({
      title: "Delete Media",
      message: "Are you sure you want to delete this media asset? This action is permanent and cannot be undone.",
      variant: "danger",
      confirmText: "Delete Forever"
    });

    if (isConfirmed) {
      const toastId = loading("Deleting media...");
      setIsDeleting(true);
      try {
        await deleteMedia(media.id, media.publicId);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(media.id);
          return next;
        });
        success("Media deleted successfully");
        router.refresh();
      } catch (err) {
        error("Failed to delete media");
      } finally {
        setIsDeleting(false);
        dismiss(toastId);
      }
    }
  };

  const handleBulkDelete = async () => {
    const isConfirmed = await confirm({
      title: `Delete ${selectedIds.size} Items`,
      message: `Are you sure you want to delete ${selectedIds.size} selected media assets? This action is permanent and cannot be undone.`,
      variant: "danger",
      confirmText: "Delete Selection"
    });

    if (isConfirmed) {
      const toastId = loading(`Deleting ${selectedIds.size} items...`);
      setIsDeleting(true);
      try {
        const mediaItemsToDelete = album.media
          .filter((m: any) => selectedIds.has(m.id))
          .map((m: any) => ({ id: m.id, publicId: m.publicId }));

        await bulkDeleteMedia(mediaItemsToDelete, album.id);
        setSelectedIds(new Set());
        success(`Successfully deleted ${mediaItemsToDelete.length} items`);
        router.refresh();
      } catch (err) {
        error("Bulk delete failed");
      } finally {
        setIsDeleting(false);
        dismiss(toastId);
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMedia.length && filteredMedia.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMedia.map((m: any) => m.id)));
    }
  };

  const filteredMedia = album.media.filter((m: any) =>
    m.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.publicId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const completedCount = uploadQueue.filter(t => t.status === "success").length;
  const isAllFinished = uploadQueue.length > 0 && uploadQueue.every(t => t.status === "success" || t.status === "error");
  const overallProgress = uploadQueue.length > 0 ? (uploadQueue.reduce((acc, t) => acc + t.progress, 0) / uploadQueue.length) : 0;

  const allSelected = selectedIds.size > 0 && selectedIds.size === filteredMedia.length;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href="/admin/gallery"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to gallery
        </Link>
        <PageHeader
          title={album.title}
          description={
            `${album.media.length} ${album.media.length === 1 ? "item" : "items"}` +
            (album.event ? ` · Event: ${album.event.title}` : " · Standalone album")
          }
        >
          <AnimatePresence>
            {isSelectionMode && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
              >
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="h-9 rounded-lg"
                >
                  {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Delete ({selectedIds.size})
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <Button onClick={() => setIsUploadOpen(true)} className="h-9 rounded-lg">
            <Plus className="mr-2 h-4 w-4" />
            Upload media
          </Button>
        </PageHeader>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search media…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-72"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={toggleSelectAll}
            className="h-9 rounded-lg"
          >
            {allSelected ? <CheckSquare className="mr-2 h-4 w-4" /> : <Square className="mr-2 h-4 w-4" />}
            {allSelected ? "Deselect all" : "Select all"}
          </Button>
          {isSelectionMode && (
            <Button
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-9 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      {filteredMedia.length === 0 ? (
        <div className={cardSurface}>
          <EmptyState
            icon={ImageIcon}
            title={searchQuery ? "No results found" : "No media yet"}
            description={
              searchQuery
                ? "Try a different search term."
                : "Upload photos or videos to fill this album."
            }
            action={
              !searchQuery ? (
                <Button onClick={() => setIsUploadOpen(true)} className="h-9 rounded-lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Upload media
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {filteredMedia.map((media: any) => (
            <div
              key={media.id}
              onClick={() => toggleSelect(media.id)}
              className={cn(
                cardSurface,
                "group relative aspect-square cursor-pointer overflow-hidden transition-colors",
                selectedIds.has(media.id)
                  ? "ring-2 ring-primary"
                  : "hover:border-primary/40"
              )}
            >
              {media.type === "IMAGE" ? (
                <img src={media.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-muted text-muted-foreground">
                  <VideoIcon className="h-8 w-8" />
                  <span className="text-xs font-medium">Video</span>
                </div>
              )}

              {/* Selection indicator */}
              {selectedIds.has(media.id) ? (
                <div className="absolute right-2 top-2 z-10 rounded-full bg-primary text-primary-foreground shadow-sm">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="absolute right-2 top-2 z-10 h-5 w-5 rounded-full border-2 border-white/80 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100" />
              )}

              {/* Actions overlay */}
              {!isSelectionMode && (
                <div
                  className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={media.url} target="_blank">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 rounded-md"
                      aria-label="Open original"
                      title="Open original"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(media);
                    }}
                    className="h-8 w-8 rounded-md"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload activity panel */}
      <AnimatePresence>
        {showUploadToast && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            className="fixed bottom-6 right-6 z-[200] w-auto"
          >
            <div className={cn(cardSurface, "min-w-[280px] overflow-hidden")}>
              <div
                className="flex cursor-pointer items-center gap-3 px-4 py-3"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                  <svg className="h-full w-full -rotate-90">
                    <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
                    <motion.circle
                      cx="20"
                      cy="20"
                      r="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="113"
                      animate={{ strokeDashoffset: 113 - (113 * overallProgress) / 100 }}
                      className={cn("transition-colors duration-500", isAllFinished ? "text-emerald-500" : "text-primary")}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {isAllFinished ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col pr-2">
                  <p className="text-sm font-medium leading-none text-foreground">
                    {isAllFinished ? "Upload complete" : "Uploading media"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {completedCount} of {uploadQueue.length} done
                  </p>
                </div>

                <div className="flex items-center gap-1 pr-1">
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? <X className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  </button>
                  {isAllFinished && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUploadToast(false);
                        setUploadQueue([]);
                        setIsExpanded(false);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
                      aria-label="Dismiss"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border bg-muted/30"
                  >
                    <div className="max-h-[240px] space-y-1 overflow-y-auto p-2">
                      {uploadQueue.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted">
                          <div className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border",
                            task.status === "success"
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {task.status === "success" ? <CheckCircle className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-xs font-medium leading-tight text-foreground">{task.name}</span>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                                <motion.div
                                  className={cn("h-full", task.status === "success" ? "bg-emerald-500" : "bg-primary")}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${task.progress}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground">{task.progress}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BulkMediaUpload
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}
