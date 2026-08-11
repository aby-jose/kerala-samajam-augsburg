"use client";

import React, { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ImageUpload from "./image-upload";
import { createAlbum, updateAlbum } from "@/lib/gallery-actions";
import { cn } from "@/lib/utils";
import { heroSurface } from "@/components/admin/ui/surface";

const albumSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  category: z.string(),
  eventId: z.string().optional(),
  coverImage: z.string().optional(),
  isPublished: z.boolean(),
});

type FormValues = z.infer<typeof albumSchema>;

interface AlbumFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  availableEvents: any[];
}

export default function AlbumFormModal({
  isOpen,
  onClose,
  initialData,
  availableEvents
}: AlbumFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(albumSchema),
    defaultValues: {
      id: "",
      title: "",
      description: "",
      category: "Events",
      eventId: "",
      coverImage: "",
      isPublished: true,
    },
  });

  const coverImage = watch("coverImage");
  const isPublished = watch("isPublished");
  const selectedEventId = watch("eventId");

  useEffect(() => {
    if (isOpen && initialData) {
      reset({
        id: initialData.id,
        title: initialData.title,
        description: initialData.description || "",
        category: initialData.category || "Events",
        eventId: initialData.eventId || "none",
        coverImage: initialData.coverImage || "",
        isPublished: initialData.isPublished,
      });
    } else if (isOpen) {
      reset({
        id: "",
        title: "",
        description: "",
        category: "Events",
        eventId: "none",
        coverImage: "",
        isPublished: true,
      });
    }
  }, [isOpen, initialData, reset]);

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      const { id, ...rest } = data;
      const payload = {
        ...rest,
        eventId: rest.eventId === "none" ? undefined : rest.eventId,
      };

      if (id) {
        await updateAlbum(id, payload);
      } else {
        await createAlbum(payload);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save album:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(heroSurface, "relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden")}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-sans text-base font-semibold text-foreground">
              {initialData ? "Edit album" : "Create album"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Organize photos into a collection, optionally linked to an event.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto">
          <form id="album-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-sm font-medium">
                Title
              </Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="e.g. Summer Festival 2024"
                className="h-9 rounded-lg"
              />
              {errors.title && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title.message}</p>}
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="category" className="text-sm font-medium">
                Category
              </Label>
              <Select
                value={watch("category")}
                onValueChange={(val) => setValue("category", val)}
              >
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="Events">Events</SelectItem>
                  <SelectItem value="Community">Community</SelectItem>
                  <SelectItem value="Culture">Culture</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Event Link */}
            <div className="space-y-1.5">
              <Label htmlFor="eventId" className="text-sm font-medium">
                Linked event (optional)
              </Label>
              {/*
                Editable after creation. It was locked ("can't change event
                after creation for now"), which meant an album linked to the
                wrong event could only be fixed by deleting it — and deleting
                an album now removes its photos from Cloudinary too. The link
                decides who may contribute, so it is worth being able to
                correct.
              */}
              <Select
                value={selectedEventId}
                onValueChange={(val) => setValue("eventId", val)}
              >
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="none">No event (standalone album)</SelectItem>
                  {availableEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} ({new Date(event.date).toLocaleDateString()})
                    </SelectItem>
                  ))}
                  {initialData?.event && (
                    <SelectItem value={initialData.eventId}>
                      {initialData.event.title} (Current)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linked albums are shown on that event&apos;s page automatically.
                {initialData?.eventId &&
                  " Changing the link also changes who may contribute photos — only attendees checked in at the linked event can."}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                {...register("description")}
                placeholder="Briefly describe what's in this album"
                className="min-h-[100px] resize-none rounded-lg"
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Cover image
              </Label>
              <ImageUpload
                aspect="aspect-[16/10]"
                defaultValue={coverImage}
                onUploadComplete={(url) => setValue("coverImage", url)}
              />
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">Published</p>
                <p className="text-xs text-muted-foreground">
                  {isPublished ? "Visible in the public gallery" : "Hidden from the public gallery (draft)"}
                </p>
              </div>
              <Switch
                checked={isPublished}
                onCheckedChange={(val) => setValue("isPublished", val)}
              />
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg"
          >
            Cancel
          </Button>
          <Button
            form="album-form"
            disabled={isSubmitting}
            type="submit"
            className="h-9 rounded-lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>{initialData ? "Update album" : "Create album"}</>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
