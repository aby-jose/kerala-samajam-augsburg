"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
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
  adminPublishVersion,
  adminSaveDraft,
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
  const [changeNote, setChangeNote] = React.useState("");
  const [requireReconsent, setRequireReconsent] = React.useState(meta.requiresConsent);

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
          disabled={isSaving || !isDirty}
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

          {current.sections.map((section, index) => (
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-2">
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
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Anchor</Label>
                    <Input
                      value={section.id}
                      onChange={(e) => updateSection(index, { id: e.target.value })}
                      className="h-9 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Body</Label>
                  <textarea
                    value={section.body}
                    onChange={(e) => updateSection(index, { body: e.target.value })}
                    rows={10}
                    className={textareaClass}
                  />
                  <p className="text-xs text-muted-foreground">
                    Blank line = new paragraph · <code>## </code> sub-heading ·{" "}
                    <code>- </code> bullet · <code>**bold**</code> ·{" "}
                    <code>[text](url)</code> · <code>{"{{legal.registerNumber}}"}</code>{" "}
                    pulls from Settings.
                  </p>
                </div>
              </div>
            </section>
          ))}

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
              <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
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
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(revision.publishedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  {revision.publishedBy && ` · ${revision.publishedBy}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
