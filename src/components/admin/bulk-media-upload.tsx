"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Upload,
  Video as VideoIcon,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { heroSurface, chipTone } from "@/components/admin/ui/surface";

interface BulkMediaUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
}

export default function BulkMediaUpload({
  isOpen,
  onClose,
  onUpload
}: BulkMediaUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<{file: File, preview: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleStartUpload = () => {
    if (selectedFiles.length === 0) return;
    onUpload(selectedFiles.map(f => f.file));
    setSelectedFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(heroSurface, "relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden")}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-sans text-base font-semibold text-foreground">Upload media</h2>
            <p className="text-xs text-muted-foreground">
              Select images or videos to add.
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

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
          {selectedFiles.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center space-y-4 rounded-2xl border-2 border-dashed border-border bg-muted/30 p-16 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
            >
              <Upload className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
                <p className="mx-auto max-w-xs text-xs text-muted-foreground">Supports images and videos.</p>
              </div>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*"
              />
              <Button variant="outline" className="h-9 rounded-lg">
                Browse files
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {selectedFiles.map((fileObj, idx) => (
                <div key={idx} className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                  {fileObj.file.type.startsWith("image/") ? (
                    <img src={fileObj.preview} className="h-full w-full object-cover" />
                  ) : (
                    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-1", chipTone("violet"))}>
                      <VideoIcon className="h-6 w-6" />
                      <span className="text-xs font-medium">Video</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeFile(idx)}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
                    aria-label="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                    <p className="truncate text-xs text-white">{fileObj.file.name}</p>
                  </div>
                </div>
              ))}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs">Add more</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {selectedFiles.length} {selectedFiles.length === 1 ? "file" : "files"} selected
          </span>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="h-9 rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleStartUpload}
              disabled={selectedFiles.length === 0}
              className="h-9 rounded-lg"
            >
              Upload
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
