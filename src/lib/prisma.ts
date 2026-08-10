import { Prisma, PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = (globalThis.prismaGlobal && (globalThis.prismaGlobal as any).contactMessage) 
  ? globalThis.prismaGlobal 
  : prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

export const getPrisma = async () => prisma;

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
