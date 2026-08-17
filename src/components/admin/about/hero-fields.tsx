"use client";

import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import ImageUpload from "@/components/admin/image-upload";
import type { AboutContentT } from "@/lib/about-schema";

/** The page header section's fields: eyebrow, title, accent word, lead and
 *  the hero image. */
export function AboutHeroFields({
  register,
  errors,
  watch,
  setValue,
}: {
  register: UseFormRegister<AboutContentT>;
  errors: FieldErrors<AboutContentT>;
  watch: UseFormWatch<AboutContentT>;
  setValue: UseFormSetValue<AboutContentT>;
}) {
  const e = errors.content?.hero;
  const heroImageUrl = watch("content.hero.heroImageUrl");

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="space-y-5">
        <Field label="Eyebrow" error={e?.eyebrow?.message}>
          <Input {...register("content.hero.eyebrow")} placeholder="e.g. About us" className="h-9 rounded-lg" />
        </Field>
        <Field label="Title" error={e?.title?.message}>
          <Input
            {...register("content.hero.title")}
            placeholder="e.g. About Kerala Samajam Augsburg"
            className="h-9 rounded-lg"
          />
        </Field>
        <Field label="Highlighted word/phrase in title" error={e?.accentWord?.message}>
          <Input {...register("content.hero.accentWord")} placeholder="e.g. Kerala" className="h-9 rounded-lg" />
          <p className="text-xs text-muted-foreground">
            Must match text within the title above exactly. Leave blank for no highlight.
          </p>
        </Field>
        <Field label="Lead paragraph" error={e?.lead?.message}>
          <Textarea {...register("content.hero.lead")} rows={4} placeholder="A short paragraph under the title." />
        </Field>
      </div>
      <Field label="Hero image" error={e?.heroImageUrl?.message}>
        <ImageUpload
          onUploadComplete={(url) =>
            setValue("content.hero.heroImageUrl", url, { shouldValidate: true, shouldDirty: true })
          }
          defaultValue={heroImageUrl}
          aspect="aspect-21/9"
        />
      </Field>
    </div>
  );
}
