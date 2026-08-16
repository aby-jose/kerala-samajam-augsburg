"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Globe,
  History,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/admin/ui/page-header";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cardSurface, chipTone, panelHeader } from "@/components/admin/ui/surface";
import { LegalBody } from "@/components/legal/legal-body";
import { fetchConfigAction } from "@/lib/config-actions";
import {
  RevisionSummary,
  adminGetLegalDocument,
  adminListRevisions,
  adminGetRevision,
  adminPublishVersion,
  adminSaveDraft,
  adminSetPublished,
} from "@/lib/legal-actions";
import {
  LEGAL_DOCS,
  LegalContent,
  LegalLocale,
  LegalSection,
  LegalSlug,
} from "@/lib/legal-schema";
import {
  buildPlaceholderMap,
  findUnresolvedPlaceholders,
  resolveContent,
  toAnchorId,
} from "@/lib/legal-render";
import { SiteConfig } from "@/lib/config-schema";
import { cn, getErrorMessage } from "@/lib/utils";

const LOCALES: { code: LegalLocale; label: string; note: string }[] = [
  { code: "de", label: "Deutsch", note: "Legally binding version" },
  { code: "en", label: "English", note: "Courtesy translation" },
];

const textareaClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-[13px] leading-relaxed text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

/**
 * Friendly names for the `{{legal.*}}` / `{{site.*}}` tokens, grouped for the
 * "Insert a detail…" menu. Kept in the editor rather than legal-render.ts
 * because these labels are UI copy, not part of placeholder resolution.
 */
const PLACEHOLDER_GROUPS: { label: string; options: { token: string; label: string }[] }[] = [
  {
    label: "Address & organisation",
    options: [
      { token: "legal.entityName", label: "Club name" },
      { token: "legal.legalForm", label: "Legal form (e.g. e.V.)" },
      { token: "legal.street", label: "Street" },
      { token: "legal.postalCode", label: "Postal code" },
      { token: "legal.city", label: "City" },
      { token: "legal.country", label: "Country" },
      { token: "legal.address", label: "Full address (one line)" },
      { token: "legal.addressLines", label: "Full address (with name, multi-line)" },
    ],
  },
  {
    label: "Register & board",
    options: [
      { token: "legal.registerCourt", label: "Register court" },
      { token: "legal.registerNumber", label: "Register number" },
      { token: "legal.register", label: "Register court + number" },
      { token: "legal.boardMembers", label: "Board members" },
      { token: "legal.vatId", label: "VAT ID" },
    ],
  },
  {
    label: "Responsible & data protection",
    options: [
      { token: "legal.responsiblePerson", label: "Person responsible for content" },
      { token: "legal.responsiblePersonAddress", label: "Their address" },
      { token: "legal.dpoName", label: "Data protection officer name" },
      { token: "legal.dpoEmail", label: "Data protection officer email" },
      { token: "legal.supervisoryAuthority", label: "Data protection authority" },
      { token: "legal.hostingProvider", label: "Hosting provider" },
      { token: "legal.bankName", label: "Bank name" },
      { token: "legal.iban", label: "IBAN" },
    ],
  },
  {
    label: "Contact & website",
    options: [
      { token: "site.name", label: "Site name" },
      { token: "site.email", label: "Contact email" },
      { token: "site.phone", label: "Contact phone" },
      { token: "site.address", label: "Site address" },
      { token: "site.url", label: "Website URL" },
    ],
  },
];

const TOKEN_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * `{{...}}` markers that don't match any key `buildPlaceholderMap` knows
 * about — a typo, or text typed to merely look like a placeholder. These are
 * worse than a known-but-empty field: filling in Settings can never fix
 * them, because there is nothing on the other end to fill in.
 */
function findInvalidTokens(content: LegalContent, knownKeys: Set<string>): string[] {
  const texts = [
    content.title,
    content.lead,
    ...content.sections.flatMap((s) => [s.heading, s.body]),
  ];
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(TOKEN_PATTERN)) {
      if (!knownKeys.has(match[1].trim())) found.add(match[0]);
    }
  }
  return [...found];
}

