import NextAuth from "next-auth";
import { adminAuthOptions } from "@/lib/auth";

const handler = (req: any, ctx: any) => {
  const url = new URL(req.url);
  process.env.NEXTAUTH_URL = `${url.protocol}//${url.host}/api/admin/auth`;
  return NextAuth(req, ctx, adminAuthOptions);
};

export { handler as GET, handler as POST };

