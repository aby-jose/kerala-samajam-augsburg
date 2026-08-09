"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Activity, 
  CheckCircle, 
  CheckCircle2, 
  ChevronUp, 
  Loader2 
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadTask {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "processing" | "success" | "error";
}

interface UploadProgressPillProps {
  tasks: UploadTask[];
  isVisible: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

export default function UploadProgressPill({ 
  tasks, 
  isVisible, 
  isExpanded, 
  onToggleExpand, 
  onClose 
}: UploadProgressPillProps) {
  if (tasks.length === 0) return null;

  const completedCount = tasks.filter(t => t.status === "success").length;
  const isAllFinished = tasks.every(t => t.status === "success" || t.status === "error");
  const overallProgress = (tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-10 right-10 z-[200] w-auto"
        >
          <div className="bg-popover/90 backdrop-blur-3xl border border-border rounded-2xl shadow-2xl p-1 overflow-hidden min-w-[260px] ring-1 ring-black/5 dark:ring-white/5">
            {/* Activity Header - Compact Pill Style */}
            <div 
              className="flex items-center gap-4 px-4 py-3 cursor-pointer group"
              onClick={onToggleExpand}
            >
              <div className="relative h-10 w-10 flex items-center justify-center shrink-0">
                <svg className="h-full w-full -rotate-90">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/10" />
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
                  {isAllFinished ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Activity className="w-4 h-4 text-muted-foreground/40 animate-pulse" />}
                </div>
              </div>

              <div className="flex-1 flex flex-col pr-2">
                <h3 className="text-[11px] font-black uppercase tracking-[0.1em] text-foreground leading-none">
                  {isAllFinished ? "Upload Complete" : "Sharing Moments"}
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 mt-1.5">
                  {completedCount} of {tasks.length} submitted
                </p>
              </div>

              <div className="flex items-center gap-2 pr-2">
                <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground/40 hover:text-foreground transition-all">
                  {isExpanded ? <X className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
                {isAllFinished && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Detail - Compact List */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border bg-muted/20"
                >
                  <div className="max-h-[240px] overflow-y-auto p-2 custom-scrollbar space-y-1">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted transition-all">
                        <div className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border border-border",
                          task.status === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground/40"
                        )}>
                          {task.status === "success" ? <CheckCircle className="w-3.5 h-3.5" /> : task.status === "error" ? <X className="w-3.5 h-3.5 text-destructive" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[10px] font-bold text-foreground/80 truncate leading-tight">{task.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="h-0.5 flex-1 bg-muted rounded-full overflow-hidden">
                              <motion.div 
                                className={cn("h-full", task.status === "success" ? "bg-emerald-500" : task.status === "error" ? "bg-destructive" : "bg-primary")}
                                initial={{ width: 0 }}
                                animate={{ width: `${task.progress}%` }}
                              />
                            </div>
                            <span className="text-[8px] font-black text-muted-foreground/30">{Math.round(task.progress)}%</span>
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
  );
}
