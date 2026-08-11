"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "./guards";

const leadershipMemberSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name is required"),
  role: z.string().min(2, "Role is required"),
  image: z.string().optional().nullable(),
  order: z.number().default(0),
});

export type LeadershipMemberValues = z.infer<typeof leadershipMemberSchema>;

export async function getLeadershipMembers() {
  return await prisma.leadershipMember.findMany({
    orderBy: { order: "asc" },
  });
}

export async function upsertLeadershipMember(data: LeadershipMemberValues) {
  await requireAdmin();

  const validated = leadershipMemberSchema.parse(data);
  const { id, ...memberData } = validated;

  if (id) {
    await prisma.leadershipMember.update({
      where: { id },
      data: memberData,
    });
  } else {
    await prisma.leadershipMember.create({
      data: memberData,
    });
  }

  revalidatePath("/about");
  revalidatePath("/admin/leadership");
  return { success: true };
}

export async function deleteLeadershipMember(id: string) {
  await requireAdmin();

  await prisma.leadershipMember.delete({
    where: { id },
  });
  
  revalidatePath("/about");
  revalidatePath("/admin/leadership");
  return { success: true };
}

export async function updateLeadershipOrder(items: { id: string; order: number }[]) {
  await requireAdmin();

  const updates = items.map((item) =>
    prisma.leadershipMember.update({
      where: { id: item.id },
      data: { order: item.order },
    })
  );

  await Promise.all(updates);
  revalidatePath("/about");
  return { success: true };
}
