import { PrismaClient } from "@prisma/client";

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const getPrisma = () => {
  if (typeof window !== "undefined") return null as unknown as PrismaClient;
  if (!globalThis.prisma) {
    globalThis.prisma = prismaClientSingleton();
  }
  return globalThis.prisma;
};

export const prisma = new Proxy({} as PrismaClient, {
  get: (target, prop) => {
    const p = getPrisma();
    return (p as unknown as Record<string | symbol, unknown>)[prop];
  }
});
