"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Field } from "@/components/admin/ui/field";
import { HeadingFields } from "@/components/admin/home/heading-fields";
import type { HomeContentT } from "@/lib/home-schema";

export function CommitteeFields({
  register,
  errors,
}: {
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
}) {
  const e = errors.content?.committee;

  return (
    <div className="space-y-5">
      <HeadingFields section="committee" register={register} errors={errors} />

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="How many committee members to show"
          error={e?.limit?.message}
          hint="How many committee members to show on the home page."
        >
          <Input
            type="number"
            min={1}
            max={24}
            {...register("content.committee.limit", { valueAsNumber: true })}
            className="h-9 rounded-lg"
          />
        </Field>
      </div>
    </div>
  );
}
