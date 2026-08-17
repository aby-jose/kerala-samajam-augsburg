"use client";

import { useForm, useFieldArray, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import { useToast } from "@/components/ui/toast";
import ImageUpload from "@/components/admin/image-upload";
import { savePageContent } from "@/lib/page-content/actions";
import {
  membershipContentSchema,
  MEMBERSHIP_ICONS,
  type MembershipContentT,
} from "@/lib/page-content/membership";

type Section = "hero" | "plans" | "benefits";

/** Eyebrow, title, accent and lead — the four fields every section shares. */
function HeadingFields({
  register,
  errors,
  section,
}: {
  register: UseFormRegister<MembershipContentT>;
  errors: FieldErrors<MembershipContentT>;
  section: Section;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field label="Eyebrow" error={errors?.[section]?.eyebrow?.message}>
        <Input {...register(`${section}.eyebrow`)} />
      </Field>
      <Field label="Title" error={errors?.[section]?.title?.message}>
        <Input {...register(`${section}.title`)} />
      </Field>
      <Field
        label="Accent word"
        error={errors?.[section]?.accentWord?.message}
        hint="Must appear in the title. Rendered in serif italic."
      >
        <Input {...register(`${section}.accentWord`)} />
      </Field>
      <Field label="Lead" error={errors?.[section]?.lead?.message} className="md:col-span-2">
        <Textarea rows={3} {...register(`${section}.lead`)} />
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
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MembershipContentT>({
    resolver: zodResolver(membershipContentSchema),
    defaultValues: initialData,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "benefits.items" });
  const imageUrl = watch("benefits.imageUrl");

  const onSubmit = async (data: MembershipContentT) => {
    try {
      await savePageContent("membership", data);
      success("Membership page saved");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {(["hero", "plans", "benefits"] as const).map((section) => (
        <section key={section} className={cardSurface}>
          <header className={panelHeader}>
            <h2 className="font-sans text-sm font-semibold capitalize text-foreground">
              {section}
            </h2>
          </header>
          <div className="space-y-4 p-5">
            <HeadingFields register={register} errors={errors} section={section} />

            {section === "benefits" && (
              <>
                <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
                  <Field label="Image" error={errors.benefits?.imageUrl?.message}>
                    <ImageUpload
                      onUploadComplete={(url) =>
                        setValue("benefits.imageUrl", url, { shouldValidate: true, shouldDirty: true })
                      }
                      defaultValue={imageUrl}
                      aspect="aspect-square"
                    />
                  </Field>
                  <Field label="Image alt text" error={errors.benefits?.imageAlt?.message}>
                    <Textarea rows={3} {...register("benefits.imageAlt")} />
                  </Field>
                </div>

                <div className="space-y-4 border-t border-border pt-4">
                  {fields.map((field, i) => (
                    <div key={field.id} className="space-y-3 rounded-xl border border-border p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_1fr]">
                        <Field
                          label="Icon"
                          error={errors.benefits?.items?.[i]?.icon?.message}
                        >
                          <select
                            {...register(`benefits.items.${i}.icon`)}
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
                            error={errors.benefits?.items?.[i]?.title?.message}
                            className="flex-1"
                          >
                            <Input {...register(`benefits.items.${i}.title`)} />
                          </Field>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => remove(i)}
                            disabled={fields.length === 1}
                            aria-label={`Remove benefit ${i + 1}`}
                            className="mt-7 shrink-0 text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <Field
                        label="Description"
                        error={errors.benefits?.items?.[i]?.description?.message}
                      >
                        <Textarea rows={3} {...register(`benefits.items.${i}.description`)} />
                      </Field>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ icon: "Globe", title: "", description: "" })}
                    disabled={fields.length >= 8}
                    className="h-9 rounded-lg"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add benefit
                  </Button>
                </div>
              </>
            )}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty} className="h-10 rounded-lg px-6">
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
