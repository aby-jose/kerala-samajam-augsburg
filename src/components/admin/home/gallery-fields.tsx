"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Field } from "@/components/admin/ui/field";
import { HeadingFields } from "@/components/admin/home/heading-fields";
import type { HomeContentT } from "@/lib/home-schema";

export function GalleryFields({
  register,
  errors,
}: {
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
}) {
  const e = errors.content?.gallery;

  return (
    <div className="space-y-5">
      <HeadingFields section="gallery" register={register} errors={errors} />

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Link label" error={e?.link?.label?.message}>
          <Input {...register("content.gallery.link.label")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Link href" error={e?.link?.href?.message}>
          <Input {...register("content.gallery.link.href")} className="h-9 rounded-lg" />
        </Field>
      </div>
    </div>
  );
}
