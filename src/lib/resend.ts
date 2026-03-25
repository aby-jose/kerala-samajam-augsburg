import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: "KSA <noreply@ksaugsburg.de>",
      to,
      subject,
      react,
    });

    if (error) {
      console.error("Email Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("Unexpected Email Error:", err);
    return { success: false, error: err };
  }
}
