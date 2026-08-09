"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadImageAction } from "@/lib/gallery-actions";

interface ImageUploadProps {
  onUploadComplete: (url: string, publicId: string) => void;
  defaultValue?: string;
  className?: string;
  aspect?: string;
}

export default function ImageUpload({
    onUploadComplete,
    defaultValue,
    className,
    aspect = "aspect-video"
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadImageAction(formData) as { url: string; publicId: string };
      onUploadComplete(result.url, result.publicId);
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to upload image. Check your connection.");
      setPreview(defaultValue || null);
    } finally {
      setIsUploading(false);
    }
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onUploadComplete("", "");
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden transition-colors",
          aspect,
          preview
            ? "rounded-2xl border border-border bg-card"
            : "rounded-2xl border-2 border-dashed border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
          isUploading && "cursor-wait opacity-70",
          error && "border-red-300 dark:border-red-500/40"
        )}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />

        {preview ? (
          <div className="relative h-full w-full">
            <img src={preview} alt="Upload preview" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                type="button"
                variant="secondary"
                className="h-8 rounded-lg px-3 text-xs"
              >
                Change image
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={clearImage}
                className="h-8 w-8 rounded-lg p-0"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isUploading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-xs">Uploading…</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2 p-8 text-center">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-0.5">
                <p className="text-sm text-muted-foreground">Click to upload an image</p>
                <p className="text-xs text-muted-foreground">PNG, JPG or WEBP, up to 10MB</p>
            </div>
          </div>
        )}

        {error && (
            <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
            </div>
        )}
      </div>
    </div>
  );
}
