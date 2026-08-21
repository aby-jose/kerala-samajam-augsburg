"use server";

import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";

import { prisma } from "./prisma";
import { requireStaff } from "./guards";
import { persistentRateLimit } from "./rate-limit";
import { BCRYPT_ROUNDS, passwordSchema } from "./password-rules";
import { sendMail, templates } from "./email";
import { validateUpload } from "./upload-validation";
import { deleteFromCloudinary, uploadToCloudinary } from "./cloudinary";

/**
 * Self-service password change for a signed-in staff member.
 *
 * `requireStaff()` only establishes that *someone* is signed in as staff —
 * unlike `requirePermission`, it opens no audit row, so this writes its own
 * `auditLog` entry directly once the change succeeds, the same way
 * `acceptInvite` does for the identical reason.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  if (!currentPassword || !newPassword) return { error: "Missing required fields" };

  const passwordCheck = passwordSchema.safeParse(newPassword);
  if (!passwordCheck.success) {
    return { error: passwordCheck.error.issues[0].message };
  }

  const actor = await requireStaff();

  // Counted per account: without this, a stolen or left-open session becomes
  // an unlimited oracle for guessing the current password.
  const { ok } = await persistentRateLimit(`changepw:${actor.id}`, 5, 60 * 60 * 1000);
  if (!ok) {
    return { error: "Too many attempts. Please try again later." };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user?.password || !(await bcrypt.compare(currentPassword, user.password))) {
      return { error: "Current password is incorrect" };
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const changedAt = new Date();

    // `passwordChangedAt` is what evicts every other signed-in session — the
    // jwt callback rejects tokens issued before it, exactly as a forced
    // reset does.
    await prisma.user.update({
      where: { id: actor.id },
      data: { password: hashedPassword, passwordChangedAt: changedAt },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "account.change-password",
        summary: `${actor.email} changed their own password`,
        entity: "User",
        entityId: actor.id,
      },
    });

    if (user.email) {
      await sendMail({
        template: "account.password-changed",
        to: user.email,
        entityId: actor.id,
        build: (ctx) =>
          templates.account.passwordChanged(ctx, { name: user.name || "there", changedAt }),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Change password error:", error);
    return { error: "Failed to change password" };
  }
}

/**
 * Self-service avatar upload for a signed-in staff member.
 *
 * Reuses the same validation and Cloudinary folder as the public member
 * upload (`uploadProfileImage` in `upload-actions.ts`) — only the guard
 * differs. `uploadProfileImage` authorizes via `getCurrentUser()`, the
 * *public* member session, which a pure-admin session does not carry; this
 * is its admin-authorized equivalent rather than a shared function, so
 * neither guard has to learn about the other portal.
 */
export async function updateAvatar(formData: FormData) {
  const actor = await requireStaff();

  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  try {
    const { buffer } = await validateUpload(file, "image");
    const imageUrl = await uploadToCloudinary(buffer, "profile_pics");

    const previous = await prisma.user.findUnique({ where: { id: actor.id }, select: { image: true } });
    await prisma.user.update({ where: { id: actor.id }, data: { image: imageUrl } });
    revalidatePath("/admin/account");

    // Best-effort — the old avatar otherwise stays live on Cloudinary at its
    // old URL forever, orphaned but still billed. Safe even if it was never
    // a Cloudinary asset (e.g. inherited from an OAuth provider's own profile
    // picture) — deleteFromCloudinary just can't parse a public_id from that
    // and skips it.
    if (previous?.image && previous.image !== imageUrl) {
      await deleteFromCloudinary(previous.image);
    }

    return { url: imageUrl };
  } catch (error) {
    console.error("Avatar upload error:", error);
    return { error: error instanceof Error ? error.message : "Failed to upload image" };
  }
}
