import { Prisma, PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    // Query logging is noisy and prints parameter values, which on this schema
    // includes email addresses and reset tokens. Opt in with PRISMA_LOG_QUERIES
    // when actually debugging rather than for every dev request.
    log:
      process.env.PRISMA_LOG_QUERIES === "true"
        ? ["query", "error", "warn"]
        : ["error", "warn"],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

/**
 * One client per process, reused across hot reloads in development.
 *
 * The previous form gated reuse on `globalThis.prismaGlobal.contactMessage`
 * being present — a workaround for a stale client after a schema change. The
 * cost was that any time that check failed it built *another* client without
 * disposing the old one, and each carries its own connection pool, so a few
 * reloads could exhaust the database's connection limit. If the cached client
 * is ever stale now, restart the dev server; that is the honest fix.
 */
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

/**
 * "This consent has not been withdrawn."
 *
 * On MongoDB, Prisma omits optional fields that were never given a value, so a
 * `revokedAt: null` filter — which asks for a field that *exists* and holds
 * null — silently matches nothing, even though reads return `revokedAt: null`.
 * Matching both the unset and the explicitly-null case is the only form that
 * works for rows written either way.
 *
 * Getting this wrong is not a cosmetic bug: it made every member look like
 * they had never consented, so the re-consent modal would never clear.
 */
export const NOT_REVOKED: Prisma.UserConsentWhereInput = {
  OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }],
};
