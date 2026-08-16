import { getInviteForToken } from "@/lib/invite-actions";
import { AcceptClient } from "./accept-client";

/**
 * Unauthenticated by design — `proxy.ts` exempts `/admin/invite` from the
 * session gate so an invited person can reach it before they have an
 * account. That means this page carries its own validation: whatever
 * `getInviteForToken` will not vouch for renders the same generic message,
 * regardless of whether the token was never valid, has expired, was already
 * used, or was revoked. See `GENERIC_INVITE_ERROR` in `invite-actions.ts`.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteForToken(token);

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold text-zinc-900">This link is no longer valid</h1>
        <p className="mt-3 text-zinc-500">
          Invitations expire after 72 hours and can only be used once. Ask the
          committee to send you a new one.
        </p>
      </main>
    );
  }

  return <AcceptClient token={token} email={invite.email} roleName={invite.roleName} />;
}
