"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Landmark,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { saveConfig, fetchConfigAction } from "@/lib/config-actions";
import { sendTestEmail } from "@/lib/email-admin-actions";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
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
    automated: z.object({
      eventReminders: z.boolean(),
      postEventThankYou: z.boolean(),
      membershipLifecycle: z.boolean(),
      paymentReminders: z.boolean(),
      adminDigest: z.boolean(),
    }),
    notifications: z.object({
      eventTicket: z.boolean(),
      eventRegistrationChanges: z.boolean(),
      eventCancelledBroadcast: z.boolean(),
      eventRescheduled: z.boolean(),
      eventFull: z.boolean(),
      eventAnnouncement: z.boolean(),
      eventPaymentUpdates: z.boolean(),
      membershipApplicationReceived: z.boolean(),
      membershipApplicationDecision: z.boolean(),
      membershipActivation: z.boolean(),
      galleryContributions: z.boolean(),
      contactForm: z.boolean(),
    }),
  }),
  features: z.object({
    enableRegistration: z.boolean(),
    enableGallery: z.boolean(),
    enableMembership: z.boolean(),
    maintenanceMode: z.boolean(),
  }),
  /**
   * Facts about the association that the legal documents pull in as
   * {{placeholders}}. They live here rather than in the prose so that
   * replacing a board member is a settings edit, not a new document version
   * — and therefore does not re-prompt every member for consent.
   */
  legal: z.object({
    entityName: z.string().min(2, "Registered name is required"),
    legalForm: z.string().optional().or(z.literal("")),
    street: z.string().optional().or(z.literal("")),
    postalCode: z.string().optional().or(z.literal("")),
    city: z.string().optional().or(z.literal("")),
    country: z.string().optional().or(z.literal("")),
    registerCourt: z.string().optional().or(z.literal("")),
    registerNumber: z.string().optional().or(z.literal("")),
    vatId: z.string().optional().or(z.literal("")),
    // No `.default()` here — it would make the schema's input and output
    // types diverge, which react-hook-form's resolver rejects. getConfig()
    // always merges the defaults in, so the array is never missing.
    boardMembers: z.array(z.string()),
    responsiblePerson: z.string().optional().or(z.literal("")),
    responsiblePersonAddress: z.string().optional().or(z.literal("")),
    dpoName: z.string().optional().or(z.literal("")),
    dpoEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
    supervisoryAuthority: z.string().optional().or(z.literal("")),
    hostingProvider: z.string().optional().or(z.literal("")),
    accountHolder: z.string().optional().or(z.literal("")),
    bankName: z.string().optional().or(z.literal("")),
    iban: z.string().optional().or(z.literal("")),
    bic: z.string().optional().or(z.literal("")),
    // Same reason as `boardMembers` above: no `.default()`, because getConfig()
    // merges the defaults in and a default here would split input/output types.
    paymentTermsDays: z.number().int().min(1).max(365),
  }),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const tabs = [
  { id: "general", label: "General", icon: Globe, description: "Basic site info and contact details" },
  { id: "organisation", label: "Organisation", icon: Landmark, description: "Registered details used by the legal pages" },
  { id: "branding", label: "Branding", icon: Palette, description: "Colors, logos and visual identity" },
  { id: "features", label: "Modules", icon: Layers, description: "Toggle site features and maintenance" },
  { id: "email", label: "Email", icon: Mail, description: "Outgoing mail and notifications" },
  { id: "socials", label: "Social", icon: Share2, description: "Links to social media platforms" },
];

