"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "./guards";
import { deleteFromCloudinary } from "./cloudinary";

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
  await requirePermission("content.leadership.edit");

  const validated = leadershipMemberSchema.parse(data);
  const { id, ...memberData } = validated;

  if (id) {
    // Read before the overwrite — the old photo's Cloudinary URL is only
    // recoverable from the row itself.
    const previous = await prisma.leadershipMember.findUnique({ where: { id }, select: { image: true } });

    await prisma.leadershipMember.update({
      where: { id },
      data: memberData,
    });

    // Best-effort — otherwise a replaced (or removed) photo stays live on
    // Cloudinary at its old URL forever, orphaned but still billed.
    if (previous?.image && previous.image !== memberData.image) {
      await deleteFromCloudinary(previous.image);
    }
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
  await requirePermission("content.leadership.edit");

  const member = await prisma.leadershipMember.findUnique({ where: { id }, select: { image: true } });

  await prisma.leadershipMember.delete({
    where: { id },
  });

  if (member?.image) await deleteFromCloudinary(member.image);

  revalidatePath("/about");
  revalidatePath("/admin/leadership");
  return { success: true };
}

export async function updateLeadershipOrder(items: { id: string; order: number }[]) {
  await requirePermission("content.leadership.edit");

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
