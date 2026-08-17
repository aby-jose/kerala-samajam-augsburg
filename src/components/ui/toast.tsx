"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info" | "loading";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  loading: (message: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (type !== "loading") {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  // Stable identities, not a style preference: consumers list these in effect
  // dependency arrays, so recreating them on every render re-ran those effects
  // each time a toast appeared or expired. The email-preference switches lost
  // the value you had just clicked to the refetch that followed, and a failing
  // fetch toasted -> re-rendered -> refetched without end.
  const success = useCallback((message: string, duration?: number) => toast(message, "success", duration), [toast]);
  const error = useCallback((message: string, duration?: number) => toast(message, "error", duration), [toast]);
  const info = useCallback((message: string, duration?: number) => toast(message, "info", duration), [toast]);
  const loading = useCallback((message: string) => toast(message, "loading"), [toast]);

  const value = useMemo(
    () => ({ toast, success, error, info, loading, dismiss }),
    [toast, success, error, info, loading, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Above the modal layer (z-200): auth and consent dialogs raise toasts of
          their own, and at equal z they only stayed visible by DOM accident. */}
      <div className="fixed bottom-6 right-6 z-[250] flex flex-col gap-3 w-full max-w-xs pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={cn(
                "pointer-events-auto flex items-center gap-4 p-4 rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] border transition-all",
                t.type === "success" && "bg-emerald-600 border-emerald-500 text-white",
                t.type === "error" && "bg-destructive border-destructive/20 text-white",
                t.type === "info" && "bg-zinc-900 border-white/10 text-white",
                t.type === "loading" && "bg-background/95 backdrop-blur-xl border-border/40 text-foreground"
              )}
            >
              <div className="shrink-0">
                {t.type === "success" && <div className="bg-white/20 p-1 rounded-lg"><CheckCircle2 className="w-5 h-5 text-white" /></div>}
                {t.type === "error" && <div className="bg-white/20 p-1 rounded-lg"><AlertCircle className="w-5 h-5 text-white" /></div>}
                {t.type === "info" && <div className="bg-white/10 p-1 rounded-lg"><Info className="w-5 h-5 text-white" /></div>}
                {t.type === "loading" && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
              </div>
              <p className="text-[13px] font-bold tracking-tight flex-1 leading-snug">{t.message}</p>
              <button 
                onClick={() => dismiss(t.id)}
                className={cn(
                  "shrink-0 p-1.5 rounded-xl transition-all",
                  t.type === "loading" ? "hover:bg-black/5" : "hover:bg-white/10"
                )}
              >
                <X className={cn("w-4 h-4", t.type === "loading" ? "text-muted-foreground" : "text-white/60")} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
