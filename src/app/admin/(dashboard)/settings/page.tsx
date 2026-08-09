"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { uploadLogo } from "@/lib/upload-actions";
import {
  Save,
  Loader2,
  Globe,
  Palette,
  Mail,
  Share2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Upload,
  Image as ImageIcon,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { saveConfig, fetchConfigAction } from "@/lib/config-actions";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/ui/page-header";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cardSurface, panelHeader, chipTone } from "@/components/admin/ui/surface";

const settingsSchema = z.object({
  siteName: z.string().min(2, "Site name is required"),
  siteDescription: z.string().min(10, "Description must be at least 10 characters"),
  tagline: z.string().optional(),
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  footerText: z.string().optional(),
  branding: z.object({
    primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
    secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color"),
    logoUrl: z.string().optional(),
  }),
  socials: z.object({
    facebook: z.string().url().optional().or(z.literal("")),
    instagram: z.string().url().optional().or(z.literal("")),
    twitter: z.string().url().optional().or(z.literal("")),
    youtube: z.string().url().optional().or(z.literal("")),
  }),
  email: z.object({
    fromName: z.string().min(2),
    fromEmail: z.string().email(),
  }),
  features: z.object({
    enableRegistration: z.boolean(),
    enableGallery: z.boolean(),
    enableMembership: z.boolean(),
    maintenanceMode: z.boolean(),
  }),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const tabs = [
  { id: "general", label: "General", icon: Globe, description: "Basic site info and contact details" },
  { id: "branding", label: "Branding", icon: Palette, description: "Colors, logos and visual identity" },
  { id: "features", label: "Modules", icon: Layers, description: "Toggle site features and maintenance" },
  { id: "email", label: "Email", icon: Mail, description: "Outgoing mail and notifications" },
  { id: "socials", label: "Social", icon: Share2, description: "Links to social media platforms" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const { success, error: toastError } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const data = await fetchConfigAction();
        reset(data as any);
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchConfig();
  }, [reset]);

  const onSubmit = async (data: SettingsFormValues) => {
    setIsSaving(true);
    setIsSaved(false);

    try {
      const result = await saveConfig(data as any);
      if (result.success) {
        setIsSaved(true);
        success("System settings updated successfully");
        setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (err: any) {
      toastError(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  const primaryColor = watch("branding.primaryColor");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Site configuration and platform preferences."
      >
        <Button
          variant="outline"
          onClick={() => reset()}
          disabled={isSaving}
          className="h-9 rounded-lg"
        >
          Discard
        </Button>
        <Button
          onClick={handleSubmit(onSubmit)}
          className="h-9 rounded-lg"
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isSaved ? (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isSaving ? "Saving…" : isSaved ? "Saved" : "Save changes"}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Navigation Sidebar */}
        <div className="space-y-0.5 md:col-span-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-9">
          <form className="space-y-6">
            <div key={activeTab} className="space-y-6 animate-in fade-in duration-300">
              {activeTab === "general" && (
                <section className={cardSurface}>
                  <header className={panelHeader}>
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone("blue"))}>
                        <Globe className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-sans text-sm font-semibold text-foreground">General information</h2>
                        <p className="text-xs text-muted-foreground">Basic identity and contact details for the site.</p>
                      </div>
                    </div>
                  </header>
                  <div className="space-y-4 p-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="siteName" className="text-sm font-medium">Site name</Label>
                        <Input id="siteName" {...register("siteName")} className="h-9 rounded-lg" placeholder="e.g. Kerala Samajam Augsburg" />
                        {errors.siteName && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.siteName.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tagline" className="text-sm font-medium">Tagline</Label>
                        <Input id="tagline" {...register("tagline")} className="h-9 rounded-lg" placeholder="Connecting Hearts, Celebrating Culture" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="siteDescription" className="text-sm font-medium">Site description</Label>
                      <textarea
                        id="siteDescription"
                        {...register("siteDescription")}
                        rows={3}
                        className="flex min-h-[96px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                        placeholder="Describe your organization for search engines…"
                      />
                      <p className="text-xs text-muted-foreground">Used as the meta description in search results.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="contactEmail" className="text-sm font-medium">Contact email</Label>
                        <Input id="contactEmail" {...register("contactEmail")} className="h-9 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contactPhone" className="text-sm font-medium">Contact phone</Label>
                        <Input id="contactPhone" {...register("contactPhone")} className="h-9 rounded-lg" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="footerText" className="text-sm font-medium">Footer text</Label>
                      <Input id="footerText" {...register("footerText")} className="h-9 rounded-lg" placeholder="© 2024 Your Organization. All rights reserved." />
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "branding" && (
                <section className={cardSurface}>
                  <header className={panelHeader}>
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone("violet"))}>
                        <Palette className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-sans text-sm font-semibold text-foreground">Branding</h2>
                        <p className="text-xs text-muted-foreground">Colors and logo that define the site's visual identity.</p>
                      </div>
                    </div>
                  </header>
                  <div className="space-y-4 p-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Primary color</Label>
                          <div className="flex items-center gap-3">
                            <div
                              className="h-9 w-9 shrink-0 rounded-lg border border-border"
                              style={{ backgroundColor: primaryColor }}
                            />
                            <Input {...register("branding.primaryColor")} className="h-9 rounded-lg font-mono" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Secondary color</Label>
                          <div className="flex items-center gap-3">
                            <div
                              className="h-9 w-9 shrink-0 rounded-lg border border-border"
                              style={{ backgroundColor: watch("branding.secondaryColor") }}
                            />
                            <Input {...register("branding.secondaryColor")} className="h-9 rounded-lg font-mono" />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-muted/30 p-5">
                        <p className="text-xs font-medium text-muted-foreground">Preview</p>
                        <div className="mt-3 space-y-3">
                          <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: primaryColor }} />
                          <div className="space-y-1">
                            <h3 className="font-sans text-base font-semibold text-foreground">Heritage &amp; Culture</h3>
                            <p className="text-xs text-muted-foreground">How the selected colors appear on site elements.</p>
                          </div>
                          <Button
                            type="button"
                            className="h-9 rounded-lg"
                            style={{ backgroundColor: primaryColor }}
                          >
                            Action button
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Logo</Label>
                      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6">
                        <div className="flex flex-col items-center justify-center text-center">
                          {watch("branding.logoUrl") ? (
                            <div className="relative mb-4">
                              <div className="h-20 w-20 overflow-hidden rounded-xl border border-border bg-white">
                                <img
                                  src={watch("branding.logoUrl")}
                                  alt="Site logo"
                                  className="h-full w-full object-contain p-2"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setValue("branding.logoUrl", "")}
                                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                                aria-label="Remove logo"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className={cn("mb-4 flex h-16 w-16 items-center justify-center rounded-xl", chipTone("violet"))}>
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}

                          <div className="space-y-1">
                            <h4 className="font-sans text-sm font-semibold text-foreground">Site logo</h4>
                            <p className="mx-auto max-w-xs text-xs text-muted-foreground">
                              Recommended size: 512x512px. Transparent PNG or SVG preferred.
                            </p>
                          </div>

                          <div className="mt-4 flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*";
                                input.onchange = async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (!file) return;

                                  const formData = new FormData();
                                  formData.append("file", file);

                                  const res = await uploadLogo(formData);
                                  if (res.url) {
                                    setValue("branding.logoUrl", res.url);
                                    success("Logo uploaded successfully");
                                  } else {
                                    toastError(res.error || "Failed to upload logo");
                                  }
                                };
                                input.click();
                              }}
                              className="h-9 rounded-lg"
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload logo
                            </Button>

                            <Input
                              {...register("branding.logoUrl")}
                              placeholder="Or paste an image URL…"
                              className="h-9 w-full rounded-lg sm:max-w-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "features" && (
                <section className={cardSurface}>
                  <header className={panelHeader}>
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone("primary"))}>
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-sans text-sm font-semibold text-foreground">Modules</h2>
                        <p className="text-xs text-muted-foreground">Enable or disable core platform functionality.</p>
                      </div>
                    </div>
                  </header>
                  <div className="p-5">
                    <div className="divide-y divide-border">
                      <div className="flex items-center justify-between gap-4 py-4 first:pt-0">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-medium text-foreground">Event registration</h4>
                          <p className="text-xs text-muted-foreground">Allow public users to sign up and pay for events.</p>
                        </div>
                        <Switch
                          checked={watch("features.enableRegistration")}
                          onCheckedChange={(val) => setValue("features.enableRegistration", val)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 py-4">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-medium text-foreground">Member portal</h4>
                          <p className="text-xs text-muted-foreground">Enable paid membership plans and recurring benefits.</p>
                        </div>
                        <Switch
                          checked={watch("features.enableMembership")}
                          onCheckedChange={(val) => setValue("features.enableMembership", val)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 py-4">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-medium text-foreground">Community gallery</h4>
                          <p className="text-xs text-muted-foreground">Showcase photos and allow members to contribute media.</p>
                        </div>
                        <Switch
                          checked={watch("features.enableGallery")}
                          onCheckedChange={(val) => setValue("features.enableGallery", val)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-4 dark:border-red-500/20 dark:bg-red-500/10">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <h4 className="text-sm font-medium text-red-600 dark:text-red-400">Maintenance mode</h4>
                        </div>
                        <p className="max-w-md text-xs text-muted-foreground">
                          Lock the entire public site with a maintenance screen. Only admins can access the portal during this time.
                        </p>
                      </div>
                      <Switch
                        checked={watch("features.maintenanceMode")}
                        onCheckedChange={(val) => setValue("features.maintenanceMode", val)}
                        className="data-[state=checked]:bg-red-600"
                      />
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "email" && (
                <section className={cardSurface}>
                  <header className={panelHeader}>
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone("emerald"))}>
                        <Mail className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-sans text-sm font-semibold text-foreground">Email</h2>
                        <p className="text-xs text-muted-foreground">How the system communicates with users.</p>
                      </div>
                    </div>
                  </header>
                  <div className="space-y-4 p-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Sender name</Label>
                        <Input {...register("email.fromName")} className="h-9 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Sender email</Label>
                        <Input {...register("email.fromEmail")} className="h-9 rounded-lg" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-medium text-foreground">Email service provider</h4>
                        <p className="text-xs text-muted-foreground">
                          Outgoing email is sent via Resend.
                        </p>
                      </div>
                      <Button variant="outline" type="button" className="h-9 shrink-0 rounded-lg">
                        Send test email
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "socials" && (
                <section className={cardSurface}>
                  <header className={panelHeader}>
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone("amber"))}>
                        <Share2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-sans text-sm font-semibold text-foreground">Social links</h2>
                        <p className="text-xs text-muted-foreground">Links to your community's social media profiles.</p>
                      </div>
                    </div>
                  </header>
                  <div className="space-y-4 p-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Facebook URL</Label>
                        <Input {...register("socials.facebook")} placeholder="https://fb.com/..." className="h-9 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Instagram URL</Label>
                        <Input {...register("socials.instagram")} placeholder="https://instagr.am/..." className="h-9 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Twitter/X URL</Label>
                        <Input {...register("socials.twitter")} placeholder="https://x.com/..." className="h-9 rounded-lg" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">YouTube channel</Label>
                        <Input {...register("socials.youtube")} placeholder="https://youtube.com/..." className="h-9 rounded-lg" />
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="space-y-1.5 md:col-span-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="md:col-span-9">
          <div className={cardSurface}>
            <div className="border-b border-border px-5 py-4">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="space-y-4 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
