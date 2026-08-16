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
import { savePageContent } from "@/lib/page-content/actions";
import { contactContentSchema, type ContactContentT } from "@/lib/page-content/contact";

type Section = "hero" | "form" | "faq" | "visit";

/** Eyebrow, title, accent and lead — the four fields every section shares. */
function HeadingFields({
  register,
  errors,
  section,
}: {
  register: UseFormRegister<ContactContentT>;
  errors: FieldErrors<ContactContentT>;
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

export function ContactContentEditor({ initialData }: { initialData: ContactContentT }) {
  const { success, error: toastError } = useToast();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ContactContentT>({
    resolver: zodResolver(contactContentSchema),
    defaultValues: initialData,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "faq.items" });

  const onSubmit = async (data: ContactContentT) => {
    try {
      await savePageContent("contact", data);
      success("Contact page saved");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {(["hero", "form", "faq", "visit"] as const).map((section) => (
        <section key={section} className={cardSurface}>
          <header className={panelHeader}>
            <h2 className="font-sans text-sm font-semibold capitalize text-foreground">
              {section === "visit" ? "Come say hello" : section}
            </h2>
          </header>
          <div className="space-y-4 p-5">
            <HeadingFields register={register} errors={errors} section={section} />

            {section === "faq" && (
              <div className="space-y-4 border-t border-border pt-4">
                {fields.map((field, i) => (
                  <div key={field.id} className="space-y-3 rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Field
                        label={`Question ${i + 1}`}
                        error={errors.faq?.items?.[i]?.question?.message}
                        className="flex-1"
                      >
                        <Input {...register(`faq.items.${i}.question`)} />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => remove(i)}
                        disabled={fields.length === 1}
                        aria-label={`Remove question ${i + 1}`}
                        className="mt-7 shrink-0 text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Field
                      label="Answer"
                      error={errors.faq?.items?.[i]?.answer?.message}
                      hint="Link with [label](/path) — for example [membership page](/membership)."
                    >
                      <Textarea rows={3} {...register(`faq.items.${i}.answer`)} />
                    </Field>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => append({ question: "", answer: "" })}
                  className="h-9 rounded-lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add question
                </Button>
              </div>
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
