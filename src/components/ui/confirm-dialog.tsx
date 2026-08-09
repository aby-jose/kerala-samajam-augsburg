"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./button";
import { AlertCircle, HelpCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolve, setResolve] = useState<(value: boolean) => void>(() => { });

  const confirm = useCallback((confirmOptions: ConfirmOptions) => {
    setOptions(confirmOptions);
    setIsOpen(true);
    return new Promise<boolean>((res) => {
      setResolve(() => res);
    });
  }, []);

  const handleCancel = () => {
    setIsOpen(false);
    resolve(false);
  };

  const handleConfirm = () => {
    setIsOpen(false);
    resolve(true);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {isOpen && options && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            {/* Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[400px] bg-card border border-border/50 shadow-2xl rounded-[2rem] p-8 overflow-hidden"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                {/* Icon */}
                <div className={cn(
                  "h-16 w-16 rounded-full flex items-center justify-center shadow-inner",
                  options.variant === "danger" ? "bg-destructive/10 text-destructive" :
                    options.variant === "warning" ? "bg-amber-500/10 text-amber-500" :
                      "bg-primary/10 text-primary"
                )}>
                  {options.variant === "danger" ? <AlertCircle className="w-8 h-8" /> :
                    options.variant === "warning" ? <AlertTriangle className="w-8 h-8" /> :
                      <HelpCircle className="w-8 h-8" />}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold tracking-tight text-foreground">{options.title}</h3>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                    {options.message}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="flex-1 h-12 rounded-xl font-bold text-xs tracking-widest border-border/60 hover:bg-secondary transition-all active:scale-95"
                  >
                    {options.cancelText || "Cancel"}
                  </Button>
                  <Button
                    variant={options.variant === "danger" ? "destructive" : "default"}
                    onClick={handleConfirm}
                    className={cn(
                      "flex-1 h-12 rounded-xl font-bold text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-primary/20",
                      options.variant === "danger" ? "bg-destructive hover:bg-destructive/90 shadow-destructive/20" : ""
                    )}
                  >
                    {options.confirmText || "Confirm"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return context.confirm;
}
