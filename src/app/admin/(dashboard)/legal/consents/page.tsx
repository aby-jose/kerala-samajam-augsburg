"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/ui/page-header";
import { DataTable, DataTableColumn } from "@/components/admin/ui/data-table";
import { chipTone } from "@/components/admin/ui/surface";
import {
  ConsentLogEntry,
  adminExportConsentsCsv,
  adminListConsents,
} from "@/lib/legal-actions";
import { LEGAL_DOCS, LEGAL_DOCS_ORDERED, isLegalSlug } from "@/lib/legal-schema";
import { cn, getErrorMessage } from "@/lib/utils";

/**
 * The consent log.
 *
 * Art. 5(2) GDPR puts the burden of proof on the controller: it is not enough
 * that people consented, you have to be able to show it. This page — and its
 * CSV export — is that evidence.
 */

const TYPES = [
  { value: "all", label: "All types" },
  { value: "DOCUMENT", label: "Documents" },
  { value: "BIOMETRIC", label: "Biometric" },
  { value: "COOKIE", label: "Cookies" },
  { value: "PHOTO", label: "Photos" },
];

export default function ConsentLogPage() {
  const { success, error: toastError } = useToast();
  const [rows, setRows] = React.useState<ConsentLogEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [slugFilter, setSlugFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [isExporting, setIsExporting] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setRows(await adminListConsents({ slug: slugFilter, type: typeFilter }));
    } catch (err) {
      toastError(getErrorMessage(err, "Failed to load the consent log"));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugFilter, typeFilter]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { csv, count } = await adminExportConsentsCsv({
        slug: slugFilter,
        type: typeFilter,
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `consent-log-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      success(`Exported ${count} record${count === 1 ? "" : "s"}.`);
    } catch (err) {
      toastError(getErrorMessage(err, "Export failed"));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: DataTableColumn<ConsentLogEntry>[] = [
    {
      key: "subject",
      header: "Member",
      width: "w-[26%]",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.userName || "Anonymous"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.userEmail || row.subjectKey}
          </p>
        </div>
      ),
    },
    {
      key: "document",
      header: "Document",
      width: "w-[24%]",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">
            {row.slug && isLegalSlug(row.slug)
              ? LEGAL_DOCS[row.slug].label.en
              : row.type === "BIOMETRIC"
                ? "Face recognition"
                : row.type}
          </p>
          {row.version != null && (
            <p className="font-mono text-xs text-muted-foreground">v{row.version}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "w-[14%]",
      render: (row) => {
        const active = row.granted && !row.revokedAt;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
              active ? chipTone("emerald") : chipTone("neutral")
            )}
          >
            {active ? <ShieldCheck className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {active ? "Granted" : "Withdrawn"}
          </span>
        );
      },
    },
    {
      key: "source",
      header: "Captured at",
      width: "w-[16%]",
      render: (row) => (
        <span className="text-xs capitalize text-muted-foreground">{row.source}</span>
      ),
    },
    {
      key: "date",
      header: "Recorded",
      width: "w-[20%]",
      align: "right",
      render: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {new Date(row.createdAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
  ];

  const selectClass =
    "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consent log"
        description="Who agreed to what, at which version, and when."
      >
        <Link href="/admin/legal">
          <Button variant="outline" className="h-9 rounded-lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <Button onClick={handleExport} disabled={isExporting} className="h-9 rounded-lg">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={selectClass}
            >
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            <select
              value={slugFilter}
              onChange={(e) => setSlugFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All documents</option>
              {LEGAL_DOCS_ORDERED.map((doc) => (
                <option key={doc.slug} value={doc.slug}>
                  {doc.label.en}
                </option>
              ))}
            </select>

            <span className="text-xs text-muted-foreground">
              {rows.length} record{rows.length === 1 ? "" : "s"}
            </span>
          </div>
        }
        empty={{
          icon: ShieldCheck,
          title: "No consent records",
          description:
            "Records appear here as members accept documents at signup, checkout or after an update.",
        }}
      />

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        IP addresses are stored as salted hashes rather than in the clear, and
        anonymous subjects (contact-form senders) appear as a truncated hash —
        enough to group one person&rsquo;s records, not enough to re-identify them.
      </p>
    </div>
  );
}
