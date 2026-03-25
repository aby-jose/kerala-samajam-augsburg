"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, Save, Globe, Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const eventSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters"),
  date: z.string().min(1, "Date is required"),
  location: z.string().min(3, "Location is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  imageUrl: z.string().url("Invalid image URL").optional().or(z.literal("")),
  maxAttendees: z.number().optional(),
  isPublished: z.boolean(),
});

type EventFormValues = z.infer<typeof eventSchema>;

export default function NewEventPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      isPublished: false,
    },
    mode: "onChange",
  });

  const title = watch("title");
  
  // Auto-generate slug from title
  React.useEffect(() => {
    if (title) {
      const generatedSlug = title
        .toLowerCase()
        .trim()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");
      setValue("slug", generatedSlug, { shouldValidate: true });
    }
  }, [title, setValue]);

  const onSubmit = async (data: EventFormValues) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log("Creating event:", data);
      router.push("/admin/events");
      router.refresh();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/admin/events" className="h-10 w-10 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Event</h1>
            <p className="text-muted-foreground text-sm">Fill in the details for your upcoming community event.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle>Event Details</CardTitle>
              <CardDescription>Primary information about the event.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input id="title" {...register("title")} placeholder="e.g. Vishu Celebration 2026" className="h-11 border-muted/60" />
                {errors.title && <p className="text-xs text-destructive font-medium">{errors.title.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <div className="flex group focus-within:ring-2 focus-within:ring-primary/20 rounded-md transition-all">
                  <span className="inline-flex items-center px-4 rounded-l-md border border-r-0 border-muted/60 bg-muted/30 text-muted-foreground text-xs font-mono">
                    /events/
                  </span>
                  <Input id="slug" {...register("slug")} className="rounded-l-none h-11 border-muted/60" />
                </div>
                {errors.slug && <p className="text-xs text-destructive font-medium">{errors.slug.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea 
                  id="description" 
                  {...register("description")} 
                  rows={8}
                  className="flex min-h-[160px] w-full rounded-md border border-muted/60 bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                  placeholder="Describe the event in detail..."
                />
                {errors.description && <p className="text-xs text-destructive font-medium">{errors.description.message}</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle>Logistics & Media</CardTitle>
              <CardDescription>Date, location and visual assets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="date">Event Date & Time</Label>
                  <Input id="date" type="datetime-local" {...register("date")} className="h-11 border-muted/60" />
                  {errors.date && <p className="text-xs text-destructive font-medium">{errors.date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location Name</Label>
                  <Input id="location" {...register("location")} placeholder="e.g. Augsburg Community Hall" className="h-11 border-muted/60" />
                  {errors.location && <p className="text-xs text-destructive font-medium">{errors.location.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">Feature Image URL</Label>
                <Input id="imageUrl" {...register("imageUrl")} placeholder="https://cloudinary.com/..." className="h-11 border-muted/60" />
                {errors.imageUrl && <p className="text-xs text-destructive font-medium">{errors.imageUrl.message}</p>}
                <p className="text-[10px] text-muted-foreground italic tracking-tight">Direct Cloudinary upload integration planned for final version.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle>Settings</CardTitle>
              <CardDescription>Control visibility and limits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="maxAttendees">Max Attendees (Optional)</Label>
                <Input id="maxAttendees" type="number" {...register("maxAttendees", { valueAsNumber: true })} placeholder="Unlimited if empty" className="h-11 border-muted/60" />
              </div>

              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Publish Event</Label>
                  <p className="text-[10px] text-muted-foreground">Make live on public website.</p>
                </div>
                <input 
                  type="checkbox" 
                  {...register("isPublished")} 
                  className="h-5 w-5 rounded border-muted/60 text-primary focus:ring-primary/20 transition-all cursor-pointer"
                />
              </div>

              <div className="pt-4 space-y-4">
                <Button 
                  type="submit" 
                  className="w-full h-12 font-bold shadow-xl shadow-primary/10 tracking-wide text-base" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5 text-primary-foreground/80" />
                      Save Event
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" className="w-full h-11 border-muted/60 font-medium" disabled={isLoading}>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 relative overflow-hidden group hover:border-primary/40 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-all">
              <Globe className="h-12 w-12 text-primary" />
            </div>
            <h4 className="flex items-center text-sm font-bold text-primary mb-2">
              <Globe className="mr-2 h-4 w-4" />
              Published Preview
            </h4>
            <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
              Once published, this event will be accessible to all community members at:
            </p>
            <p className="text-[11px] font-mono bg-white/50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-primary/10 truncate font-semibold text-primary/80">
              {watch("slug") ? `/events/${watch("slug")}` : "/events/example-event"}
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
