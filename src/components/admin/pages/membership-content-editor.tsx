"use client";

import { useFieldArray, useForm, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/home/section-card";
import { useToast } from "@/components/ui/toast";
import ImageUpload from "@/components/admin/image-upload";
import { savePageContent } from "@/lib/page-content/actions";
import { MEMBERSHIP_SECTION_META } from "@/lib/page-content/membership-sections";
import {
  membershipContentSchema,
  MEMBERSHIP_ICONS,
  type MembershipContentT,
  type MembershipSectionId,
} from "@/lib/page-content/membership";

type HeadingSection = "hero" | "plans" | "benefits" | "whatsappCta";

/** Eyebrow, title, accent and lead — the four fields every section shares. */
function HeadingFields({
  register,
  errors,
  section,
}: {
  register: UseFormRegister<MembershipContentT>;
  errors: FieldErrors<MembershipContentT>;
  section: HeadingSection;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Eyebrow" error={errors?.content?.[section]?.eyebrow?.message}>
        <Input {...register(`content.${section}.eyebrow`)} />
      </Field>
      <Field label="Title" error={errors?.content?.[section]?.title?.message}>
        <Input {...register(`content.${section}.title`)} />
      </Field>
      <Field
        label="Accent word"
        error={errors?.content?.[section]?.accentWord?.message}
        hint="Must appear in the title. Rendered in serif italic."
      >
        <Input {...register(`content.${section}.accentWord`)} />
      </Field>
      <Field label="Lead" error={errors?.content?.[section]?.lead?.message} className="md:col-span-2">
        <Textarea rows={3} {...register(`content.${section}.lead`)} />
      </Field>
    </div>
  );
}

export function MembershipContentEditor({ initialData }: { initialData: MembershipContentT }) {
  const { success, error: toastError } = useToast();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MembershipContentT>({
    resolver: zodResolver(membershipContentSchema),
    defaultValues: initialData,
  });

  const { fields, move, update } = useFieldArray({ control, name: "layout" });
  const { fields: benefitFields, append: appendBenefit, remove: removeBenefit } = useFieldArray({
    control,
    name: "content.benefits.items",
  });
  const imageUrl = watch("content.benefits.imageUrl");

  // `fields` entries carry react-hook-form's own generated `id`, which
  // shadows our section id of the same name — reading `field.id` would hand
  // you a uuid and MEMBERSHIP_SECTION_META[uuid] is undefined. Take the
  // values from watch() and use `field.id` only as the React key, where a
  // stable generated id is exactly what you want across a move().
  const layout = watch("layout");

  const onSubmit = async (data: MembershipContentT) => {
    try {
      await savePageContent("membership", data);
      reset(data);
      success("Membership page saved");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  // The page header is pinned to the top, so nothing may move above index 1.
  const firstMovable = 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PageHeader
        title="Membership Page"
        description="Edit the copy, image and order of the sections on the public Membership page."
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
        const meta = MEMBERSHIP_SECTION_META[entry.id as MembershipSectionId];

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
            {(entry.id === "hero" || entry.id === "plans" || entry.id === "whatsappCta") && (
              <HeadingFields register={register} errors={errors} section={entry.id} />
            )}

            {entry.id === "benefits" && (
              <>
                <HeadingFields register={register} errors={errors} section="benefits" />

                <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
                  <Field label="Image" error={errors.content?.benefits?.imageUrl?.message}>
                    <ImageUpload
                      onUploadComplete={(url) =>
                        setValue("content.benefits.imageUrl", url, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                      defaultValue={imageUrl}
                      aspect="aspect-square"
                    />
                  </Field>
                  <Field label="Image alt text" error={errors.content?.benefits?.imageAlt?.message}>
                    <Textarea rows={3} {...register("content.benefits.imageAlt")} />
                  </Field>
                </div>

                <div className="space-y-4 border-t border-border pt-4">
                  {benefitFields.map((field, i) => (
                    <div key={field.id} className="space-y-3 rounded-xl border border-border p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr]">
                        <Field
                          label="Icon"
                          error={errors.content?.benefits?.items?.[i]?.icon?.message}
                        >
                          <select
                            {...register(`content.benefits.items.${i}.icon`)}
                            className="h-9 w-full rounded-lg border border-muted/60 bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                          >
                            {MEMBERSHIP_ICONS.map((icon) => (
                              <option key={icon} value={icon}>
                                {icon}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <div className="flex items-start justify-between gap-3">
                          <Field
                            label={`Title ${i + 1}`}
                            error={errors.content?.benefits?.items?.[i]?.title?.message}
                            className="flex-1"
                          >
                            <Input {...register(`content.benefits.items.${i}.title`)} />
                          </Field>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeBenefit(i)}
                            disabled={benefitFields.length === 1}
                            aria-label={`Remove benefit ${i + 1}`}
                            className="mt-7 shrink-0 text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Field
                        label="Description"
                        error={errors.content?.benefits?.items?.[i]?.description?.message}
                      >
                        <Textarea rows={3} {...register(`content.benefits.items.${i}.description`)} />
                      </Field>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendBenefit({ icon: "Globe", title: "", description: "" })}
                    disabled={benefitFields.length >= 8}
                    className="h-9 rounded-lg"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add benefit
                  </Button>
                </div>
              </>
            )}
          </SectionCard>
        );
      })}
    </form>
  );
}
