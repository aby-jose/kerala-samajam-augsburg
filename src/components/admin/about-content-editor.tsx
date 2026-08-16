"use client";

import { useForm, useFieldArray, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Loader2, MoveUp, MoveDown, Plus, Trash2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/ui/page-header";
import { Field } from "@/components/admin/ui/field";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import ImageUpload from "@/components/admin/image-upload";
import { saveAboutContent } from "@/lib/about-actions";
import { aboutContentSchema, ABOUT_ICONS, type AboutContentT } from "@/lib/about-schema";
import { cn } from "@/lib/utils";

export function AboutContentEditor({ initialData }: { initialData: AboutContentT }) {
  const [isSaving, setIsSaving] = useState(false);
  const { success, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AboutContentT>({
    resolver: zodResolver(aboutContentSchema),
    defaultValues: initialData,
  });

  const { fields, append, remove, move } = useFieldArray({ control, name: "cards" });
  const heroImageUrl = watch("heroImageUrl");

  const onSubmit: SubmitHandler<AboutContentT> = async (data) => {
    setIsSaving(true);
    try {
      await saveAboutContent(data);
      success("About page updated.");
    } catch (err: any) {
      console.error("Failed to save about content:", err);
      toastError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <PageHeader
        title="About Page"
        description="Edit the copy and images shown on the public About page."
      >
        <Button type="submit" disabled={isSaving} className="h-9 rounded-lg">
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save changes
        </Button>
      </PageHeader>

      {/* Hero */}
      <div className={cn(cardSurface)}>
        <div className={panelHeader}>
          <div>
            <h2 className="font-sans text-sm font-semibold text-foreground">Hero</h2>
            <p className="text-xs text-muted-foreground">The header banner at the top of the page.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-2">
          <div className="space-y-5">
            <Field label="Eyebrow" error={errors.eyebrow?.message}>
              <Input {...register("eyebrow")} placeholder="e.g. About us" className="h-9 rounded-lg" />
            </Field>
            <Field label="Title" error={errors.title?.message}>
              <Input {...register("title")} placeholder="e.g. About Kerala Samajam Augsburg" className="h-9 rounded-lg" />
            </Field>
            <Field label="Highlighted word/phrase in title" error={errors.accentWord?.message}>
              <Input
                {...register("accentWord")}
                placeholder="e.g. Kerala"
                className="h-9 rounded-lg"
              />
              <p className="text-xs text-muted-foreground">Must match text within the title above exactly. Leave blank for no highlight.</p>
            </Field>
            <Field label="Lead paragraph" error={errors.lead?.message}>
              <Textarea {...register("lead")} rows={4} placeholder="A short paragraph under the title." />
            </Field>
          </div>
          <Field label="Hero image" error={errors.heroImageUrl?.message}>
            <ImageUpload
              onUploadComplete={(url) => setValue("heroImageUrl", url, { shouldValidate: true })}
              defaultValue={heroImageUrl}
              aspect="aspect-21/9"
            />
          </Field>
        </div>
      </div>

      {/* Story section */}
      <div className={cn(cardSurface)}>
        <div className={panelHeader}>
          <div>
            <h2 className="font-sans text-sm font-semibold text-foreground">Story section</h2>
            <p className="text-xs text-muted-foreground">The "Where We Come From" heading above the cards.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-2">
          <Field label="Eyebrow" error={errors.storyEyebrow?.message}>
            <Input {...register("storyEyebrow")} placeholder="e.g. Our story" className="h-9 rounded-lg" />
          </Field>
          <Field label="Title" error={errors.storyTitle?.message}>
            <Input {...register("storyTitle")} placeholder="e.g. Where We Come From" className="h-9 rounded-lg" />
          </Field>
          <Field label="Highlighted word/phrase in title" error={errors.storyAccentWord?.message}>
            <Input {...register("storyAccentWord")} placeholder="e.g. Come From" className="h-9 rounded-lg" />
            <p className="text-xs text-muted-foreground">Must match text within the title above exactly. Leave blank for no highlight.</p>
          </Field>
        </div>
      </div>

      {/* Cards */}
      <div className={cn(cardSurface)}>
        <div className={panelHeader}>
          <div>
            <h2 className="font-sans text-sm font-semibold text-foreground">Cards</h2>
            <p className="text-xs text-muted-foreground">Up to 6 cards shown under the story heading.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg"
            disabled={fields.length >= 6}
            onClick={() => append({ icon: "History", title: "", description: "" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add card
          </Button>
        </div>
        <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-[140px_1fr_1fr_auto] md:items-start">
              <Field label="Icon" error={errors.cards?.[index]?.icon?.message}>
                <select
                  {...register(`cards.${index}.icon` as const)}
                  className="h-9 w-full rounded-lg border border-muted/60 bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  {ABOUT_ICONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Title" error={errors.cards?.[index]?.title?.message}>
                <Input
                  {...register(`cards.${index}.title` as const)}
                  placeholder="e.g. How We Started"
                  className="h-9 rounded-lg"
                />
              </Field>
              <Field label="Description" error={errors.cards?.[index]?.description?.message}>
                <Textarea
                  {...register(`cards.${index}.description` as const)}
                  rows={3}
                  placeholder="A sentence or two."
                />
              </Field>
              <div className="flex gap-1 pt-6 md:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                  className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move up"
                >
                  <MoveUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                  className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                  aria-label="Move down"
                >
                  <MoveDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={fields.length <= 1}
                  onClick={() => remove(index)}
                  className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  aria-label="Remove card"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {errors.cards?.message && (
            <p className="px-5 pb-4 text-xs text-red-600 dark:text-red-400 sm:px-6">{errors.cards.message}</p>
          )}
        </div>
      </div>
    </form>
  );
}
