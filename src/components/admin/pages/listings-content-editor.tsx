"use client";

import { useForm, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { cardSurface, panelHeader } from "@/components/admin/ui/surface";
import { useToast } from "@/components/ui/toast";
import { savePageContent } from "@/lib/page-content/actions";
import { listingsContentSchema, type ListingsContentT } from "@/lib/page-content/listings";

type Section =
  | "eventsHero"
  | "eventsCalendar"
  | "eventsMembersBand"
  | "galleryHero"
  | "galleryAlbums"
  | "galleryContribute";

/** One document, two pages — grouped so the screen reads as the pages it edits. */
const GROUPS: { label: string; sections: Section[] }[] = [
  { label: "Events page", sections: ["eventsHero", "eventsCalendar", "eventsMembersBand"] },
  { label: "Gallery page", sections: ["galleryHero", "galleryAlbums", "galleryContribute"] },
];

const SECTION_LABELS: Record<Section, string> = {
  eventsHero: "Hero",
  eventsCalendar: "Calendar",
  eventsMembersBand: "Members band",
  galleryHero: "Hero",
  galleryAlbums: "Albums",
  galleryContribute: "Contribute",
};

/** Eyebrow, title, accent and lead — the four fields every section shares. */
function HeadingFields({
  register,
  errors,
  section,
}: {
  register: UseFormRegister<ListingsContentT>;
  errors: FieldErrors<ListingsContentT>;
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
      <Field
        label="Lead"
        error={errors?.[section]?.lead?.message}
        className="md:col-span-2"
        hint={
          section === "galleryAlbums"
            ? "Optional. The albums grid has no lead today — leave blank to keep it that way."
            : undefined
        }
      >
        <Textarea rows={3} {...register(`${section}.lead`)} />
      </Field>
    </div>
  );
}

export function ListingsContentEditor({ initialData }: { initialData: ListingsContentT }) {
  const { success, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ListingsContentT>({
    resolver: zodResolver(listingsContentSchema),
    defaultValues: initialData,
  });

  const onSubmit = async (data: ListingsContentT) => {
    try {
      await savePageContent("listings", data);
      reset(data);
      success("Events & Gallery pages saved");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {GROUPS.map((group) => (
        <div key={group.label} className="space-y-3">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {group.label}
          </h2>
          <div className="space-y-6">
            {group.sections.map((section) => (
              <section key={section} className={cardSurface}>
                <header className={panelHeader}>
                  <h3 className="font-sans text-sm font-semibold text-foreground">
                    {SECTION_LABELS[section]}
                  </h3>
                </header>
                <div className="space-y-4 p-5">
                  <HeadingFields register={register} errors={errors} section={section} />
                </div>
              </section>
            ))}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty} className="h-10 rounded-lg px-6">
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
