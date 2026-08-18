"use client";

import { useFieldArray, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/home/section-card";
import { AboutHeroFields } from "@/components/admin/about/hero-fields";
import { AboutStoryFields } from "@/components/admin/about/story-fields";
import { saveAboutContent } from "@/lib/about-actions";
import { aboutContentSchema, type AboutContentT } from "@/lib/about-schema";
import { ABOUT_SECTION_META } from "@/lib/about-sections";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import type { UseFormRegister, FieldErrors } from "react-hook-form";

function AboutHeadingFields({
  section,
  register,
  errors,
}: {
  section: "whatsappCta";
  register: UseFormRegister<AboutContentT>;
  errors: FieldErrors<AboutContentT>;
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

export function AboutContentEditor({ initialData }: { initialData: AboutContentT }) {
  const { success, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AboutContentT>({
    resolver: zodResolver(aboutContentSchema),
    defaultValues: initialData,
  });

  const { fields, move, update } = useFieldArray({ control, name: "layout" });

  // `fields` entries carry react-hook-form's own generated `id`, which
  // shadows our section id of the same name — reading `field.id` would hand
  // you a uuid and ABOUT_SECTION_META[uuid] is undefined. Take the values
  // from watch() and use `field.id` only as the React key, where a stable
  // generated id is exactly what you want across a move().
  const layout = watch("layout");

  const onSubmit: SubmitHandler<AboutContentT> = async (data) => {
    try {
      await saveAboutContent(data);
      reset(data);
      success("About page updated.");
    } catch (err) {
      console.error("Failed to save about content:", err);
      toastError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  // The page header is pinned to the top, so nothing may move above index 1.
  const firstMovable = 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PageHeader
        title="About Page"
        description="Edit the copy, images and order of the sections on the public About page."
      >
        <Button type="submit" disabled={isSubmitting || !isDirty} className="h-9 rounded-lg">
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save changes
        </Button>
      </PageHeader>

      {fields.map((field, index) => {
        const entry = layout[index];
        if (!entry) return null;
        const meta = ABOUT_SECTION_META[entry.id];

        return (
          <SectionCard
            key={field.id}
            label={meta.label}
            description={meta.description}
            movable={meta.movable}
            hideable={meta.hideable}
            visible={entry.visible}
            onVisibleChange={(next) => update(index, { id: entry.id, visible: next })}
            onMoveUp={meta.movable && index > firstMovable ? () => move(index, index - 1) : undefined}
            onMoveDown={
              meta.movable && index < fields.length - 1 ? () => move(index, index + 1) : undefined
            }
          >
            {entry.id === "hero" && (
              <AboutHeroFields register={register} errors={errors} watch={watch} setValue={setValue} />
            )}
            {entry.id === "story" && (
              <AboutStoryFields control={control} register={register} errors={errors} />
            )}
            {entry.id === "committee" && (
              <p className="text-sm text-muted-foreground">
                This section has no editable text — it lists the committee from Team Members, live.
              </p>
            )}
            {entry.id === "closing" && (
              <p className="text-sm text-muted-foreground">
                This section has no editable text — it lists upcoming events, live.
              </p>
            )}
            {entry.id === "whatsappCta" && (
              <AboutHeadingFields register={register} errors={errors} section="whatsappCta" />
            )}
          </SectionCard>
        );
      })}
    </form>
  );
}
