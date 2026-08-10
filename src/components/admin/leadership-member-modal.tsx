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
import { upsertLeadershipMember, type LeadershipMemberValues } from "@/lib/leadership-actions";
import { useToast } from "@/components/ui/toast";
import ImageUpload from "./image-upload";
import { cn } from "@/lib/utils";
import { heroSurface } from "@/components/admin/ui/surface";

const leadershipMemberSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name is required"),
  role: z.string().min(2, "Role is required"),
  image: z.string().optional().nullable(),
  order: z.number(),
});

interface LeadershipMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export default function LeadershipMemberModal({ isOpen, onClose, initialData }: LeadershipMemberModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LeadershipMemberValues>({
    resolver: zodResolver(leadershipMemberSchema),
    defaultValues: {
      id: initialData?.id,
      name: initialData?.name || "",
      role: initialData?.role || "",
      image: initialData?.image || "",
      order: initialData?.order || 0,
    },
  });

  const imageUrl = watch("image");

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          id: initialData.id,
          name: initialData.name || "",
          role: initialData.role || "",
          image: initialData.image || "",
          order: initialData.order || 0,
        });
      } else {
        reset({
          name: "",
          role: "",
          image: "",
          order: 0,
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const onSubmit: SubmitHandler<LeadershipMemberValues> = async (data) => {
    setIsSubmitting(true);
    try {
      await upsertLeadershipMember(data);
      success(initialData ? "Member details updated!" : "Member added to the team!");
      onClose();
    } catch (err: any) {
      console.error("Failed to save member:", err);
      error(err.message || "Something went wrong. Please try again.");
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
        className={cn(heroSurface, "relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-sans text-base font-semibold text-foreground">
              {initialData ? "Edit member" : "Add member"}
            </h2>
            <p className="text-xs text-muted-foreground">
              The member's name, role and photo.
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
          <form id="member-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
                <Label className="text-sm font-medium">Photo</Label>
                <ImageUpload
                    onUploadComplete={(url) => setValue("image", url)}
                    defaultValue={imageUrl || ""}
                    aspect="aspect-square"
                    className="mx-auto max-w-[240px]"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
                <Input
                    id="name"
                    {...register("name")}
                    placeholder="e.g. Aby Joseph"
                    className="h-9 rounded-lg"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="role" className="text-sm font-medium">Role</Label>
                <Input
                    id="role"
                    {...register("role")}
                    placeholder="e.g. President"
                    className="h-9 rounded-lg"
                />
                {errors.role && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.role.message}</p>}
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
            form="member-form"
            disabled={isSubmitting}
            type="submit"
            className="h-9 rounded-lg"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Update member" : "Add member"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
