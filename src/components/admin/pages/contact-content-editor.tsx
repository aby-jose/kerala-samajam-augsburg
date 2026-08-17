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
import { savePageContent } from "@/lib/page-content/actions";
import { CONTACT_SECTION_META } from "@/lib/page-content/contact-sections";
import { contactContentSchema, type ContactContentT, type ContactSectionId } from "@/lib/page-content/contact";

type HeadingSection = "hero" | "form" | "faq" | "visit";

/** Eyebrow, title, accent and lead — the four fields every section shares. */
function HeadingFields({
  register,
  errors,
  section,
}: {
  register: UseFormRegister<ContactContentT>;
  errors: FieldErrors<ContactContentT>;
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

export function ContactContentEditor({ initialData }: { initialData: ContactContentT }) {
  const { success, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContactContentT>({
    resolver: zodResolver(contactContentSchema),
    defaultValues: initialData,
  });

  const { fields, move, update } = useFieldArray({ control, name: "layout" });
  const { fields: faqFields, append: appendFaq, remove: removeFaq } = useFieldArray({
    control,
    name: "content.faq.items",
  });

  // `fields` entries carry react-hook-form's own generated `id`, which
  // shadows our section id of the same name — reading `field.id` would hand
  // you a uuid and CONTACT_SECTION_META[uuid] is undefined. Take the values
  // from watch() and use `field.id` only as the React key, where a stable
  // generated id is exactly what you want across a move().
  const layout = watch("layout");

  const onSubmit = async (data: ContactContentT) => {
    try {
      await savePageContent("contact", data);
      reset(data);
      success("Contact page saved");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  // The page header is pinned to the top, so nothing may move above index 1.
  const firstMovable = 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PageHeader
        title="Contact Page"
        description="Edit the copy and the order of the sections on the public Contact page."
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
        const meta = CONTACT_SECTION_META[entry.id as ContactSectionId];

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
            {(entry.id === "hero" || entry.id === "form" || entry.id === "visit") && (
              <HeadingFields register={register} errors={errors} section={entry.id} />
            )}

            {entry.id === "faq" && (
              <>
                <HeadingFields register={register} errors={errors} section="faq" />

                <div className="space-y-4 border-t border-border pt-4">
                  {faqFields.map((field, i) => (
                    <div key={field.id} className="space-y-3 rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Field
                          label={`Question ${i + 1}`}
                          error={errors.content?.faq?.items?.[i]?.question?.message}
                          className="flex-1"
                        >
                          <Input {...register(`content.faq.items.${i}.question`)} />
                        </Field>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeFaq(i)}
                          disabled={faqFields.length === 1}
                          aria-label={`Remove question ${i + 1}`}
                          className="mt-7 shrink-0 text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Field
                        label="Answer"
                        error={errors.content?.faq?.items?.[i]?.answer?.message}
                        hint="Link with [label](/path) — for example [membership page](/membership)."
                      >
                        <Textarea rows={3} {...register(`content.faq.items.${i}.answer`)} />
                      </Field>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => appendFaq({ question: "", answer: "" })}
                    disabled={faqFields.length >= 12}
                    className="h-9 rounded-lg"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add question
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
