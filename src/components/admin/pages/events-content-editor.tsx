"use client";

import { useFieldArray, useForm, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/admin/ui/field";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/home/section-card";
import { useToast } from "@/components/ui/toast";
import { savePageContent } from "@/lib/page-content/actions";
import { EVENTS_SECTION_META } from "@/lib/page-content/events-sections";
import { eventsContentSchema, type EventsContentT, type EventsSectionId } from "@/lib/page-content/events";

type HeadingSection = "hero" | "calendar" | "membersBand";

/** Eyebrow, title, accent and lead — the four fields every section shares. */
function HeadingFields({
  register,
  errors,
  section,
}: {
  register: UseFormRegister<EventsContentT>;
  errors: FieldErrors<EventsContentT>;
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

export function EventsContentEditor({ initialData }: { initialData: EventsContentT }) {
  const { success, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EventsContentT>({
    resolver: zodResolver(eventsContentSchema),
    defaultValues: initialData,
  });

  const { fields, move, update } = useFieldArray({ control, name: "layout" });

  // `fields` entries carry react-hook-form's own generated `id`, which
  // shadows our section id of the same name — reading `field.id` would hand
  // you a uuid and EVENTS_SECTION_META[uuid] is undefined. Take the values
  // from watch() and use `field.id` only as the React key, where a stable
  // generated id is exactly what you want across a move().
  const layout = watch("layout");

  const onSubmit = async (data: EventsContentT) => {
    try {
      await savePageContent("events", data);
      reset(data);
      success("Events page saved");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  // The page header is pinned to the top, so nothing may move above index 1.
  const firstMovable = 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PageHeader
        title="Events Page"
        description="Edit the copy and the order of the sections on the public Events page."
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
        const meta = EVENTS_SECTION_META[entry.id as EventsSectionId];

        return (
          <SectionCard
            key={field.id}
            label={meta.label}
            description={meta.description}
            movable={meta.movable}
            visible={entry.visible}
            onVisibleChange={(next) => update(index, { id: entry.id, visible: next })}
            onMoveUp={meta.movable && index > firstMovable ? () => move(index, index - 1) : undefined}
            onMoveDown={
              meta.movable && index < fields.length - 1 ? () => move(index, index + 1) : undefined
            }
          >
            <HeadingFields register={register} errors={errors} section={entry.id as HeadingSection} />
          </SectionCard>
        );
      })}
    </form>
  );
}
