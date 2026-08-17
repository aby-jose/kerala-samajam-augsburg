"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Field } from "@/components/admin/ui/field";
import { HeadingFields } from "@/components/admin/home/heading-fields";
import type { HomeContentT } from "@/lib/home-schema";

export function CtaFields({
  register,
  errors,
}: {
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
}) {
  const e = errors.content?.cta;

  return (
    <div className="space-y-5">
      <HeadingFields section="cta" register={register} errors={errors} />

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Primary button label" error={e?.primaryCta?.label?.message}>
          <Input {...register("content.cta.primaryCta.label")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Primary button link" error={e?.primaryCta?.href?.message}>
          <Input {...register("content.cta.primaryCta.href")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Second button label" error={e?.secondaryCta?.label?.message}>
          <Input {...register("content.cta.secondaryCta.label")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Second button link" error={e?.secondaryCta?.href?.message}>
          <Input {...register("content.cta.secondaryCta.href")} className="h-9 rounded-lg" />
        </Field>
      </div>
    </div>
  );
}
