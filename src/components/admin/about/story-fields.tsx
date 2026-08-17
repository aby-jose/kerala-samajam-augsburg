"use client";

import { useFieldArray, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { MoveDown, MoveUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { ABOUT_ICONS, type AboutContentT } from "@/lib/about-schema";

/** The "Where We Come From" section's fields: heading and up to 6 cards. */
export function AboutStoryFields({
  control,
  register,
  errors,
}: {
  control: Control<AboutContentT>;
  register: UseFormRegister<AboutContentT>;
  errors: FieldErrors<AboutContentT>;
}) {
  const e = errors.content?.story;
  const { fields, append, remove, move } = useFieldArray({ control, name: "content.story.cards" });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Eyebrow" error={e?.eyebrow?.message}>
          <Input {...register("content.story.eyebrow")} placeholder="e.g. Our story" className="h-9 rounded-lg" />
        </Field>
        <Field label="Title" error={e?.title?.message}>
          <Input
            {...register("content.story.title")}
            placeholder="e.g. Where We Come From"
            className="h-9 rounded-lg"
          />
        </Field>
        <Field label="Highlighted word/phrase in title" error={e?.accentWord?.message}>
          <Input {...register("content.story.accentWord")} placeholder="e.g. Come From" className="h-9 rounded-lg" />
          <p className="text-xs text-muted-foreground">
            Must match text within the title above exactly. Leave blank for no highlight.
          </p>
        </Field>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-semibold text-foreground">Cards</h3>
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
          <div
            key={field.id}
            className="grid grid-cols-1 gap-4 py-5 first:pt-0 sm:py-6 md:grid-cols-[140px_1fr_1fr_auto] md:items-start"
          >
            <Field label="Icon" error={errors.content?.story?.cards?.[index]?.icon?.message}>
              <select
                {...register(`content.story.cards.${index}.icon` as const)}
                className="h-9 w-full rounded-lg border border-muted/60 bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                {ABOUT_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title" error={errors.content?.story?.cards?.[index]?.title?.message}>
              <Input
                {...register(`content.story.cards.${index}.title` as const)}
                placeholder="e.g. How We Started"
                className="h-9 rounded-lg"
              />
            </Field>
            <Field label="Description" error={errors.content?.story?.cards?.[index]?.description?.message}>
              <Textarea {...register(`content.story.cards.${index}.description` as const)} rows={3} placeholder="A sentence or two." />
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
        {e?.cards?.message && (
          <p className="pb-1 text-xs text-red-600 dark:text-red-400">{e.cards.message}</p>
        )}
      </div>
    </div>
  );
}
