"use client";

import type { UseFormRegister, FieldErrors } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { HeadingFields } from "@/components/admin/home/heading-fields";
import type { HomeContentT } from "@/lib/home-schema";

export function EventsFields({
  register,
  errors,
}: {
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
}) {
  const e = errors.content?.events;

  return (
    <div className="space-y-5">
      <HeadingFields section="events" register={register} errors={errors} />

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label="How many events to show"
          error={e?.count?.message}
          hint="1 to 8."
        >
          <Input
            type="number"
            min={1}
            max={8}
            {...register("content.events.count", { valueAsNumber: true })}
            className="h-9 rounded-lg"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA label" error={e?.cta?.label?.message}>
          <Input {...register("content.events.cta.label")} className="h-9 rounded-lg" />
        </Field>
        <Field label="CTA link" error={e?.cta?.href?.message}>
          <Input {...register("content.events.cta.href")} className="h-9 rounded-lg" />
        </Field>
      </div>

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="space-y-5">
        <h3 className="font-sans text-sm font-semibold text-foreground">Empty state</h3>
        <Field label="Title" error={e?.empty?.title?.message}>
          <Input {...register("content.events.empty.title")} className="h-9 rounded-lg" />
        </Field>
        <Field label="Body" error={e?.empty?.body?.message}>
          <Textarea {...register("content.events.empty.body")} rows={3} />
        </Field>
      </div>
    </div>
  );
}
