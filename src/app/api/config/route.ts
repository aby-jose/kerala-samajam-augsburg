import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { adminAuthOptions } from "@/lib/auth";

export async function GET() {
  try {
    const config = await prisma.config.findFirst({
      orderBy: { updatedAt: 'desc' }
    });
    
    return NextResponse.json(config || { key: "current", value: {} });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch configuration" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(adminAuthOptions);
    if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();
    
    const config = await prisma.config.upsert({
      where: { key: "current" },
      update: { value: data, updatedAt: new Date() },
      create: { key: "current", value: data },
    });

    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update configuration" }, { status: 500 });
  }
}
