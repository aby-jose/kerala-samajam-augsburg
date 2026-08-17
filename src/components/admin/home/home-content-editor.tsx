"use client";

import { useFieldArray, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/home/section-card";
import { HeroFields } from "@/components/admin/home/hero-fields";
import { AboutFields } from "@/components/admin/home/about-fields";
import { EventsFields } from "@/components/admin/home/events-fields";
import { GalleryFields } from "@/components/admin/home/gallery-fields";
import { CommitteeFields } from "@/components/admin/home/committee-fields";
import { JoinFields } from "@/components/admin/home/join-fields";
import { CtaFields } from "@/components/admin/home/cta-fields";
import { saveHomeContent } from "@/lib/home-actions";
import { homeContentSchema, type HomeContentT } from "@/lib/home-schema";
import { HOME_SECTION_META } from "@/lib/home-sections";

export function HomeContentEditor({ initialData }: { initialData: HomeContentT }) {
  const { success, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HomeContentT>({
    resolver: zodResolver(homeContentSchema),
    defaultValues: initialData,
  });

  const { fields, move, update } = useFieldArray({ control, name: "layout" });

  // `fields` entries carry react-hook-form's own generated `id`, which
  // shadows our section id of the same name — reading `field.id` would hand
  // you a uuid and HOME_SECTION_META[uuid] is undefined. Take the values from
  // watch() and use `field.id` only as the React key, where a stable
  // generated id is exactly what you want across a move().
  const layout = watch("layout");

  const onSubmit: SubmitHandler<HomeContentT> = async (data) => {
    try {
      await saveHomeContent(data);
      reset(data);
      success("Home page updated.");
    } catch (err) {
      console.error("Failed to save home content:", err);
      toastError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  // The hero is pinned to the top, so nothing may move above index 1.
  const firstMovable = 1;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <PageHeader
        title="Home Page"
        description="Edit the copy, images and order of the sections on the public home page."
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
        const meta = HOME_SECTION_META[entry.id];

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
            {entry.id === "hero" && (
              <HeroFields register={register} errors={errors} watch={watch} setValue={setValue} />
            )}
            {entry.id === "about" && (
              <AboutFields
                control={control}
                register={register}
                errors={errors}
                watch={watch}
                setValue={setValue}
              />
            )}
            {entry.id === "events" && <EventsFields register={register} errors={errors} />}
            {entry.id === "gallery" && <GalleryFields register={register} errors={errors} />}
            {entry.id === "committee" && <CommitteeFields register={register} errors={errors} />}
            {entry.id === "join" && (
              <JoinFields control={control} register={register} errors={errors} />
            )}
            {entry.id === "cta" && <CtaFields register={register} errors={errors} />}
          </SectionCard>
        );
      })}
    </form>
  );
}
