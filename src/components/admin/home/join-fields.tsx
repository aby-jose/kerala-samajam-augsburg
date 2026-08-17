"use client";

import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { MoveDown, MoveUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { HeadingFields } from "@/components/admin/home/heading-fields";
import type { HomeContentT } from "@/lib/home-schema";

export function JoinFields({
  control,
  register,
  errors,
}: {
  control: Control<HomeContentT>;
  register: UseFormRegister<HomeContentT>;
  errors: FieldErrors<HomeContentT>;
}) {
  const e = errors.content?.join;
  const steps = useFieldArray({ control, name: "content.join.steps" });

  return (
    <div className="space-y-5">
      <HeadingFields section="join" register={register} errors={errors} />

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="CTA label" error={e?.cta?.label?.message}>
          <Input {...register("content.join.cta.label")} className="h-9 rounded-lg" />
        </Field>
        <Field label="CTA link" error={e?.cta?.href?.message}>
          <Input {...register("content.join.cta.href")} className="h-9 rounded-lg" />
        </Field>
      </div>

      <hr className="border-black/[0.06] dark:border-white/[0.06]" />

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-sm font-semibold text-foreground">Steps</h3>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg"
            disabled={steps.fields.length >= 6}
            onClick={() => steps.append({ title: "", desc: "" })}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add step
          </Button>
        </div>

        {steps.fields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_auto] md:items-start"
          >
            <Field label="Title" error={errors.content?.join?.steps?.[index]?.title?.message}>
              <Input
                {...register(`content.join.steps.${index}.title` as const)}
                className="h-9 rounded-lg"
              />
            </Field>
            <Field label="Description" error={errors.content?.join?.steps?.[index]?.desc?.message}>
              <Textarea {...register(`content.join.steps.${index}.desc` as const)} rows={3} />
            </Field>
            <div className="flex gap-1 pt-6 md:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === 0}
                onClick={() => steps.move(index, index - 1)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move up"
              >
                <MoveUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={index === steps.fields.length - 1}
                onClick={() => steps.move(index, index + 1)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move down"
              >
                <MoveDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={steps.fields.length <= 1}
                onClick={() => steps.remove(index)}
                className="h-8 w-8 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                aria-label="Remove step"
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
