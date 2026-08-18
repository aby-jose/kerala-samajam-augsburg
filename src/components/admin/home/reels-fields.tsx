"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import type { HomeContentT } from "@/lib/home-schema";

export function ReelsFields({
  register,
  errors,
}: {
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
}) {
  const e = errors.content?.reels;

  return (
    <div className="space-y-5">
      <Field label="Heading" error={e?.heading?.message}>
        <Input {...register("content.reels.heading")} className="h-9 rounded-lg" />
      </Field>
      <Field label="Subheading" error={e?.subheading?.message}>
        <Textarea {...register("content.reels.subheading")} rows={2} />
      </Field>

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="How many reels to show"
          error={e?.maxCount?.message}
          hint="Which reels appear is curated from the Reels admin screen."
        >
          <Input
            type="number"
            min={1}
            max={20}
            {...register("content.reels.maxCount", { valueAsNumber: true })}
            className="h-9 rounded-lg"
          />
        </Field>
      </div>
    </div>
  );
}
