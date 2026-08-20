"use client";

import * as React from "react";
import { FileClock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/data-table";
import { SearchInput } from "@/components/admin/ui/search-input";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/utils";
import { getAuditLog, type AuditEntry, type AuditLogPage } from "@/lib/audit-actions";

const ALL_ACTIONS = "ALL";

export default function AuditClient({
  initial,
  actionOptions,
}: {
  initial: AuditLogPage;
  actionOptions: { key: string; label: string }[];
}) {
  const { error: toastError } = useToast();
  const [data, setData] = React.useState<AuditLogPage>(initial);
  const [loading, setLoading] = React.useState(false);
  const [actorEmail, setActorEmail] = React.useState("");
  const [action, setAction] = React.useState<string>(ALL_ACTIONS);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(initial.page);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await getAuditLog({
          actorEmail: actorEmail.trim() || undefined,
          action: action === ALL_ACTIONS ? undefined : action,
          from: from || undefined,
          to: to || undefined,
          page,
        })
      );
    } catch (e) {
      toastError(getErrorMessage(e, "Could not load the audit log."));
    } finally {
      setLoading(false);
    }
  }, [actorEmail, action, from, to, page, toastError]);

  // The server already rendered `initial` for the default filters — the
  // first run of this effect is skipped so mounting doesn't repeat that
  // fetch. Only a filter or page change after that triggers one.
  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = setTimeout(load, actorEmail ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // A new filter invalidates the current page.
  React.useEffect(() => {
    setPage(1);
  }, [actorEmail, action, from, to]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  function actionLabel(key: string) {
    return actionOptions.find((o) => o.key === key)?.label ?? key;
  }

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: "when",
      header: "When",
      width: "w-[20%]",
      cellClassName: "whitespace-nowrap text-muted-foreground",
      render: (row) =>
        new Date(row.createdAt).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "actor",
      header: "Actor",
      width: "w-[17%]",
      cellClassName: "min-w-0",
      render: (row) => <p className="truncate text-sm text-foreground">{row.actorEmail}</p>,
    },
    {
      key: "action",
      header: "Action",
      width: "w-[16%]",
      cellClassName: "min-w-0",
      render: (row) => (
        <code className="block truncate rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {actionLabel(row.action)}
        </code>
      ),
    },
    {
      key: "summary",
      header: "Summary",
      width: "w-[29%]",
      cellClassName: "min-w-0",
      render: (row) => <p className="truncate text-sm text-foreground">{row.summary}</p>,
    },
    {
      key: "entity",
      header: "Entity",
      width: "w-[18%]",
      cellClassName: "min-w-0 truncate text-muted-foreground",
      render: (row) => (row.entity ? `${row.entity}${row.entityId ? ` · ${row.entityId.slice(-6)}` : ""}` : "—"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every mutating action taken in the admin panel — who did it, and when."
      />

      <DataTable
        columns={columns}
        data={data.entries}
        keyExtractor={(row) => row.id}
        isLoading={loading}
        skeletonRows={8}
        // The default per-column allowance (130px) is too tight for a
        // fixed-width "20 Aug 2026, 14:23" timestamp that never wraps — it
        // spilled past its cell into the Actor column. Give the table enough
        // room for every column's content and let it scroll horizontally
        // below that instead of crushing the date.
        minWidth={900}
        empty={{
          icon: FileClock,
          title: "No entries",
          description: "Nothing matches these filters yet.",
        }}
        pagination={{
          page,
          totalPages,
          totalItems: data.total,
          itemLabel: "entry",
          onPageChange: setPage,
        }}
        toolbar={
          <>
            <SearchInput
              placeholder="Filter by actor email…"
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              className="w-full sm:max-w-xs"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="h-10 w-full rounded-lg sm:w-56">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACTIONS}>All actions</SelectItem>
                  {actionOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* `placeholder` is a no-op on `<input type="date">` — every
                  browser renders its own locale format in its place, so
                  these two fields need a visible label to tell them apart. */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="audit-from" className="text-sm text-muted-foreground">
                  From
                </label>
                <Input
                  id="audit-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-10 w-[150px] rounded-lg"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="audit-to" className="text-sm text-muted-foreground">
                  To
                </label>
                <Input
                  id="audit-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-10 w-[150px] rounded-lg"
                />
              </div>
            </div>
          </>
        }
      />
    </div>
  );
}
