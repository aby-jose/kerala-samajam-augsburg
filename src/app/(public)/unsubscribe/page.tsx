import Link from "next/link";
import { CheckCircle2, MailX, Undo2 } from "lucide-react";

import { Container } from "@/components/layout/container";
import { unsubscribeByToken } from "@/lib/email-preference-actions";
import { ResubscribeButton } from "./resubscribe-button";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe, reached from the footer of optional mail.
 *
 * The work happens on this page load rather than behind a confirmation button.
 * `List-Unsubscribe-Post` means Gmail and Yahoo will fetch this URL with no
 * browser attached and no way to click anything, so a page that only *offers*
 * to unsubscribe does not actually unsubscribe anyone — and those clients then
 * treat us as a sender who ignores the header.
 *
 * The undo is what makes that safe: acting first and offering to reverse it is
 * better than a member who wanted out having to prove it twice.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; c?: string }>;
}) {
  const { token, c } = await searchParams;

  if (!token) {
    return (
      <Shell icon={<MailX className="h-7 w-7 text-muted-foreground" />} title="Nothing to do here">
        <p>
          This page needs an unsubscribe link from one of our emails. If you would rather manage
          everything at once, your{" "}
          <Link href="/profile" className="font-semibold text-primary underline">
            profile settings
          </Link>{" "}
          have the full list.
        </p>
      </Shell>
    );
  }

  let result: { scope: string; email?: string } | null = null;
  let error: string | null = null;

  try {
    result = await unsubscribeByToken(token, c);
  } catch (e) {
    error = e instanceof Error ? e.message : "Something went wrong.";
  }

  if (error || !result) {
    return (
      <Shell icon={<MailX className="h-7 w-7 text-muted-foreground" />} title="That link did not work">
        <p>{error}</p>
        <p className="mt-4">
          You can change your preferences directly from your{" "}
          <Link href="/profile" className="font-semibold text-primary underline">
            profile
          </Link>
          , or reply to any of our emails and we will do it for you.
        </p>
      </Shell>
    );
  }

  return (
    <Shell icon={<CheckCircle2 className="h-7 w-7 text-emerald-600" />} title="Done — you're unsubscribed">
      <p>
        We have stopped sending <strong className="text-foreground">{result.scope}</strong>
        {result.email ? (
          <>
            {" "}
            to <strong className="text-foreground">{result.email}</strong>
          </>
        ) : null}
        .
      </p>
      <p className="mt-4">
        You will still receive things you need from us — event tickets, payment receipts, password
        resets and anything about your membership. Those are not marketing and we cannot switch them
        off.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <ResubscribeButton token={token} />
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Manage all preferences
        </Link>
      </div>
    </Shell>
  );
}

function Shell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="py-24 md:py-32">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">{icon}</div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        <div className="mt-4 text-base leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </Container>
  );
}
