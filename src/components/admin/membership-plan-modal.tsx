"use client";

import React, { useState } from "react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  X,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertMembershipPlan } from "@/lib/membership-actions";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { heroSurface } from "@/components/admin/ui/surface";

interface MembershipPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

const localPlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Name is required"),
  description: z.string().optional().nullable(),
  price: z.number().min(0, "Price must be positive"),
  duration: z.string(),
  features: z.array(z.object({ value: z.string() })),
  isActive: z.boolean(),
  isPopular: z.boolean(),
});

type LocalPlanFormValues = z.infer<typeof localPlanSchema>;

// Features are wrapped as objects while editing and unwrapped again on submit.
// A plan with no features still opens with one empty row to type into.
function toFormValues(initialData?: any): LocalPlanFormValues {
  return {
    id: initialData?.id,
    name: initialData?.name || "",
    description: initialData?.description || "",
    price: initialData?.price || 0,
    duration: initialData?.duration || "YEARLY",
    features: initialData?.features?.length
      ? initialData.features.map((f: string) => ({ value: f }))
      : [{ value: "" }],
    isActive: initialData?.isActive ?? true,
    isPopular: initialData?.isPopular ?? false,
  };
}

// The parent mounts this fresh (and keyed) per opening, so the initial values
// are read once here rather than reset into an already-mounted form.
export default function MembershipPlanModal({ isOpen, onClose, initialData }: MembershipPlanModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<LocalPlanFormValues>({
    resolver: zodResolver(localPlanSchema),
    defaultValues: toFormValues(initialData),
  });

  const onSubmit: SubmitHandler<any> = async (data) => {
    setIsSubmitting(true);
    try {
      // Map features back to strings and filter out empty ones
      const cleanData = {
        ...data,
        features: data.features
          .map((f: any) => f.value)
          .filter((f: string) => f.trim() !== "")
      };
      await upsertMembershipPlan(cleanData);
      success(initialData ? "Plan updated successfully!" : "Plan created successfully!");
      onClose();
    } catch (err: any) {
      console.error("Failed to save plan:", err);
      error(err.message || "Failed to save plan. Please try again.");
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
        className={cn(heroSurface, "relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden md:max-h-[50vh] md:max-w-[50vw]")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="font-sans text-base font-semibold text-foreground">
              {initialData ? "Edit plan" : "Create plan"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Pricing, duration and benefits for this membership plan.
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
          <form id="plan-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium">Plan name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g. Family Membership"
                  className="h-9 rounded-lg"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-sm font-medium">Price (€)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  {...register("price", { valueAsNumber: true })}
                  placeholder="0.00"
                  className="h-9 rounded-lg"
                />
                {errors.price && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.price.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-sm font-medium">Short description</Label>
              <Input
                id="description"
                {...register("description")}
                placeholder="Briefly describe who this plan is for"
                className="h-9 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="duration" className="text-sm font-medium">Duration</Label>
              <select
                id="duration"
                {...register("duration")}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="YEARLY">Yearly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="LIFETIME">Lifetime</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Features</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setValue("features", [...getValues("features"), { value: "" }])
                  }
                  className="h-8 gap-1.5 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Add feature
                </Button>
              </div>

              {/* Controlled rows: the value on screen always comes from form
                  state, so an appended row cannot inherit a stale DOM value. */}
              <Controller
                control={control}
                name="features"
                render={({ field }) => (
                  <div className="space-y-2">
                    {field.value.map((row, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            value={row.value}
                            onChange={(e) =>
                              field.onChange(
                                field.value.map((r, i) =>
                                  i === index ? { value: e.target.value } : r
                                )
                              )
                            }
                            onBlur={field.onBlur}
                            placeholder={`Feature ${index + 1}`}
                            className="h-9 rounded-lg"
                          />
                        </div>
                        {field.value.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              field.onChange(field.value.filter((_, i) => i !== index))
                            }
                            className="h-9 w-9 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            aria-label="Remove feature"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Active</p>
                      <p className="text-xs text-muted-foreground">Visible to the public for purchase</p>
                  </div>
                  <div
                      className={cn(
                          "h-6 w-11 cursor-pointer rounded-full p-1 transition-colors duration-300",
                          watch("isActive") ? "bg-primary" : "bg-muted-foreground/20"
                      )}
                      onClick={() => setValue("isActive", !watch("isActive"))}
                  >
                      <div className={cn(
                          "h-4 w-4 rounded-full bg-white transition-all duration-300",
                          watch("isActive") ? "translate-x-5" : "translate-x-0"
                      )} />
                  </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Most popular</p>
                      <p className="text-xs text-muted-foreground">Highlight this plan as recommended</p>
                  </div>
                  <div
                      className={cn(
                          "h-6 w-11 cursor-pointer rounded-full p-1 transition-colors duration-300",
                          watch("isPopular") ? "bg-primary" : "bg-muted-foreground/20"
                      )}
                      onClick={() => setValue("isPopular", !watch("isPopular"))}
                  >
                      <div className={cn(
                          "h-4 w-4 rounded-full bg-white transition-all duration-300",
                          watch("isPopular") ? "translate-x-5" : "translate-x-0"
                      )} />
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
            form="plan-form"
            disabled={isSubmitting}
            type="submit"
            className="h-9 rounded-lg"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Update plan" : "Create plan"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
