"use server";

import { z } from "zod";
import { prisma } from "./prisma";
import { getServerSession } from "next-auth";
import { publicAuthOptions } from "./auth";
import { revalidatePath } from "next/cache";
import { absoluteUrl, sendMail, templates } from "./email";
import { nanoid } from "nanoid";

const profileSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  zip: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
});

export async function updateProfile(data: z.infer<typeof profileSchema>) {
  const session = await getServerSession(publicAuthOptions);

  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const validatedFields = profileSchema.safeParse(data);

  if (!validatedFields.success) {
    return { error: "Invalid form data" };
  }

  const { name, email, phone, address, city, zip, dob, occupation, bio, image } = validatedFields.data;

  const userId = (session.user as any).id as string;
  const previousEmail = session.user.email || "";

  try {
    // Check if email is already taken by another user
    const isEmailChange = email.trim().toLowerCase() !== previousEmail.toLowerCase();

    if (isEmailChange) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return { error: "Email is already in use by another account." };
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        // A changed address is unproven until it is verified again.
        //
        // Event registrations are keyed by email string — there is no user id
        // on them — so an account that could silently adopt a *verified*
        // address inherited that person's registrations, and `exportMyData`
        // would hand them over under Art. 15. Dropping the flag here, and
        // requiring verification before email-matched records are returned,
        // is what closes that.
        ...(isEmailChange ? { emailVerified: null } : {}),
        phone,
        address,
        city,
        zip,
        dob: dob ? new Date(dob) : null,
        occupation,
        bio,
        image,
      },
    });

    // A changed sign-in address is a security event, so it is announced to the
    // address that is losing control as well as the one gaining it. Notifying
    // only the new address would let someone who has taken over a session move
    // the account somewhere else without the owner ever hearing about it — the
    // old inbox is the owner's last channel, and this is the last message we
    // can send down it.
    if (isEmailChange && previousEmail) {
      for (const [audience, recipient] of [
        ["old", previousEmail],
        ["new", email],
      ] as const) {
        await sendMail({
          template: `account.email-changed.${audience}`,
          to: recipient,
          entityId: userId,
          build: (ctx) =>
            templates.account.emailChanged(ctx, {
              name,
              oldEmail: previousEmail,
              newEmail: email,
              audience,
            }),
        });
      }

      // The address is unverified again (see above), so re-issue the link
      // rather than leaving the member to hunt for a "resend" button.
      const token = nanoid(32);
      await prisma.verificationToken.create({
        data: { identifier: email, token, expires: new Date(Date.now() + 24 * 3600000) },
      });
      await sendMail({
        template: "account.verify-email",
        to: email,
        entityId: userId,
        build: (ctx) =>
          templates.account.verifyEmail(ctx, {
            verifyLink: absoluteUrl(`/verify-email?token=${token}`),
          }),
      });
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Profile update error:", error);
    return { error: "Failed to update profile." };
  }
}
