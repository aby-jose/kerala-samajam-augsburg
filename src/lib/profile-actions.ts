"use server";

import { z } from "zod";
import { prisma } from "./prisma";
import { getServerSession } from "next-auth";
import { publicAuthOptions } from "./auth";
import { revalidatePath } from "next/cache";

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

  try {
    // Check if email is already taken by another user
    const isEmailChange = email.trim().toLowerCase() !== session.user.email?.toLowerCase();

    if (isEmailChange) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return { error: "Email is already in use by another account." };
      }
    }

    await prisma.user.update({
      where: { id: (session.user as any).id as string },
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

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Profile update error:", error);
    return { error: "Failed to update profile." };
  }
}
