import { Resend } from "resend";
import nodemailer from "nodemailer";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
};

const transporter = nodemailer.createTransport(smtpConfig);

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}) {
  const from = process.env.EMAIL_FROM || "Kerala Samajam <noreply@keralasamajam.de>";
  
  // Try Resend first
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
        attachments: attachments?.map(a => ({
          filename: a.filename,
          content: a.content as Buffer,
        })),
      });

      if (error) {
         console.error("Resend error:", error);
         throw error;
      }

      console.log(`Email sent via Resend to ${to}`, data);
      return { success: true, provider: "resend" };
    } catch (error: any) {
      console.error("Resend failed, trying SMTP fallback...", error);
    }
  }

  // Fallback to SMTP
  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments,
    });
    console.log(`Email sent via SMTP to ${to}`);
    return { success: true, provider: "smtp" };
  } catch (error) {
    console.error("SMTP fallback also failed:", error);
    return { success: false, error };
  }
}
