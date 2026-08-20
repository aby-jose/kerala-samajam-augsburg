"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  X,
  Loader2,
  Image as ImageIcon,
  Clock,
  Sparkles,
  Upload,
  Zap,
  Trash2,
  RefreshCw,
  Plus,
  MoveUp,
  MoveDown,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertEvent, generateEventDetails, improveEventTitle, improveEventDescription, generateCategory, generateEventImage } from "@/lib/event-actions";
import { uploadImageAction } from "@/lib/gallery-actions";
import ImageUpload from "@/components/admin/image-upload";
import { eventSchema, type EventFormValues } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { heroSurface } from "@/components/admin/ui/surface";

type FormValues = EventFormValues;

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export default function EventFormModal({ isOpen, onClose, initialData }: EventFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [isImprovingTitle, setIsImprovingTitle] = useState(false);
  const [isImprovingDescription, setIsImprovingDescription] = useState(false);
  const [isGeneratingCategory, setIsGeneratingCategory] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [activeInfo, setActiveInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error, loading, dismiss } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(eventSchema) as any,
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      address: "",
      imageUrl: "",
      category: "",
      price: "",
      isFeatured: false,
      isPublished: false,
      requiresLogin: false,
      maxAttendees: null,
      memberPrice: null,
      nonMemberPrice: null,
      sponsors: [],
    },
  });

  const {
    fields: sponsorFields,
    append: appendSponsor,
    remove: removeSponsor,
    swap: swapSponsor,
  } = useFieldArray({ control, name: "sponsors" });

  const title = watch("title");
  const imageUrl = watch("imageUrl");
  const description = watch("description");

  useEffect(() => {
    if (isOpen && initialData) {
      reset({
        id: initialData.id,
        title: initialData.title || "",
        slug: initialData.slug || "",
        description: initialData.description || "",
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : "",
        startTime: initialData.startTime || "",
        endTime: initialData.endTime || "",
        location: initialData.location || "",
        address: initialData.address || "",
        imageUrl: initialData.imageUrl || "",
        category: initialData.category || "",
        price: initialData.price || "",
        isFeatured: initialData.isFeatured ?? false,
        isPublished: initialData.isPublished ?? false,
        requiresLogin: initialData.requiresLogin ?? false,
        maxAttendees: initialData.maxAttendees ?? null,
        memberPrice: initialData.memberPrice ?? null,
        nonMemberPrice: initialData.nonMemberPrice ?? null,
        sponsors: (initialData.sponsors || []).map((sponsor: any) => ({
          name: sponsor.name || "",
          logoUrl: sponsor.logoUrl || "",
          websiteUrl: sponsor.websiteUrl || "",
        })),
      });
    } else if (isOpen && !initialData) {
      reset({
        title: "",
        slug: "",
        description: "",
        date: "",
        startTime: "",
        endTime: "",
        location: "",
        address: "",
        imageUrl: "",
        category: "",
        price: "",
        isFeatured: false,
        isPublished: false,
        requiresLogin: false,
        maxAttendees: null,
        memberPrice: null,
        nonMemberPrice: null,
        sponsors: [],
      });
    }
  }, [isOpen, initialData, reset]);

  // Auto-generate slug
  useEffect(() => {
    if (title && !initialData) {
      const generatedSlug = title
        .toLowerCase()
        .trim()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");
      setValue("slug", generatedSlug, { shouldValidate: true });
    }
  }, [title, setValue, initialData]);

  /**
   * Upload the cover image and keep the returned URL.
   *
   * This used to read the file into a base64 data URL and put *that* in the
   * form field — the comment said "Mock upload or use a server action here".
   * It did reach Cloudinary in the end, because `upsertEvent` spots the
   * `data:image` prefix and uploads server-side, but it meant a 4 MB photo
   * became a ~5.4 MB string carried in React state and re-sent on every save.
   * It was also the only upload path in the app that skipped `validateUpload`,
   * so nothing checked the size or that the file was really an image.
   */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = (await uploadImageAction(formData, "kerala-samajam/events")) as {
        url?: string;
        error?: string;
      };

      if (result.error || !result.url) {
        error(result.error || "Upload failed. Please try again.");
        return;
      }

      setValue("imageUrl", result.url, { shouldValidate: true });
    } catch (err) {
      console.error("Upload failed:", err);
      error(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      // Let the same file be chosen again after a failure.
      e.target.value = "";
    }
  };

  const handleGenerateAIImage = async () => {
    if (!title) return error("Please enter a title first for better AI generation.");

    setIsGenerating(true);
    const toastId = loading("Generating event image...");
    try {
      // Extract context for better AI generation
      const subject = description ? description.split('.')[0] : title;
      const prompt = `A realistic high-quality cinematic photo of ${title}: ${subject}. 4k, detailed, professional lighting, vibrant colors.`;

      const url = await generateEventImage(prompt);

      if (url) {
        // Clear current image to force re-render
        setValue("imageUrl", "", { shouldValidate: true });

        // Use a small delay to ensure React clears the img tag before we set the new one
        await new Promise(resolve => setTimeout(resolve, 150));

        // Set the fresh URL
        const freshUrl = url.startsWith('data:')
          ? url
          : (url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`);
        setIsImageLoading(true);
        setValue("imageUrl", freshUrl, { shouldValidate: true });
        success("Image generated.");
      } else {
        error("Image generation service is currently unavailable.");
      }
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      error(err.message || "AI generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
      dismiss(toastId);
    }
  };

  const handleAIAutofill = async () => {
    if (!title) {
        error("Please enter a title first.");
        return;
    }
    const toastId = loading("Generating event details...");
    setIsAutofilling(true);
    try {
      const details = await generateEventDetails(title);
      if (details) {
        if (details.description) setValue("description", details.description, { shouldValidate: true });
        if (details.category) setValue("category", details.category, { shouldValidate: true });
        if (details.suggestedLocation) setValue("location", details.suggestedLocation, { shouldValidate: true });
        if (details.suggestedPrice) setValue("price", details.suggestedPrice, { shouldValidate: true });
        success("Event details auto-filled.");
      }
    } catch (err: any) {
      error(err.message || "AI Autofill failed. Please try again.");
    } finally {
      setIsAutofilling(false);
      dismiss(toastId);
    }
  };

  const handleImproveTitle = async () => {
    if (!title) return error("Enter a title to improve.");
    const toastId = loading("Refining title...");
    setIsImprovingTitle(true);
    try {
      const refined = await improveEventTitle(title);
      setValue("title", refined, { shouldValidate: true });
      success("Title improved.");
    } catch (err: any) {
      error(err.message || "Failed to improve title.");
    } finally {
      setIsImprovingTitle(false);
      dismiss(toastId);
    }
  };

  const handleImproveDescription = async () => {
    if (!description && !title) return error("Enter a title or description to improve.");
    const toastId = loading("Refining description...");
    setIsImprovingDescription(true);
    try {
      const refined = await improveEventDescription(description, title);
      setValue("description", refined, { shouldValidate: true });
      success("Description improved.");
    } catch (err: any) {
      error(err.message || "Failed to enhance description.");
    } finally {
      setIsImprovingDescription(false);
      dismiss(toastId);
    }
  };

  const handleGenerateCategory = async () => {
    if (!title) return error("Enter a title first.");
    const toastId = loading("Analyzing category...");
    setIsGeneratingCategory(true);
    try {
      const cat = await generateCategory(title, description);
      setValue("category", cat, { shouldValidate: true });
      success(`Category set to ${cat}`);
    } catch (err: any) {
      error(err.message || "Failed to generate category.");
    } finally {
      setIsGeneratingCategory(false);
      dismiss(toastId);
    }
  };

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    setIsSubmitting(true);
    try {
      await upsertEvent(data as any);
      success(initialData ? "Event updated successfully!" : "Event created successfully!");
      onClose();
    } catch (err: any) {
      console.error("Failed to save event:", err);
      error(err.message || "Failed to save event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };


  const formatSummaryDate = (dateStr: string) => {
    if (!dateStr) return "...";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatSummaryTime = (timeStr: string | undefined) => {
    if (!timeStr) return "...";
    try {
      // timeStr is usually "HH:mm" from type="time"
      const [hours, minutes] = timeStr.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return timeStr;
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
        className={cn(heroSurface, "relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden md:max-h-[50vh] md:max-w-[50vw]")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-sans text-base font-semibold text-foreground">
              {initialData ? "Edit event" : "Create event"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Event details, schedule and visibility.
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

        {/* Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto">
          <form id="event-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-5">

            {/* Primary Section */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="title" className="text-sm font-medium">
                      Title
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={handleAIAutofill}
                      disabled={isAutofilling || !title}
                      className="h-8 gap-1.5 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      {isAutofilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Auto-fill
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="title"
                      {...register("title")}
                      placeholder="e.g. Grand Onam Celebration"
                      className="h-9 rounded-lg pr-9"
                    />
                    <button
                      type="button"
                      onClick={handleImproveTitle}
                      disabled={isImprovingTitle || !title}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-primary disabled:opacity-30"
                      title="Improve title"
                    >
                      {isImprovingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.title && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="slug" className="text-sm font-medium">
                    URL slug
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">/events/</span>
                    <Input
                      id="slug"
                      {...register("slug")}
                      className="h-9 rounded-lg pl-[4.5rem] font-mono text-xs"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-generated from the title.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="category" className="text-sm font-medium">
                        Category
                      </Label>
                      <button
                        type="button"
                        onClick={handleGenerateCategory}
                        disabled={isGeneratingCategory || !title}
                        className="text-muted-foreground transition-colors hover:text-primary disabled:opacity-30"
                        title="Auto-detect category"
                      >
                        {isGeneratingCategory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <Input
                      id="category"
                      {...register("category")}
                      placeholder="e.g. Cultural"
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="price" className="text-sm font-medium">
                      Display price
                    </Label>
                    <Input
                      id="price"
                      {...register("price")}
                      placeholder="e.g. €10 / Member Free"
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="memberPrice" className="text-sm font-medium">
                      Member price (€)
                    </Label>
                    <Input
                      id="memberPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("memberPrice", { setValueAs: (v) => v === "" || isNaN(parseFloat(v)) ? null : parseFloat(v) })}
                      placeholder="0.00"
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nonMemberPrice" className="text-sm font-medium">
                      Non-member price (€)
                    </Label>
                    <Input
                      id="nonMemberPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("nonMemberPrice", { setValueAs: (v) => v === "" || isNaN(parseFloat(v)) ? null : parseFloat(v) })}
                      placeholder="0.00"
                      className="h-9 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex h-full flex-col space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={handleImproveDescription}
                    disabled={isImprovingDescription || !description}
                    className="h-8 gap-1.5 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    {isImprovingDescription ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Refine
                  </Button>
                </div>
                <div className="relative flex-1">
                  <Textarea
                    id="description"
                    {...register("description")}
                    className="h-full min-h-[140px] resize-none rounded-lg leading-relaxed"
                    placeholder="Describe the event"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Logistics Section */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="text-sm font-medium">
                      Date
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      {...register("date")}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="startTime" className="text-sm font-medium">
                        Start
                      </Label>
                      <Input
                        id="startTime"
                        type="time"
                        {...register("startTime")}
                        className="h-9 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="endTime" className="text-sm font-medium">
                        End
                      </Label>
                      <Input
                        id="endTime"
                        type="time"
                        {...register("endTime")}
                        className="h-9 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-sm font-medium">
                    Venue
                  </Label>
                  <Input
                    id="location"
                    {...register("location")}
                    placeholder="e.g. Community Hall"
                    className="h-9 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-sm font-medium">
                    Address
                  </Label>
                  <Input
                    id="address"
                    {...register("address")}
                    placeholder="e.g. 123 Main St, Augsburg"
                    className="h-9 rounded-lg"
                  />
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                   <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Schedule summary</span>
                   </div>
                   <p className="text-xs leading-relaxed text-muted-foreground">
                     The event takes place on <span className="font-medium text-foreground">{formatSummaryDate(watch("date"))}</span>,
                     from <span className="font-medium text-foreground">{formatSummaryTime(watch("startTime"))}</span> to <span className="font-medium text-foreground">{formatSummaryTime(watch("endTime"))}</span>.
                   </p>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Image & Assets Section */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Event image
              </Label>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Image Preview / Placeholder */}
                <div className={cn(
                  "group relative flex aspect-video items-center justify-center overflow-hidden",
                  imageUrl
                    ? "rounded-lg border border-border bg-card"
                    : "rounded-xl border-2 border-dashed border-border bg-muted/30"
                )}>
                  {imageUrl ? (
                    <>
                      <img
                        key={imageUrl}
                        src={imageUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        onLoad={() => setIsImageLoading(false)}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          setIsImageLoading(false);
                          // If it's already the fallback, don't try again to avoid loops
                          if (target.src.includes("unsplash.com")) return;

                          console.log("Image load failed, falling back to placeholder:", target.src);
                          target.src = "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=1200&auto=format&fit=crop";
                        }}
                      />

                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                            type="button"
                            onClick={handleGenerateAIImage}
                            disabled={isGenerating}
                            className="flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-black/80 disabled:opacity-50"
                            title="Regenerate image"
                        >
                          <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setValue("imageUrl", "")}
                            className="flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white transition-colors hover:bg-red-600/90"
                            title="Remove image"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 text-center">
                      <ImageIcon className="mx-auto h-5 w-5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No image selected</p>
                    </div>
                  )}

                  {(isUploading || isGenerating || isImageLoading) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <p className="text-xs text-muted-foreground">
                        {isUploading ? "Uploading…" : isGenerating ? "Generating…" : "Loading…"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Upload Controls */}
                <div className="flex flex-col justify-center gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploading || isGenerating}
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 rounded-lg"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload image
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploading || isGenerating}
                      onClick={handleGenerateAIImage}
                      className="h-9 rounded-lg"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate with AI
                    </Button>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                    accept="image/*"
                  />

                  <p className="text-xs text-muted-foreground">
                    Upload a custom image or generate one from the event title and description.
                  </p>
                </div>
              </div>
            </div>

            {/* Sponsors Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Sponsors</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendSponsor({ name: "", logoUrl: "", websiteUrl: "" })}
                  className="h-8 rounded-lg text-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add sponsor
                </Button>
              </div>

              {sponsorFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sponsors added yet.</p>
              ) : (
                <div className="space-y-3">
                  {sponsorFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="w-20 shrink-0">
                        <ImageUpload
                          aspect="aspect-square"
                          folder="kerala-samajam/sponsors"
                          defaultValue={watch(`sponsors.${index}.logoUrl`)}
                          onUploadComplete={(url) =>
                            setValue(`sponsors.${index}.logoUrl`, url, { shouldValidate: true })
                          }
                        />
                        {errors.sponsors?.[index]?.logoUrl && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {errors.sponsors[index]?.logoUrl?.message}
                          </p>
                        )}
                      </div>

                      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Input
                            {...register(`sponsors.${index}.name`)}
                            placeholder="Sponsor name"
                            className="h-9 rounded-lg"
                          />
                          {errors.sponsors?.[index]?.name && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {errors.sponsors[index]?.name?.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Input
                            {...register(`sponsors.${index}.websiteUrl`)}
                            placeholder="https://sponsor-website.com (optional)"
                            className="h-9 rounded-lg"
                          />
                          {errors.sponsors?.[index]?.websiteUrl && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {errors.sponsors[index]?.websiteUrl?.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          onClick={() => swapSponsor(index, index - 1)}
                          className="h-7 w-7 rounded-md"
                          aria-label="Move up"
                        >
                          <MoveUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === sponsorFields.length - 1}
                          onClick={() => swapSponsor(index, index + 1)}
                          className="h-7 w-7 rounded-md"
                          aria-label="Move down"
                        >
                          <MoveDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSponsor(index)}
                          className="h-7 w-7 rounded-md hover:text-red-600"
                          aria-label="Remove sponsor"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Visibility Options */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-1.5 lg:col-span-1">
                    <Label htmlFor="maxAttendees" className="text-sm font-medium">
                        Max capacity
                    </Label>
                    <Input
                        id="maxAttendees"
                        type="number"
                        min="1"
                        {...register("maxAttendees", { setValueAs: (v) => v === "" || isNaN(parseInt(v)) ? null : parseInt(v, 10) })}
                        placeholder="Unlimited"
                        className="h-9 rounded-lg"
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:col-span-2 lg:pt-6">
                    <div className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3" onClick={() => setValue("isFeatured", !watch("isFeatured"))}>
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">Featured</p>
                            <p className="text-xs text-muted-foreground">Homepage spotlight</p>
                        </div>
                        <div className={cn("relative h-4 w-7 rounded-full transition-colors", watch("isFeatured") ? "bg-primary" : "bg-muted-foreground/20")}>
                            <div className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all", watch("isFeatured") ? "right-0.5" : "left-0.5")} />
                        </div>
                    </div>

                    <div className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3" onClick={() => setValue("requiresLogin", !watch("requiresLogin"))}>
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">Members only</p>
                            <p className="text-xs text-muted-foreground">Login required</p>
                        </div>
                        <div className={cn("relative h-4 w-7 rounded-full transition-colors", watch("requiresLogin") ? "bg-primary" : "bg-muted-foreground/20")}>
                            <div className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all", watch("requiresLogin") ? "right-0.5" : "left-0.5")} />
                        </div>
                    </div>

                    <div className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3" onClick={() => setValue("isPublished", !watch("isPublished"))}>
                        <div className="space-y-0.5">
                            <p className="text-sm font-medium text-foreground">Published</p>
                            <p className="text-xs text-muted-foreground">Publicly visible</p>
                        </div>
                        <div className={cn("relative h-4 w-7 rounded-full transition-colors", watch("isPublished") ? "bg-primary" : "bg-muted-foreground/20")}>
                            <div className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all", watch("isPublished") ? "right-0.5" : "left-0.5")} />
                        </div>
                    </div>
                </div>
            </div>
          </form>
        </div>

        {/* Footer */}
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
            form="event-form"
            disabled={isSubmitting || isUploading || isGenerating || isAutofilling}
            type="submit"
            className="h-9 rounded-lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                {initialData ? "Update event" : "Create event"}
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
