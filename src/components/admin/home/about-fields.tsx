"use client";

import { Controller, useFieldArray, type Control, type UseFormRegister, type FieldErrors, type UseFormSetValue, type UseFormWatch } from "react-hook-form";
import { MoveDown, MoveUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { IconPicker } from "@/components/admin/ui/icon-picker";
import ImageUpload from "@/components/admin/image-upload";
import { HOME_ICON_FAVORITES, type HomeContentT } from "@/lib/home-schema";

/**
 * The "who we are" section's fields: heading, facts, collage + quote, and
 * the pillars list. The only section with nested field arrays — everything
 * else in src/components/admin/home follows HeroFields' flatter shape.
 */
export function AboutFields({
  control,
  register,
  errors,
  watch,
  setValue,
}: {
  control: Control<HomeContentT>;
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
  watch: UseFormWatch<HomeContentT>;
  setValue: UseFormSetValue<HomeContentT>;
}) {
  const e = errors.content?.about;
  const facts = useFieldArray({ control, name: "content.about.facts" });
  const pillars = useFieldArray({ control, name: "content.about.pillars" });

  const primaryUrl = watch("content.about.collage.primary.url");
  const secondaryUrl = watch("content.about.collage.secondary.url");

  return (
    <div className="space-y-5">
      <div className="space-y-5">
        <Field label="Eyebrow" error={e?.eyebrow?.message}>
          <Input {...register("content.about.eyebrow")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Title" error={e?.title?.message}>
          <Input {...register("content.about.title")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Highlighted word/phrase in title" error={e?.accentWord?.message}>
          <Input {...register("content.about.accentWord")} className="h-9 rounded-lg" />
          <p className="text-xs text-muted-foreground">
            Must match text within the title above exactly. Leave blank for no highlight.
          </p>
        </Field>
        <Field label="Lead" error={e?.lead?.message}>
          <Textarea {...register("content.about.lead")} rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Story link label" error={e?.storyLink?.label?.message}>
            <Input {...register("content.about.storyLink.label")} className="h-9 rounded-lg" />
          </Field>
          <Field label="Story link href" error={e?.storyLink?.href?.message}>
            <Input {...register("content.about.storyLink.href")} className="h-9 rounded-lg" />
          </Field>
        </div>
      </div>

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-sm font-semibold text-foreground">Facts</h3>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg"
            disabled={facts.fields.length >= 4}
            onClick={() => facts.append({ value: "", label: "" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add fact
          </Button>
        </div>

        {facts.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-start"
          >
            <Field label="Value" error={errors.content?.about?.facts?.[index]?.value?.message}>
              <Input
                {...register(`content.about.facts.${index}.value` as const)}
                placeholder="e.g. 2012"
                className="h-9 rounded-lg"
              />
            </Field>
            <Field label="Label" error={errors.content?.about?.facts?.[index]?.label?.message}>
              <Input
                {...register(`content.about.facts.${index}.label` as const)}
                placeholder="e.g. Founded"
                className="h-9 rounded-lg"
              />
            </Field>
            <div className="flex gap-1 pt-6 md:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === 0}
                onClick={() => facts.move(index, index - 1)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move up"
              >
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === facts.fields.length - 1}
                onClick={() => facts.move(index, index + 1)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move down"
              >
                <MoveDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={facts.fields.length <= 2}
                onClick={() => facts.remove(index)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                aria-label="Remove fact"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="space-y-5">
        <h3 className="font-sans text-sm font-semibold text-foreground">Collage &amp; quote</h3>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Primary image" error={e?.collage?.primary?.url?.message}>
              <ImageUpload
                onUploadComplete={(url) =>
                  setValue("content.about.collage.primary.url", url, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                defaultValue={primaryUrl}
                aspect="aspect-4/3"
              />
            </Field>
            <Field label="Primary alt text" error={e?.collage?.primary?.alt?.message}>
              <Input
                {...register("content.about.collage.primary.alt")}
                className="h-9 rounded-lg"
              />
            </Field>
            <Field label="Primary caption" error={e?.collage?.primary?.caption?.message}>
              <Input
                {...register("content.about.collage.primary.caption")}
                className="h-9 rounded-lg"
              />
            </Field>
          </div>
          <div className="space-y-3">
            <Field label="Secondary image" error={e?.collage?.secondary?.url?.message}>
              <ImageUpload
                onUploadComplete={(url) =>
                  setValue("content.about.collage.secondary.url", url, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                defaultValue={secondaryUrl}
                aspect="aspect-square"
              />
            </Field>
            <Field label="Secondary alt text" error={e?.collage?.secondary?.alt?.message}>
              <Input
                {...register("content.about.collage.secondary.alt")}
                className="h-9 rounded-lg"
              />
            </Field>
          </div>
        </div>
        <Field label="Pull quote" error={e?.quote?.text?.message}>
          <Textarea {...register("content.about.quote.text")} rows={3} />
        </Field>
        <Field label="Quote footnote" error={e?.quote?.footnote?.message}>
          <Input {...register("content.about.quote.footnote")} className="h-9 rounded-lg" />
        </Field>
      </div>

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="space-y-5">
        <Field label="Pillars eyebrow" error={e?.pillarsEyebrow?.message}>
          <Input {...register("content.about.pillarsEyebrow")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Pillars note" error={e?.pillarsNote?.message}>
          <Input {...register("content.about.pillarsNote")} className="h-9 rounded-lg" />
        </Field>

        <div className="flex items-center justify-between">
          <h3 className="font-sans text-sm font-semibold text-foreground">What we do</h3>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg"
            disabled={pillars.fields.length >= 8}
            onClick={() => pillars.append({ icon: "Flower2", title: "", desc: "" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add pillar
          </Button>
        </div>

        {pillars.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-1 gap-4 md:grid-cols-[140px_1fr_1fr_auto] md:items-start"
          >
            <Field label="Icon" error={errors.content?.about?.pillars?.[index]?.icon?.message}>
              <Controller
                control={control}
                name={`content.about.pillars.${index}.icon` as const}
                render={({ field }) => (
                  <IconPicker value={field.value} onChange={field.onChange} favorites={HOME_ICON_FAVORITES} />
                )}
              />
            </Field>
            <Field label="Title" error={errors.content?.about?.pillars?.[index]?.title?.message}>
              <Input
                {...register(`content.about.pillars.${index}.title` as const)}
                placeholder="e.g. Malayalam Classes"
                className="h-9 rounded-lg"
              />
            </Field>
            <Field
              label="Description"
              error={errors.content?.about?.pillars?.[index]?.desc?.message}
            >
              <Textarea {...register(`content.about.pillars.${index}.desc` as const)} rows={3} />
            </Field>
            <div className="flex gap-1 pt-6 md:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === 0}
                onClick={() => pillars.move(index, index - 1)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move up"
              >
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === pillars.fields.length - 1}
                onClick={() => pillars.move(index, index + 1)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move down"
              >
                <MoveDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={pillars.fields.length <= 1}
                onClick={() => pillars.remove(index)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                aria-label="Remove pillar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
