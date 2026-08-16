"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Settings2,
  ShieldAlert,
  ShieldOff,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/admin/ui/page-header";
import { StatCard } from "@/components/admin/ui/stat-card";
import { StatusBadge, type StatusTone } from "@/components/admin/ui/status-badge";
import { SearchInput } from "@/components/admin/ui/search-input";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";
import { cardSurface, heroSurface, panelHeader, toolbarChip } from "@/components/admin/ui/surface";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  getEmailHtml,
  getEmailLog,
  resendEmail,
  sendTestEmail,
  type EmailLogPage,
  type EmailLogRow,
} from "@/lib/email-admin-actions";
import { EMAIL_LOG_PAGE_SIZE } from "@/lib/email-constants";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "failed", label: "Failed" },
  { key: "sent", label: "Sent" },
  { key: "suppressed", label: "Suppressed" },
  { key: "queued", label: "Queued" },
] as const;

const STATUS_TONE: Record<string, StatusTone> = {
  SENT: "success",
  FAILED: "destructive",
  SUPPRESSED: "neutral",
  QUEUED: "warning",
};

export default function EmailsClient() {
  const { success, error: toastError } = useToast();
  const [data, setData] = useState<EmailLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [testAddress, setTestAddress] = useState("");
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getEmailLog({ status, search, page }));
    } catch (e: any) {
      toastError(`Could not load the email log: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [status, search, page, toastError]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  // A new filter or search invalidates the current page.
  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const handleResend = async (id: string) => {
    setBusyId(id);
    try {
      await resendEmail(id);
      success("Sent again");
      await load();
    } catch (e: any) {
      toastError(`Resend failed: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async (id: string) => {
    setBusyId(id);
    try {
      const result = await getEmailHtml(id);
      if (!result.html) {
        toastError("No stored copy — this message is too old to preview.");
        return;
      }
      setPreview({ subject: result.subject, html: result.html });
    } catch (e: any) {
      toastError(`Could not load the message: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleTest = async () => {
    if (!testAddress.trim()) return;
    setTesting(true);
    try {
      await sendTestEmail(testAddress.trim());
      success(`Test sent — check ${testAddress}`);
    } catch (e: any) {
      toastError(`Test failed: ${e.message}`);
    } finally {
      setTesting(false);
      // Reload either way: a failure has just written a FAILED row carrying
      // the provider's actual error, which is the thing worth reading.
      await load();
    }
  };

  const counts = data?.counts;
  const warnings = data?.configWarnings ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / EMAIL_LOG_PAGE_SIZE));

  const providerLabel = useMemo(() => {
    if (!data) return "";
    const active = [data.transport.resend && "Resend", data.transport.smtp && "SMTP"].filter(Boolean);
    return active.length ? active.join(" + ") : "None configured";
  }, [data]);

  const columns: DataTableColumn<EmailLogRow>[] = [
    {
      key: "status",
      header: "Status",
      width: "w-[11%]",
      render: (row) => (
        <StatusBadge tone={STATUS_TONE[row.status] || "neutral"}>{row.status.toLowerCase()}</StatusBadge>
      ),
    },
    {
      key: "recipient",
      header: "Recipient",
      width: "w-[20%]",
      cellClassName: "min-w-0",
      render: (row) => <p className="truncate text-sm font-medium text-foreground">{row.to}</p>,
    },
    {
      key: "subject",
      header: "Subject",
      width: "w-[33%]",
      cellClassName: "min-w-0",
      render: (row) => (
        <div>
          <p className="truncate text-sm text-foreground">{row.subject}</p>
          {row.error && <p className="mt-1 text-xs leading-relaxed text-red-600 dark:text-red-400">{row.error}</p>}
        </div>
      ),
    },
    {
      key: "template",
      header: "Template",
      width: "w-[16%]",
      headClassName: "hidden lg:table-cell",
      cellClassName: "hidden lg:table-cell",
      render: (row) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{row.template}</code>
      ),
    },
    {
      key: "when",
      header: "When",
      width: "w-[12%]",
      headClassName: "hidden md:table-cell",
      cellClassName: "hidden whitespace-nowrap text-muted-foreground md:table-cell",
      render: (row) =>
        new Date(row.createdAt).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "actions",
      header: "",
      width: "w-[8%]",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Preview"
            onClick={() => handlePreview(row.id)}
            disabled={busyId === row.id}
            className="h-8 w-8"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Send again"
            onClick={() => handleResend(row.id)}
            disabled={busyId === row.id || row.status === "SUPPRESSED"}
            className="h-8 w-8"
          >
            {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email"
        description="Every message the site has tried to send, and what happened to it."
      >
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
        <Link href="/admin/settings?tab=email">
          <Button variant="outline" size="sm">
            <Settings2 className="mr-2 h-4 w-4" />
            Automated sending
          </Button>
        </Link>
      </PageHeader>

      {/* Configuration faults come first: these are the ones that make every
          send fail at once, and reading them off a list of identical errors is
          how the original problem stayed invisible for so long. */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-400">
                {warnings.length === 1 ? "A configuration problem" : `${warnings.length} configuration problems`}
              </p>
              <ul className="space-y-1.5 text-sm text-amber-900/80 dark:text-amber-400/80">
                {warnings.map((w) => (
                  <li key={w} className="leading-relaxed">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Delivered" value={counts?.sent ?? "—"} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Failed" value={counts?.failed ?? "—"} icon={AlertTriangle} tone={counts?.failed ? "red" : "neutral"} />
        <StatCard label="Suppressed" value={counts?.suppressed ?? "—"} icon={ShieldOff} tone="neutral" />
        <StatCard label="Queued" value={counts?.queued ?? "—"} icon={Clock} tone="amber" />
      </div>

      <section className={cardSurface}>
        <header className={panelHeader}>
          <div>
            <h2 className="font-sans text-sm font-semibold text-foreground">Send a test</h2>
            <p className="text-xs text-muted-foreground">
              Takes the same path a real email does — same sender, same provider, same log — so a
              configuration mistake shows up here rather than on somebody&apos;s registration.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-muted-foreground dark:bg-white/[0.08]">
            {providerLabel || "—"}
          </span>
        </header>
        <div className="flex flex-col gap-2 p-5 sm:flex-row sm:px-6">
          <Input
            type="email"
            placeholder="you@example.org"
            value={testAddress}
            onChange={(e) => setTestAddress(e.target.value)}
            className="h-9 max-w-xs rounded-lg"
          />
          <Button size="sm" onClick={handleTest} disabled={testing || !testAddress.trim()}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send test
          </Button>
        </div>
      </section>

      <DataTable
        columns={columns}
        data={data?.rows ?? []}
        keyExtractor={(row) => row.id}
        isLoading={loading}
        skeletonRows={8}
        empty={{
          icon: Mail,
          title: "Nothing here",
          description:
            status === "failed"
              ? "No failures recorded. That is the good outcome."
              : "No messages match this filter yet.",
        }}
        pagination={{
          page,
          totalPages,
          totalItems: data?.total ?? 0,
          itemLabel: "message",
          onPageChange: setPage,
        }}
        toolbar={
          <>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatus(f.key)}
                  className={cn(
                    toolbarChip,
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                    status === f.key && "border-primary bg-primary text-primary-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipient, subject or template…"
              className="w-full sm:max-w-xs"
            />
          </>
        }
      />

      <AnimatePresence>
        {preview && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setPreview(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className={cn(heroSurface, "relative flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden")}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
                <p className="truncate text-sm font-semibold text-foreground">{preview.subject}</p>
                <Button variant="ghost" size="icon" onClick={() => setPreview(null)} className="h-8 w-8 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {/* Sandboxed: the stored HTML contains recipient data and, in the
                  contact templates, text a stranger wrote. It is rendered for
                  inspection, not trusted. */}
              <iframe
                title="Email preview"
                srcDoc={preview.html}
                sandbox=""
                className="h-full w-full flex-1 bg-white"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