export function LegalEditorClient({ slug }: { slug: LegalSlug }) {
  const { success, error: toastError } = useToast();
  const confirm = useConfirm();
  const meta = LEGAL_DOCS[slug];

  const [locale, setLocale] = React.useState<LegalLocale>("de");
  const [content, setContent] = React.useState<Record<LegalLocale, LegalContent> | null>(null);
  const [config, setConfig] = React.useState<SiteConfig | null>(null);
  const [version, setVersion] = React.useState(1);
  const [requiresConsent, setRequiresConsent] = React.useState(meta.requiresConsent);
  const [revisions, setRevisions] = React.useState<RevisionSummary[]>([]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  // Seeded from the loaded document below — `meta` is the static schema
  // definition and carries no live state.
  const [isPublished, setIsPublished] = React.useState(true);
  const [isTogglingPublish, setIsTogglingPublish] = React.useState(false);
  const [loadingRevisionId, setLoadingRevisionId] = React.useState<string | null>(null);
  const [viewingRevision, setViewingRevision] = React.useState<
    Awaited<ReturnType<typeof adminGetRevision>>
  >(null);
  const [changeNote, setChangeNote] = React.useState("");
  const [requireReconsent, setRequireReconsent] = React.useState(meta.requiresConsent);
  // Anchors and raw {{token}} syntax are developer plumbing — collapsed by
  // default so the everyday editing view reads as a form, not as code.
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [formatHelpOpen, setFormatHelpOpen] = React.useState(false);
  const bodyRefs = React.useRef<Record<number, HTMLTextAreaElement | null>>({});

  React.useEffect(() => {
    Promise.all([adminGetLegalDocument(slug), fetchConfigAction(), adminListRevisions(slug)])
      .then(([doc, siteConfig, history]) => {
        if (!doc) {
          toastError("Document not found. Run the legal seed first.");
          return;
        }
        setContent({ de: doc.de, en: doc.en });
        setVersion(doc.version);
        setRequiresConsent(doc.requiresConsent);
        setRequireReconsent(doc.requiresConsent);
        setIsPublished(doc.isPublished);
        setConfig(siteConfig);
        setRevisions(history);
      })
      .catch((err) => toastError(getErrorMessage(err, "Failed to load document")))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const placeholderMap = React.useMemo(
    () => (config ? buildPlaceholderMap(config) : {}),
    [config]
  );
  const knownPlaceholderKeys = React.useMemo(
    () => new Set(Object.keys(placeholderMap)),
    [placeholderMap]
  );

  // Details only the committee knows. Publishing is blocked while any remain,
  // because a legally mandatory page with a gap in it is worse than useless.
  const unresolved = React.useMemo(() => {
    if (!content || !config) return [];
    return Array.from(
      new Set([
        ...findUnresolvedPlaceholders(content.de, placeholderMap),
        ...findUnresolvedPlaceholders(content.en, placeholderMap),
      ])
    );
  }, [content, config, placeholderMap]);

  // {{...}} that don't match any real field — a typo or made-up text, not a
  // gap Settings can fill. Blocks saving outright: unlike `unresolved`, no
  // amount of filling in Settings will ever make these valid.
  const invalidTokens = React.useMemo(() => {
    if (!content || !config) return [];
    return Array.from(
      new Set([
        ...findInvalidTokens(content.de, knownPlaceholderKeys),
        ...findInvalidTokens(content.en, knownPlaceholderKeys),
      ])
    );
  }, [content, config, knownPlaceholderKeys]);

  const current = content?.[locale];

  const update = (mutate: (draft: LegalContent) => LegalContent) => {
    setContent((prev) => {
      if (!prev) return prev;
      return { ...prev, [locale]: mutate(prev[locale]) };
    });
    setIsDirty(true);
  };

  const updateSection = (index: number, patch: Partial<LegalSection>) =>
    update((draft) => ({
      ...draft,
      sections: draft.sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section
      ),
    }));

  /**
   * Drop a `{{token}}` into a section's body at the cursor, so nobody has to
   * type curly braces by hand. Falls back to appending at the end if the
   * textarea isn't mounted yet.
   */
  const insertPlaceholder = (index: number, token: string) => {
    const el = bodyRefs.current[index];
    const marker = `{{${token}}}`;

    if (!el) {
      updateSection(index, { body: `${current?.sections[index]?.body ?? ""}${marker}` });
      return;
    }

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const nextValue = el.value.slice(0, start) + marker + el.value.slice(end);
    updateSection(index, { body: nextValue });

    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + marker.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const moveSection = (index: number, direction: -1 | 1) =>
    update((draft) => {
      const target = index + direction;
      if (target < 0 || target >= draft.sections.length) return draft;
      const sections = [...draft.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...draft, sections };
    });

  const addSection = () =>
    update((draft) => ({
      ...draft,
      sections: [
        ...draft.sections,
        { id: `section-${draft.sections.length + 1}`, heading: "", body: "" },
      ],
    }));

  const removeSection = async (index: number) => {
    const ok = await confirm({
      title: "Remove this section?",
      message:
        "It is removed from the version you are editing. Published versions keep their own copy in the revision history.",
      confirmText: "Remove",
      variant: "danger",
    });
    if (!ok) return;

    update((draft) => ({
      ...draft,
      sections: draft.sections.filter((_, i) => i !== index),
    }));
  };

  const handleSaveDraft = async () => {
    if (!content) return;

    // A made-up {{token}} is never allowed to reach storage, not even as a
    // draft — the button is disabled for this already, but a made-up token
    // can be typed and this submit reachable via Enter, so it is enforced
    // here too, not only in the button's `disabled`.
    if (invalidTokens.length > 0) {
      toastError(
        invalidTokens.length === 1
          ? `${invalidTokens[0]} isn't a real field — fix or remove it before saving.`
          : `${invalidTokens.join(", ")} aren't real fields — fix or remove them before saving.`
      );
      return;
    }

    setIsSaving(true);
    try {
      await adminSaveDraft(slug, content);
      setIsDirty(false);
      success("Saved. No new version — nobody is re-prompted.");
    } catch (err) {
      toastError(getErrorMessage(err, "Failed to save"));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!content) return;

    if (!changeNote.trim()) {
      toastError("A change note is required — members see it verbatim.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await adminPublishVersion(slug, {
        de: content.de,
        en: content.en,
        changeNote: changeNote.trim(),
        requireReconsent,
      });
      setVersion(result.version);
      setRequiresConsent(requireReconsent);
      setIsDirty(false);
      setPublishOpen(false);
      setChangeNote("");
      setRevisions(await adminListRevisions(slug));
      success(
        requireReconsent
          ? `Published v${result.version}. Members will be asked to accept it.`
          : `Published v${result.version}.`
      );
    } catch (err) {
      toastError(getErrorMessage(err, "Failed to publish"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenRevision = async (revisionId: string) => {
    setLoadingRevisionId(revisionId);
    try {
      const revision = await adminGetRevision(revisionId);
      if (!revision) {
        toastError("That version could not be found.");
        return;
      }
      setViewingRevision(revision);
    } catch (err) {
      toastError(getErrorMessage(err, "Failed to open that version"));
    } finally {
      setLoadingRevisionId(null);
    }
  };

  /**
   * Take the document off the public site without deleting it.
   *
   * Impressum and Datenschutz are legally required to be reachable in Germany,
   * so unpublishing either is confirmed with that stated plainly rather than a
   * generic "are you sure".
   */
  const handleTogglePublished = async () => {
    const nextPublished = !isPublished;
    const isMandatory = slug === "imprint" || slug === "privacy";

    if (!nextPublished) {
      const ok = await confirm({
        title: "Take this page offline",
        message: isMandatory
          ? `The ${meta.label.en} is legally required to be reachable in Germany. ` +
            "Taking it offline means visitors get a 404 and the footer link breaks. " +
            "Only do this if you are putting it back within minutes."
          : "Visitors will get a 404 for this page until you publish it again. The text is kept.",
        confirmText: "Take offline",
        variant: "danger",
      });
      if (!ok) return;
    }

    setIsTogglingPublish(true);
    try {
      await adminSetPublished(slug, nextPublished);
      setIsPublished(nextPublished);
      success(nextPublished ? "Page is live again." : "Page taken offline.");
    } catch (err) {
      toastError(getErrorMessage(err, "Failed to change visibility"));
    } finally {
      setIsTogglingPublish(false);
    }
  };

  if (isLoading) return <EditorSkeleton />;

  if (!content || !current) {
    return (
      <div className="space-y-6">
        <PageHeader title={meta.label.en} description="Document not available." />
        <section className={cn(cardSurface, "p-8 text-center")}>
          <p className="text-sm text-muted-foreground">
            This document has not been seeded yet. Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              npx tsx prisma/seed-legal.ts
            </code>
          </p>
        </section>
      </div>
    );
  }

  const resolved = config ? resolveContent(current, placeholderMap) : current;

  return (
    <div className="space-y-6">
      <PageHeader title={meta.label.en} description={`${meta.label.de} · ${meta.basis}`}>
        <Link href="/admin/legal">
          <Button variant="outline" className="h-9 rounded-lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={() => setShowPreview((v) => !v)}
          className="h-9 rounded-lg"
        >
          <Eye className="mr-2 h-4 w-4" />
          {showPreview ? "Hide preview" : "Preview"}
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={isSaving || !isDirty || invalidTokens.length > 0}
          title={
            invalidTokens.length > 0
              ? `Fix or remove ${invalidTokens.join(", ")} before saving`
              : undefined
          }
          className="h-9 rounded-lg"
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save draft
        </Button>
        <Button
          variant="outline"
          onClick={handleTogglePublished}
          disabled={isTogglingPublish}
          className="h-9 rounded-lg"
        >
          {isTogglingPublish ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isPublished ? (
            <EyeOff className="mr-2 h-4 w-4" />
          ) : (
            <Globe className="mr-2 h-4 w-4" />
          )}
          {isPublished ? "Take offline" : "Put online"}
        </Button>
        <Button
          onClick={() => setPublishOpen(true)}
          disabled={isSaving || unresolved.length > 0}
          className="h-9 rounded-lg"
        >
          <Send className="mr-2 h-4 w-4" />
          Publish v{version + 1}
        </Button>
      </PageHeader>

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="neutral">Live version v{version}</Chip>
        {!isPublished && <Chip tone="amber">Offline — visitors get a 404</Chip>}
        {requiresConsent ? (
          <Chip tone="primary">New versions require re-consent</Chip>
        ) : (
          <Chip tone="neutral">Informational — no consent needed</Chip>
        )}
        {isDirty && <Chip tone="amber">Unsaved changes</Chip>}
      </div>

      {unresolved.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium text-amber-900">
              {unresolved.length} detail{unresolved.length === 1 ? "" : "s"} still to fill
              in. Publishing is blocked until they are resolved.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unresolved.map((placeholder) => (
                <code
                  key={placeholder}
                  className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-900"
                >
                  {placeholder}
                </code>
              ))}
            </div>
            <Link
              href="/admin/settings"
              className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-700 underline underline-offset-4"
            >
              Fill these in under Settings → Organisation
            </Link>
          </div>
        </div>
      )}

      {/* Locale tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
        {LOCALES.map((item) => (
          <button
            key={item.code}
            onClick={() => setLocale(item.code)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2.5 text-left transition-colors",
              locale === item.code
                ? "bg-background shadow-sm"
                : "hover:bg-background/50"
            )}
          >
            <span
              className={cn(
                "block text-sm font-semibold",
                locale === item.code ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
            <span className="block text-[11px] text-muted-foreground">{item.note}</span>
          </button>
        ))}
      </div>

      <div className={cn("grid grid-cols-1 gap-6", showPreview && "xl:grid-cols-2")}>
        {/* Editor */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Edit the plain sentences below. Use “+ Insert a detail” to add facts like the
              address or register number — they stay in sync with Settings automatically.
            </p>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="shrink-0 text-xs font-medium text-primary underline underline-offset-4"
            >
              {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
            </button>
          </div>

          <section className={cn(cardSurface, "p-4")}>
            <button
              type="button"
              onClick={() => setFormatHelpOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-sm font-medium text-foreground">How to format the text</span>
              {formatHelpOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
            {formatHelpOpen && (
              <div className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <p>Leave a blank line between paragraphs to start a new one.</p>
                <p>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">## </code> at the
                  start of a line makes a sub-heading.
                </p>
                <p>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">- </code> at the
                  start of a line makes a bullet point.
                </p>
                <p>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">**text**</code> makes
                  text bold.
                </p>
                <p>
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">
                    [link text](https://example.com)
                  </code>{" "}
                  makes a link.
                </p>
                <p>
                  For a fact like the club&apos;s address or register number, use the{" "}
                  <strong className="text-foreground">+ Insert a detail</strong> menu above the
                  text box instead of typing curly braces by hand.
                </p>
              </div>
            )}
          </section>

          <section className={cardSurface}>
            <header className={panelHeader}>
              <h2 className="font-sans text-sm font-semibold text-foreground">
                Title and lead
              </h2>
            </header>
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Title</Label>
                <Input
                  value={current.title}
                  onChange={(e) => update((d) => ({ ...d, title: e.target.value }))}
                  className="h-9 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lead</Label>
                <textarea
                  value={current.lead}
                  onChange={(e) => update((d) => ({ ...d, lead: e.target.value }))}
                  rows={2}
                  className={cn(textareaClass, "font-sans")}
                />
                <p className="text-xs text-muted-foreground">
                  One sentence under the page title.
                </p>
              </div>
            </div>
          </section>

          {current.sections.map((section, index) => {
            const sectionInvalid = config
              ? findInvalidTokens(
                  { title: "", lead: "", sections: [section] },
                  knownPlaceholderKeys
                )
              : [];

            return (
            <section key={index} className={cardSurface}>
              <header className={panelHeader}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[10px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {section.heading || "Untitled section"}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    onClick={() => moveSection(index, -1)}
                    disabled={index === 0}
                    label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    onClick={() => moveSection(index, 1)}
                    disabled={index === current.sections.length - 1}
                    label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton
                    onClick={() => removeSection(index)}
                    label="Remove section"
                    destructive
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </header>

              <div className="space-y-4 p-5">
                <div className={cn("grid grid-cols-1 gap-4", showAdvanced && "sm:grid-cols-3")}>
                  <div className={cn("space-y-2", showAdvanced && "sm:col-span-2")}>
                    <Label className="text-sm font-medium">Heading</Label>
                    <Input
                      value={section.heading}
                      onChange={(e) =>
                        updateSection(index, {
                          heading: e.target.value,
                          // Keep the anchor in step until someone edits it by
                          // hand, so deep links stay meaningful.
                          id: section.id.startsWith("section-")
                            ? toAnchorId(e.target.value, section.id)
                            : section.id,
                        })
                      }
                      className="h-9 rounded-lg"
                    />
                  </div>
                  {showAdvanced && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Anchor</Label>
                      <Input
                        value={section.id}
                        onChange={(e) => updateSection(index, { id: e.target.value })}
                        className="h-9 rounded-lg font-mono text-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium">Body</Label>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const token = e.target.value;
                        if (token) insertPlaceholder(index, token);
                        e.target.value = "";
                      }}
                      className="h-8 max-w-[13rem] rounded-md border border-input bg-background px-2 text-xs text-muted-foreground outline-none focus-visible:border-ring"
                    >
                      <option value="">+ Insert a detail…</option>
                      {PLACEHOLDER_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((opt) => (
                            <option key={opt.token} value={opt.token}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <textarea
                    ref={(el) => {
                      bodyRefs.current[index] = el;
                    }}
                    value={section.body}
                    onChange={(e) => updateSection(index, { body: e.target.value })}
                    rows={10}
                    className={textareaClass}
                  />
                  {sectionInvalid.length > 0 && (
                    <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {sectionInvalid.length === 1
                          ? "This isn't a recognised detail: "
                          : "These aren't recognised details: "}
                        <code className="font-mono">{sectionInvalid.join(", ")}</code> — it will
                        show up exactly like that on the page. Use “+ Insert a detail” above
                        instead.
                      </span>
                    </p>
                  )}
                  {showAdvanced && (
                    <p className="text-xs text-muted-foreground">
                      Blank line = new paragraph · <code>## </code> sub-heading ·{" "}
                      <code>- </code> bullet · <code>**bold**</code> ·{" "}
                      <code>[text](url)</code> · <code>{"{{legal.registerNumber}}"}</code>{" "}
                      raw syntax, same as the insert menu above.
                    </p>
                  )}
                </div>
              </div>
            </section>
            );
          })}

          <Button
            variant="outline"
            onClick={addSection}
            className="h-10 w-full rounded-lg border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add section
          </Button>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
            <section className={cardSurface}>
              <header className={panelHeader}>
                <h2 className="font-sans text-sm font-semibold text-foreground">
                  Preview — as members see it
                </h2>
                <span className="text-xs text-muted-foreground">{locale.toUpperCase()}</span>
              </header>
              <div className="p-6">
                <h1 className="font-sans text-2xl font-extrabold tracking-[-0.035em] text-foreground">
                  {resolved.title}
                </h1>
                {resolved.lead && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {resolved.lead}
                  </p>
                )}

                <div className="mt-8 space-y-9">
                  {resolved.sections.map((section, i) => (
                    <div key={i}>
                      <h2 className="font-sans text-base font-extrabold tracking-[-0.02em] text-foreground">
                        {section.heading}
                      </h2>
                      <div className="mt-2 h-px w-8 bg-primary/30" />
                      <LegalBody body={section.body} className="mt-3" />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Revision history */}
      <section className={cardSurface}>
        <header className={panelHeader}>
          <div className="flex items-center gap-3">
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone("neutral"))}>
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground">
                Revision history
              </h2>
              <p className="text-xs text-muted-foreground">
                Immutable copies of every published version — this is what proves
                which wording a member agreed to.
              </p>
            </div>
          </div>
        </header>

        {revisions.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No previous versions yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {revisions.map((revision) => (
              <li key={revision.id}>
                {/*
                  Clickable so the archive can actually be read. Storing every
                  version proves nothing if the only way to see v2 is a
                  database client — and answering "what exactly did I agree
                  to?" is the reason these rows exist.
                */}
                <button
                  type="button"
                  onClick={() => handleOpenRevision(revision.id)}
                  disabled={loadingRevisionId === revision.id}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      v{revision.version}
                    </span>
                    {revision.changeNote && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {revision.changeNote}
                      </p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {new Date(revision.publishedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {revision.publishedBy && ` · ${revision.publishedBy}`}
                    <span className="font-medium text-foreground">
                      {loadingRevisionId === revision.id ? "Opening…" : "View"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewingRevision && (
        <RevisionViewer
          revision={viewingRevision}
          onClose={() => setViewingRevision(null)}
        />
      )}

      {publishOpen && (
        <PublishDialog
          nextVersion={version + 1}
          slug={slug}
          changeNote={changeNote}
          setChangeNote={setChangeNote}
          requireReconsent={requireReconsent}
          setRequireReconsent={setRequireReconsent}
          canReconsent={meta.requiresConsent}
          isSaving={isSaving}
          onCancel={() => setPublishOpen(false)}
          onConfirm={handlePublish}
        />
      )}
    </div>
  );
}

function PublishDialog({
  nextVersion,
  slug,
  changeNote,
  setChangeNote,
  requireReconsent,
  setRequireReconsent,
  canReconsent,
  isSaving,
  onCancel,
  onConfirm,
}: {
  nextVersion: number;
  slug: LegalSlug;
  changeNote: string;
  setChangeNote: (value: string) => void;
  requireReconsent: boolean;
  setRequireReconsent: (value: boolean) => void;
  canReconsent: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="border-b border-border px-6 py-5">
          <h2 className="font-sans text-base font-semibold text-foreground">
            Publish version {nextVersion}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {LEGAL_DOCS[slug].label.en} · the current wording is archived first.
          </p>
        </header>

        <div className="space-y-5 p-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              What changed <span className="text-destructive">*</span>
            </Label>
            <textarea
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              rows={4}
              placeholder="e.g. Added the payment processor and clarified how long registrations are kept."
              className={cn(textareaClass, "font-sans")}
            />
            <p className="text-xs text-muted-foreground">
              Members are shown this verbatim when asked to accept. Write it for
              them, not for the archive.
            </p>
          </div>

          {canReconsent && (
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  Ask members to accept again
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Turn on for material changes. Every member whose last
                  acceptance is older than v{nextVersion} is prompted on their
                  next visit. Leave off for wording that does not change what
                  they agreed to.
                </p>
              </div>
              <Switch
                checked={requireReconsent}
                onCheckedChange={setRequireReconsent}
                className="mt-0.5 shrink-0"
              />
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-6 py-4">
          <Button variant="outline" onClick={onCancel} disabled={isSaving} className="h-9 rounded-lg">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSaving || !changeNote.trim()} className="h-9 rounded-lg">
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Publish v{nextVersion}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:opacity-30",
        destructive
          ? "hover:bg-destructive/10 hover:text-destructive"
          : "hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/**
 * Read-only view of a previously published version.
 *
 * Shows the wording exactly as it was stored, without placeholder resolution:
 * a revision is evidence of what was published, so it is displayed verbatim
 * rather than re-rendered against today's site configuration. Both languages
 * are available because the German text is the binding one.
 */
function RevisionViewer({
  revision,
  onClose,
}: {
  revision: NonNullable<Awaited<ReturnType<typeof adminGetRevision>>>;
  onClose: () => void;
}) {
  const [locale, setLocale] = React.useState<LegalLocale>("de");
  const content = revision[locale];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-sans text-base font-bold tracking-tight text-foreground">
              Version {revision.version}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                published{" "}
                {new Date(revision.publishedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </h2>
            {revision.changeNote && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {revision.changeNote}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5">
              {(["de", "en"] as LegalLocale[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocale(l)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                    locale === l
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={onClose} className="h-8 rounded-lg">
              Close
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <p className="mb-6 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Archived wording, shown exactly as published. Placeholders such as{" "}
            <code className="font-mono">{"{{legal.entityName}}"}</code> are left
            unresolved so this reflects the stored record rather than today&apos;s settings.
          </p>

          <h1 className="font-sans text-2xl font-extrabold tracking-[-0.035em] text-foreground">
            {content.title}
          </h1>
          {content.lead && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{content.lead}</p>
          )}

          <div className="mt-8 space-y-9">
            {content.sections.map((section, i) => (
              <div key={i}>
                <h2 className="font-sans text-base font-extrabold tracking-[-0.02em] text-foreground">
                  {section.heading}
                </h2>
                <div className="mt-2 h-px w-8 bg-primary/30" />
                <LegalBody body={section.body} className="mt-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "primary" | "amber";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
        chipTone(tone)
      )}
    >
      {children}
    </span>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn(cardSurface, "p-5")}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-9 w-full rounded-lg" />
          <Skeleton className="mt-3 h-28 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
