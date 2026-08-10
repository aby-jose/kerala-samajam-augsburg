"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  FileText,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/ui/page-header";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { cardSurface, chipTone, panelHeader } from "@/components/admin/ui/surface";
import { useToast } from "@/components/ui/toast";
import { AdminLegalSummary, adminListLegalDocuments } from "@/lib/legal-actions";
import { LEGAL_DOCS } from "@/lib/legal-schema";
import { cn, getErrorMessage } from "@/lib/utils";

export default function AdminLegalPage() {
  const { error: toastError } = useToast();
  const [docs, setDocs] = React.useState<AdminLegalSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    adminListLegalDocuments()
      .then(setDocs)
      .catch((err) => toastError(getErrorMessage(err, "Failed to load legal documents")))
      .finally(() => setIsLoading(false));
    // Run once — the list reloads on navigation back from the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return <LegalListSkeleton />;

  const consentDocs = docs.filter((d) => d.requiresConsent);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal"
        description="Impressum, privacy, terms and the rest — versioned, with a consent trail."
      >
        <Link href="/admin/legal/consents">
          <Button variant="outline" className="h-9 rounded-lg">
            <Users className="mr-2 h-4 w-4" />
            Consent log
          </Button>
        </Link>
      </PageHeader>

      {docs.length === 0 ? (
        <section className={cardSurface}>
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-2xl", chipTone("amber"))}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="font-sans text-base font-semibold text-foreground">
              No documents yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Run the seed once to create the six documents with their default
              wording, then edit them here.
            </p>
            <code className="mt-4 rounded-lg bg-muted px-3 py-1.5 font-mono text-xs text-foreground">
              npx tsx prisma/seed-legal.ts
            </code>
          </div>
        </section>
      ) : (
        <>
          {/* How much of the membership is on the current version. This is the
              number that tells you whether a re-consent has actually landed. */}
          {consentDocs.length > 0 && (
            <section className={cardSurface}>
              <header className={panelHeader}>
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone("primary"))}>
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-sans text-sm font-semibold text-foreground">Consent coverage</h2>
                    <p className="text-xs text-muted-foreground">
                      Active members who have accepted the current version.
                    </p>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
                {consentDocs.map((doc) => {
                  const total = doc.coverage?.total ?? 0;
                  const accepted = doc.coverage?.accepted ?? 0;
                  const pct = total > 0 ? Math.round((accepted / total) * 100) : 0;

                  return (
                    <div key={doc.slug} className="space-y-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-medium text-foreground">
                          {LEGAL_DOCS[doc.slug].label.en}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {accepted}/{total}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-primary"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        v{doc.version} · {pct}% on current version
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {docs.map((doc) => (
              <DocumentCard key={doc.slug} doc={doc} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DocumentCard({ doc }: { doc: AdminLegalSummary }) {
  const meta = LEGAL_DOCS[doc.slug];

  return (
    <section className={cn(cardSurface, "flex flex-col")}>
      <header className={panelHeader}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", chipTone(doc.requiresConsent ? "primary" : "neutral"))}>
            <ScrollText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-sans text-sm font-semibold text-foreground">
              {meta.label.en}
            </h2>
            <p className="truncate text-xs text-muted-foreground">{meta.label.de}</p>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
          v{doc.version}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-xs leading-relaxed text-muted-foreground">{meta.description}</p>

        <div className="flex flex-wrap gap-1.5">
          <Badge tone={meta.basis.includes("mandatory") ? "amber" : "neutral"}>
            {meta.basis}
          </Badge>
          {doc.requiresConsent && <Badge tone="primary">Re-consent on new version</Badge>}
          {!doc.isPublished && <Badge tone="neutral">Unpublished</Badge>}
        </div>

        <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
          <div>
            <dt className="text-muted-foreground">Sections</dt>
            <dd className="mt-0.5 font-medium text-foreground">{doc.sectionCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">In force since</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {new Date(doc.effectiveFrom).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>

        {doc.changeNote && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              <FileText className="h-3 w-3" />
              Last change note
            </span>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{doc.changeNote}</p>
          </div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link href={`/admin/legal/${doc.slug}`} className="flex-1">
            <Button className="h-9 w-full rounded-lg">
              Edit
              <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href={`/legal/${doc.slug}`} target="_blank">
            <Button variant="outline" className="h-9 rounded-lg" aria-label="View public page">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "amber";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        chipTone(tone)
      )}
    >
      {children}
    </span>
  );
}

function LegalListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn(cardSurface, "p-5")}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
            <Skeleton className="mt-5 h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