const TAB_IDS = tabs.map((t) => t.id);

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    requestedTab && TAB_IDS.includes(requestedTab) ? requestedTab : "general"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
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
                  </div>
                </section>
              )}

              {activeTab === "organisation" && (
                <section className={cardSurface}>
                  <header className={panelHeader}>
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone("amber"))}>
                        <Landmark className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-sans text-sm font-semibold text-foreground">Organisation</h2>
                        <p className="text-xs text-muted-foreground">Registered details the Impressum and privacy pages pull in.</p>
                      </div>
                    </div>
                  </header>

                  <div className="space-y-6 p-5">
                    <p className="rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
                      These fields are inserted into the legal pages wherever a{" "}
                      <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">{"{{placeholder}}"}</code>{" "}
                      appears, so changing a board member here updates the Impressum
                      without publishing a new document version — and without asking
                      members to consent again. Anything left blank shows on the public
                      page as an amber &ldquo;to be completed&rdquo; marker.
                    </p>

                    <FieldGroup title="Registered entity">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Registered name</Label>
                          <Input {...register("legal.entityName")} className="h-9 rounded-lg" placeholder="Kerala Samajam Augsburg e.V." />
                          {errors.legal?.entityName && (
                            <p className="mt-1 text-xs text-red-600">{errors.legal.entityName.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Legal form</Label>
                          <Input {...register("legal.legalForm")} className="h-9 rounded-lg" placeholder="Eingetragener Verein (e.V.)" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label className="text-sm font-medium">Street and number</Label>
                          <Input {...register("legal.street")} className="h-9 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Postal code</Label>
                          <Input {...register("legal.postalCode")} className="h-9 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">City</Label>
                          <Input {...register("legal.city")} className="h-9 rounded-lg" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Country</Label>
                        <Input {...register("legal.country")} className="h-9 rounded-lg md:max-w-xs" />
                      </div>
                    </FieldGroup>

                    <FieldGroup
                      title="Register entry"
                      hint="§ 5 DDG requires the register court and number for a registered association."
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Register court</Label>
                          <Input {...register("legal.registerCourt")} className="h-9 rounded-lg" placeholder="Amtsgericht Augsburg" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Register number</Label>
                          <Input {...register("legal.registerNumber")} className="h-9 rounded-lg" placeholder="VR 1234" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">VAT ID</Label>
                          <Input {...register("legal.vatId")} className="h-9 rounded-lg" placeholder="Leave blank if none" />
                        </div>
                      </div>
                    </FieldGroup>

                    <FieldGroup
                      title="Board (§ 26 BGB)"
                      hint="Everyone authorised to represent the association. Listed in the Impressum."
                    >
                      <BoardMembersField
                        members={watch("legal.boardMembers") || []}
                        onChange={(members) => setValue("legal.boardMembers", members, { shouldDirty: true })}
                      />
                    </FieldGroup>

                    <FieldGroup
                      title="Responsible for content (§ 18 Abs. 2 MStV)"
                      hint="A named person with a postal address — an email alone is not sufficient."
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Name</Label>
                          <Input {...register("legal.responsiblePerson")} className="h-9 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Address</Label>
                          <Input {...register("legal.responsiblePersonAddress")} className="h-9 rounded-lg" />
                        </div>
                      </div>
                    </FieldGroup>

                    <FieldGroup
                      title="Data protection officer"
                      hint="Optional under § 38 BDSG for small associations — but a DPO is required whenever processing needs a DPIA, which server-side face recognition likely does. Leave blank only after taking that decision deliberately."
                    >
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Name</Label>
                          <Input {...register("legal.dpoName")} className="h-9 rounded-lg" placeholder="Leave blank if none appointed" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Email</Label>
                          <Input {...register("legal.dpoEmail")} className="h-9 rounded-lg" />
                          {errors.legal?.dpoEmail && (
                            <p className="mt-1 text-xs text-red-600">{errors.legal.dpoEmail.message}</p>
                          )}
                        </div>
                      </div>
                    </FieldGroup>

                    <FieldGroup title="Processing and payments">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Supervisory authority</Label>
                        <Input {...register("legal.supervisoryAuthority")} className="h-9 rounded-lg" />
                        <p className="text-xs text-muted-foreground">Where members can complain. For Bavaria this is the BayLDA in Ansbach.</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Hosting provider</Label>
                        <Input {...register("legal.hostingProvider")} className="h-9 rounded-lg md:max-w-md" />
                      </div>

                      {/*
                        These are not decoration. With no payment gateway they
                        are the only instructions a member gets for how to pay,
                        and they are printed on the invoice PDF and in the
                        payment-request email.
                      */}
                      <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                        <div>
                          <p className="text-sm font-medium text-foreground">Bank details</p>
                          <p className="text-xs text-muted-foreground">
                            Shown to members when they apply and printed on every invoice.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Account holder</Label>
                            <Input {...register("legal.accountHolder")} className="h-9 rounded-lg" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Bank</Label>
                            <Input {...register("legal.bankName")} className="h-9 rounded-lg" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm font-medium">IBAN</Label>
                            <Input {...register("legal.iban")} className="h-9 rounded-lg font-mono text-xs" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">BIC</Label>
                            <Input {...register("legal.bic")} className="h-9 rounded-lg font-mono text-xs" />
                          </div>
                        </div>

                        <div className="space-y-2 md:max-w-xs">
                          <Label className="text-sm font-medium">Payment term (days)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            {...register("legal.paymentTermsDays", { valueAsNumber: true })}
                            className="h-9 rounded-lg"
                          />
                          <p className="text-xs text-muted-foreground">
                            How long a member has to pay before the due date shown on their invoice.
                          </p>
                        </div>
                      </div>
                    </FieldGroup>
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
                          <h4 className="font-sans text-sm font-medium text-foreground">Event registration</h4>
                          <p className="text-xs text-muted-foreground">Allow public users to sign up and pay for events.</p>
                        </div>
                        <Switch
                          checked={watch("features.enableRegistration")}
                          onCheckedChange={(val) => setValue("features.enableRegistration", val)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 py-4">
                        <div className="space-y-0.5">
                          <h4 className="font-sans text-sm font-medium text-foreground">Member portal</h4>
                          <p className="text-xs text-muted-foreground">Enable paid membership plans and recurring benefits.</p>
                        </div>
                        <Switch
                          checked={watch("features.enableMembership")}
                          onCheckedChange={(val) => setValue("features.enableMembership", val)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 py-4">
                        <div className="space-y-0.5">
                          <h4 className="font-sans text-sm font-medium text-foreground">Community gallery</h4>
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
                          <h4 className="font-sans text-sm font-medium text-red-600 dark:text-red-400">Maintenance mode</h4>
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
                        {/* The address has to belong to a domain verified with
                            the sending provider, so the deployment's
                            EMAIL_FROM wins where both are set. Saying so here
                            stops this field looking broken when it is
                            deliberately being overridden. */}
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          Must belong to a domain verified with the email provider. Overridden by the
                          EMAIL_FROM environment variable where one is set — the sender name above
                          always applies.
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="font-sans text-sm font-semibold text-foreground">Scheduled sending</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Which scheduled notices (
                        <Link href="/admin/emails" className="font-medium underline">
                          run daily by /api/cron
                        </Link>
                        ) are allowed to send. Turning one off never changes what it records —
                        a membership past its end date still moves to expired — it only
                        silences the email.
                      </p>
                      <div className="mt-3 divide-y divide-border">
                        <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
                          <div className="space-y-0.5">
                            <h4 className="font-sans text-sm font-medium text-foreground">Event reminders</h4>
                            <p className="text-xs text-muted-foreground">Two days before and on the morning of an event.</p>
                          </div>
                          <Switch
                            checked={watch("email.automated.eventReminders")}
                            onCheckedChange={(val) => setValue("email.automated.eventReminders", val, { shouldDirty: true })}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 py-3.5">
                          <div className="space-y-0.5">
                            <h4 className="font-sans text-sm font-medium text-foreground">Post-event thank-you</h4>
                            <p className="text-xs text-muted-foreground">Sent the day after, with a link to the gallery once it is up.</p>
                          </div>
                          <Switch
                            checked={watch("email.automated.postEventThankYou")}
                            onCheckedChange={(val) => setValue("email.automated.postEventThankYou", val, { shouldDirty: true })}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 py-3.5">
                          <div className="space-y-0.5">
                            <h4 className="font-sans text-sm font-medium text-foreground">Membership renewal notices</h4>
                            <p className="text-xs text-muted-foreground">Expiry warnings at 30 and 7 days out, and the notice a term has ended.</p>
                          </div>
                          <Switch
                            checked={watch("email.automated.membershipLifecycle")}
                            onCheckedChange={(val) => setValue("email.automated.membershipLifecycle", val, { shouldDirty: true })}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 py-3.5">
                          <div className="space-y-0.5">
                            <h4 className="font-sans text-sm font-medium text-foreground">Overdue payment reminders</h4>
                            <p className="text-xs text-muted-foreground">Sent when a membership fee is overdue, and again a fortnight later.</p>
                          </div>
                          <Switch
                            checked={watch("email.automated.paymentReminders")}
                            onCheckedChange={(val) => setValue("email.automated.paymentReminders", val, { shouldDirty: true })}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4 py-3.5 last:pb-0">
                          <div className="space-y-0.5">
                            <h4 className="font-sans text-sm font-medium text-foreground">Weekly committee digest</h4>
                            <p className="text-xs text-muted-foreground">Payments recorded and outstanding, sent to the admin address.</p>
                          </div>
                          <Switch
                            checked={watch("email.automated.adminDigest")}
                            onCheckedChange={(val) => setValue("email.automated.adminDigest", val, { shouldDirty: true })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="font-sans text-sm font-semibold text-foreground">Notification emails</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Mail fired by something a member or admin does, rather than by the daily cron.
                        Turning one off never changes what it records — a payment marked paid is still
                        paid — it only silences the email. Security mail (verification, password reset,
                        sign-in and email-change alerts) and GDPR notices (export, deletion) are not
                        listed here: those always send.
                      </p>

                      <NotificationGroup title="Events">
                        <NotificationToggle
                          label="Registration confirmed"
                          hint="The ticket, sent the moment someone registers."
                          checked={watch("email.notifications.eventTicket")}
                          onCheckedChange={(val) => setValue("email.notifications.eventTicket", val, { shouldDirty: true })}
                        />
                        <NotificationToggle
                          label="Registration cancelled or removed"
                          hint="A member cancels their own place, or an admin removes one."
                          checked={watch("email.notifications.eventRegistrationChanges")}
                          onCheckedChange={(val) => setValue("email.notifications.eventRegistrationChanges", val, { shouldDirty: true })}
                        />
                        <NotificationToggle
                          label="Event cancelled or reinstated"
                          hint="Broadcast to every registrant when an event is called off or back on."
                          checked={watch("email.notifications.eventCancelledBroadcast")}
                          onCheckedChange={(val) => setValue("email.notifications.eventCancelledBroadcast", val, { shouldDirty: true })}
                        />
                        <NotificationToggle
                          label="Event rescheduled"
                          hint="Broadcast when the date or venue changes."
                          checked={watch("email.notifications.eventRescheduled")}
                          onCheckedChange={(val) => setValue("email.notifications.eventRescheduled", val, { shouldDirty: true })}
                        />
                        <NotificationToggle
                          label="Event full"
                          hint="Sent to someone turned away because the event reached capacity."
                          checked={watch("email.notifications.eventFull")}
                          onCheckedChange={(val) => setValue("email.notifications.eventFull", val, { shouldDirty: true })}
                        />
                        <NotificationToggle
                          label="New event announced"
                          hint="Sent to members who opted in, once an event is published and announced."
                          checked={watch("email.notifications.eventAnnouncement")}
                          onCheckedChange={(val) => setValue("email.notifications.eventAnnouncement", val, { shouldDirty: true })}
                          last
                        />
                      </NotificationGroup>

                      <NotificationGroup title="Payments">
                        <NotificationToggle
                          label="Event fee recorded or reversed"
                          hint="Sent when an admin marks an event payment received, or undoes that."
                          checked={watch("email.notifications.eventPaymentUpdates")}
                          onCheckedChange={(val) => setValue("email.notifications.eventPaymentUpdates", val, { shouldDirty: true })}
                          last
                        />
                      </NotificationGroup>

                      <NotificationGroup title="Membership">
                        <NotificationToggle
                          label="Application received"
                          hint="Acknowledgement to the applicant, and the notice to the committee."
                          checked={watch("email.notifications.membershipApplicationReceived")}
                          onCheckedChange={(val) => setValue("email.notifications.membershipApplicationReceived", val, { shouldDirty: true })}
                        />
                        <NotificationToggle
                          label="Application verified or rejected"
                          hint="A student application is confirmed or turned down."
                          checked={watch("email.notifications.membershipApplicationDecision")}
                          onCheckedChange={(val) => setValue("email.notifications.membershipApplicationDecision", val, { shouldDirty: true })}
                        />
                        <NotificationToggle
                          label="Membership activated or renewed"
                          hint="Sent once a membership payment is recorded."
                          checked={watch("email.notifications.membershipActivation")}
                          onCheckedChange={(val) => setValue("email.notifications.membershipActivation", val, { shouldDirty: true })}
                          last
                        />
                      </NotificationGroup>

                      <NotificationGroup title="Gallery">
                        <NotificationToggle
                          label="Contribution submitted, approved or rejected"
                          hint="The admin notice for a new upload, and the member's approval/rejection notice."
                          checked={watch("email.notifications.galleryContributions")}
                          onCheckedChange={(val) => setValue("email.notifications.galleryContributions", val, { shouldDirty: true })}
                          last
                        />
                      </NotificationGroup>

                      <NotificationGroup title="Contact form" noBorder>
                        <NotificationToggle
                          label="Contact form submitted"
                          hint="The admin notice, and the acknowledgement sent back to the sender."
                          checked={watch("email.notifications.contactForm")}
                          onCheckedChange={(val) => setValue("email.notifications.contactForm", val, { shouldDirty: true })}
                          last
                        />
                      </NotificationGroup>
                    </div>

                    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <h4 className="font-sans text-sm font-medium text-foreground">Check it works</h4>
                        <p className="text-xs text-muted-foreground">
                          Sends a real message down the real path. Delivery problems show up in{" "}
                          <Link href="/admin/emails" className="font-medium underline">
                            the email log
                          </Link>
                          .
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Input
                          type="email"
                          placeholder="you@example.org"
                          value={testEmailAddress}
                          onChange={(e) => setTestEmailAddress(e.target.value)}
                          className="h-9 w-44 rounded-lg"
                        />
                        <Button
                          variant="outline"
                          type="button"
                          className="h-9 shrink-0 rounded-lg"
                          disabled={sendingTest || !testEmailAddress.trim()}
                          onClick={async () => {
                            setSendingTest(true);
                            try {
                              await sendTestEmail(testEmailAddress.trim());
                              success(`Test sent — check ${testEmailAddress}`);
                            } catch (e: any) {
                              toastError(`Test failed: ${e.message}`);
                            } finally {
                              setSendingTest(false);
                            }
                          }}
                        >
                          {sendingTest ? "Sending…" : "Send test"}
                        </Button>
                      </div>
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

export default function SettingsClient() {
  return (
    <React.Suspense fallback={<SettingsSkeleton />}>
      <SettingsPageContent />
    </React.Suspense>
  );
}

/** Titled block inside the Organisation tab, so the form reads as sections. */
function FieldGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 border-t border-border pt-6 first:border-0 first:pt-0">
      <div className="space-y-1">
        <h3 className="font-sans text-sm font-semibold text-foreground">{title}</h3>
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Sub-heading inside the Email tab's "Notification emails" block, grouping toggles by area. */
function NotificationGroup({
  title,
  noBorder,
  children,
}: {
  title: string;
  noBorder?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mt-4", !noBorder && "")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</p>
      <div className="mt-2 divide-y divide-border">{children}</div>
    </div>
  );
}

/** One switch inside a `NotificationGroup`. */
function NotificationToggle({
  label,
  hint,
  checked,
  onCheckedChange,
  last,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3", last && "pb-0")}>
      <div className="space-y-0.5">
        <h4 className="font-sans text-sm font-medium text-foreground">{label}</h4>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/** Repeatable list — the board changes at every AGM. */
function BoardMembersField({
  members,
  onChange,
}: {
  members: string[];
  onChange: (members: string[]) => void;
}) {
  const rows = members.length > 0 ? members : [""];

  return (
    <div className="space-y-2">
      {rows.map((member, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={member}
            onChange={(e) => {
              const next = [...rows];
              next[index] = e.target.value;
              onChange(next);
            }}
            placeholder="Name and role, e.g. Anna Müller (1. Vorsitzende)"
            className="h-9 rounded-lg"
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
            disabled={rows.length === 1}
            aria-label="Remove board member"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...rows, ""])}
        className="h-9 rounded-lg border-dashed"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add board member
      </Button>
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
