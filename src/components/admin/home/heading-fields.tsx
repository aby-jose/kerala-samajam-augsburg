"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import type { HomeContentT } from "@/lib/home-schema";

type HeadingSection = "events" | "gallery" | "committee" | "join" | "cta" | "whatsappCta";

/**
 * Eyebrow, title, accent word and lead — the four fields every section past
 * hero/about shares. Written once here so the five section editors in this
 * directory don't each grow their own slightly different copy.
 */
export function HeadingFields({
  section,
  register,
  errors,
}: {
  section: HeadingSection;
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
}) {
  const e = errors.content?.[section];

  return (
    <div className="space-y-5">
      <Field label="Eyebrow" error={e?.eyebrow?.message}>
        <Input {...register(`content.${section}.eyebrow`)} className="h-9 rounded-lg" />
      </Field>
      <Field label="Title" error={e?.title?.message}>
        <Input {...register(`content.${section}.title`)} className="h-9 rounded-lg" />
      </Field>
      <Field label="Highlighted word/phrase in title" error={e?.accentWord?.message}>
        <Input {...register(`content.${section}.accentWord`)} className="h-9 rounded-lg" />
        <p className="text-xs text-muted-foreground">
          Must match text within the title above exactly. Leave blank for no highlight.
        </p>
      </Field>
      <Field label="Lead" error={e?.lead?.message}>
        <Textarea {...register(`content.${section}.lead`)} rows={3} />
      </Field>
    </div>
  );
}
