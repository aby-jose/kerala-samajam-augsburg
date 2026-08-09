"use client";

import React, { useState, useRef } from "react";
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Trash2,
  Plus,
  Sparkles,
  Camera,
  FileUp,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  albumTitle: string;
}

export default function ContributionModal({ 
  isOpen, 
  onClose, 
  onUpload,
  albumTitle 
}: ContributionModalProps) {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 md:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="px-8 py-6 border-b border-border bg-secondary/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileUp className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Share Your Perspective</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5 truncate max-w-[200px] md:max-w-none">
                    Contributing to {albumTitle}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {selectedFiles.length === 0 ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border/60 rounded-[2rem] p-16 md:p-24 flex flex-col items-center justify-center text-center space-y-6 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer bg-muted/10 group"
                >
                  <div className="h-20 w-20 rounded-[1.5rem] bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:scale-110 group-hover:text-primary transition-all duration-500 shadow-sm">
                    <Camera className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Select your captured moments</h3>
                    <p className="text-xs text-muted-foreground font-medium max-w-xs mx-auto leading-relaxed">
                      Share your unique perspective from the event. We accept high-resolution photos and videos.
                    </p>
                  </div>
                  <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="image/*,video/*"
                  />
                  <Button variant="outline" className="rounded-xl px-8 h-12 font-bold uppercase text-[10px] tracking-widest">
                    Browse Files
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {selectedFiles.map((fileObj, idx) => (
                    <div key={idx} className="group relative aspect-square rounded-2xl overflow-hidden border border-border/40 bg-muted">
                      {fileObj.file.type.startsWith("image/") ? (
                        <img src={fileObj.preview} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-white/40">
                          <VideoIcon className="w-8 h-8 mb-1" />
                          <span className="text-[8px] font-black uppercase tracking-widest">Video</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <button 
                          onClick={() => removeFile(idx)}
                          className="h-10 w-10 rounded-full bg-destructive text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all cursor-pointer group"
                  >
                    <Plus className="w-8 h-8 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest mt-2">Add More</span>
                  </div>
                </div>
              )}
            </div>

            {/* Moderation Warning */}
            <div className="px-8 py-4 bg-amber-500/5 border-y border-amber-500/10 flex items-start gap-4">
               <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
               <p className="text-[10px] text-amber-700/80 font-medium leading-relaxed">
                  By submitting, you confirm you have the right to share these assets. All contributions are <strong>moderated</strong> before appearing in the public gallery.
               </p>
            </div>

            <div className="px-8 py-6 border-t border-border flex items-center justify-between bg-secondary/5">
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {selectedFiles.length} Moments Selected
                </span>
                <span className="text-[10px] font-bold text-primary">Ready to contribute</span>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold text-[10px] uppercase tracking-widest h-12 px-6">
                  Cancel
                </Button>
                <Button 
                  onClick={handleStartUpload}
                  disabled={selectedFiles.length === 0}
                  className="rounded-xl font-bold text-[10px] uppercase tracking-widest h-12 px-10 shadow-xl shadow-primary/20 bg-primary hover:bg-primary/95"
                >
                  Submit for Moderation
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
