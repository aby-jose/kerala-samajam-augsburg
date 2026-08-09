import NextAuth from "next-auth";
import { publicAuthOptions } from "@/lib/auth";

const handler = NextAuth(publicAuthOptions);
export { handler as GET, handler as POST };
