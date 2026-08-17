"use client";

import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import ImageUpload from "@/components/admin/image-upload";
import type { HomeContentT } from "@/lib/home-schema";

/**
 * The hero section's fields. Every later section editor copies this shape:
 * it receives the parent form's `register`, `errors`, `watch` and `setValue`,
 * and registers under a fixed `content.<id>.*` path.
 */
export function HeroFields({
  register,
  errors,
  watch,
  setValue,
}: {
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
  watch: UseFormWatch<HomeContentT>;
  setValue: UseFormSetValue<HomeContentT>;
}) {
  const e = errors.content?.hero;
  const videoUrl = watch("content.hero.videoUrl");
  const posterUrl = watch("content.hero.posterUrl");

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <div className="space-y-5">
        <Field label="Badge" error={e?.badge?.message}>
          <Input {...register("content.hero.badge")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Headline" error={e?.headline?.message}>
          <Input {...register("content.hero.headline")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Highlighted word/phrase in headline" error={e?.accentWord?.message}>
          <Input {...register("content.hero.accentWord")} className="h-9 rounded-lg" />
          <p className="text-xs text-muted-foreground">
            Must match text within the headline above exactly. Leave blank for no highlight.
          </p>
        </Field>
        <Field label="Sub-copy" error={e?.lead?.message}>
          <Textarea {...register("content.hero.lead")} rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary button label" error={e?.primaryCta?.label?.message}>
            <Input {...register("content.hero.primaryCta.label")} className="h-9 rounded-lg" />
          </Field>
          <Field label="Primary button link" error={e?.primaryCta?.href?.message}>
            <Input {...register("content.hero.primaryCta.href")} className="h-9 rounded-lg" />
          </Field>
          <Field label="Second button label" error={e?.secondaryCta?.label?.message}>
            <Input {...register("content.hero.secondaryCta.label")} className="h-9 rounded-lg" />
          </Field>
          <Field label="Second button link" error={e?.secondaryCta?.href?.message}>
            <Input {...register("content.hero.secondaryCta.href")} className="h-9 rounded-lg" />
          </Field>
        </div>
      </div>

      <div className="space-y-5">
        <Field label="Background video" error={e?.videoUrl?.message}>
          <ImageUpload
            accept="video/*"
            onUploadComplete={(url) =>
              setValue("content.hero.videoUrl", url, { shouldValidate: true, shouldDirty: true })
            }
            defaultValue={videoUrl}
            aspect="aspect-video"
          />
        </Field>
        <Field label="Poster image" error={e?.posterUrl?.message}>
          <ImageUpload
            onUploadComplete={(url) =>
              setValue("content.hero.posterUrl", url, { shouldValidate: true, shouldDirty: true })
            }
            defaultValue={posterUrl}
            aspect="aspect-video"
          />
          <p className="text-xs text-muted-foreground">
            Shown while the video loads, and instead of it for visitors who prefer reduced motion.
          </p>
        </Field>
      </div>
    </div>
  );
}
