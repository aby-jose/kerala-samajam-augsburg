/**
 * Escape a value before it goes into email HTML.
 *
 * Names, subjects, album titles and contact messages all reach these templates
 * straight from a form. Unescaped, a sender could put markup — a link, a
 * styled block impersonating the committee — into the notification an
 * administrator reads. Not browser XSS, since mail clients do not run scripts,
 * but it is still attacker-controlled content rendered as markup to staff.
 */
export const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const PRIMARY_COLOR = "#e11d48";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "https://keralasamajam.de";
// Ensure APP_URL has protocol
const SITE_URL = APP_URL.startsWith("http") ? APP_URL : `https://${APP_URL}`;

// Robust fallback logo (publicly accessible)
const FALLBACK_LOGO = "https://res.cloudinary.com/dpkek2omd/image/upload/v1778549068/branding/gsqzrnfmhg6ugkocjmho.png";

export const getBaseEmailTemplate = (content: string, previewText: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => {
  const name = branding?.siteName || "Kerala Samajam Augsburg";
  const brandColor = branding?.primaryColor || PRIMARY_COLOR;

  // Use uploaded logo, or fallback to KSA official logo
  let logo = (branding?.logoUrl && branding.logoUrl.trim() !== "")
    ? branding.logoUrl
    : FALLBACK_LOGO;

  // If logo is relative, make it absolute
  if (logo && logo.startsWith("/")) {
    logo = `${SITE_URL}${logo}`;
  }

  // If we are on localhost and the logo is pointing to localhost, use the fallback for emails
  if (logo && (logo.includes("localhost") || logo.includes("127.0.0.1"))) {
    logo = FALLBACK_LOGO;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    
    .wrapper {
      width: 100%;
      background-color: #fafafa;
      padding: 60px 0;
    }
    
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 560px;
      border-spacing: 0;
      color: #1a1a1a;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid #f0f0f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    }
    
    .header {
      padding: 48px 40px 32px 40px;
      text-align: center;
      background-color: #ffffff;
    }
    
    .brand-name {
      color: #1a1a1a;
      font-size: 18px;
      font-weight: 800;
      margin: 0;
      letter-spacing: -0.01em;
      text-transform: uppercase;
    }
    
    .content {
      padding: 0 50px 60px 50px;
    }
    
    .footer {
      padding: 32px 40px;
      text-align: center;
      background-color: #fcfcfc;
      border-top: 1px solid #f0f0f0;
    }
    
    .title {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 16px 0;
      color: #1a1a1a;
      line-height: 1.3;
      letter-spacing: -0.02em;
    }
    
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #525252;
      margin-bottom: 24px;
    }
    
    .highlight-box {
      background-color: #fef2f2;
      border-radius: 16px;
      padding: 32px;
      text-align: center;
      margin: 32px 0;
    }
    
    .otp-code {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 0.3em;
      color: ${brandColor};
      margin: 0;
    }
    
    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: ${brandColor};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 700;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .footer-text {
      font-size: 11px;
      color: #a3a3a3;
      line-height: 1.6;
      font-weight: 500;
    }
 
    .accent-dot {
      height: 4px;
      width: 4px;
      background-color: ${brandColor};
      border-radius: 50%;
      margin: 0 auto 24px auto;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center">
      <tr>
        <td class="header">
          <div style="margin-bottom: 16px;">
            <img 
              src="${logo}" 
              alt="${name}" 
              width="64" 
              style="width: 64px; height: auto; display: inline-block;" 
            />
          </div>
          <h1 class="brand-name">${name}</h1>
        </td>
      </tr>
      <tr>
        <td class="content">
          <div class="accent-dot"></div>
          ${content}
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p class="footer-text">
            © ${new Date().getFullYear()} ${name}<br>
            Together as one.
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;
};

export const getOTPEmail = (code: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Verify your account</h2>
    <p class="text">To complete your membership application, please use the following security code. This code is valid for 10 minutes.</p>
    <div class="highlight-box">
      <h3 class="otp-code">${code}</h3>
    </div>
    <p class="text" style="font-size: 12px; margin-bottom: 0;">If you did not request this code, please ignore this email.</p>
  </div>
`, "Your verification code: " + code, branding);

export const getPasswordResetEmail = (url: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Reset your password</h2>
    <p class="text">We received a request to reset the password for your Kerala Samajam account. Click the button below to proceed.</p>
    <div style="margin: 32px 0;">
      <a href="${url}" class="button">Set New Password</a>
    </div>
    <p class="text" style="font-size: 12px; color: #a3a3a3; margin-bottom: 0;">This secure link will expire in 1 hour. If you didn't request a reset, no action is needed.</p>
  </div>
`, "Click to reset your password", branding);

export const getMembershipApplicationEmail = (planName: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Application Received</h2>
    <p class="text">Thank you for applying for the <b>${esc(planName)}</b> membership. Your application has been received and is currently being reviewed by our team.</p>
    <div class="highlight-box">
       <p class="text" style="margin-bottom: 0; font-weight: 600;">Status: Pending Verification</p>
    </div>
    <p class="text">We will notify you once your student status has been verified, and send you the payment details then. Your membership starts on the day we record your payment.</p>
  </div>
`, "We've received your membership application", branding);

export const getAdminNotificationEmail = (memberName: string, planName: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">New Application</h2>
    <p class="text">A new student membership application has been submitted and requires your attention.</p>
    <div class="highlight-box" style="text-align: left;">
       <p class="text" style="margin-bottom: 8px;"><b>Member:</b> ${esc(memberName)}</p>
       <p class="text" style="margin-bottom: 0;"><b>Plan:</b> ${esc(planName)}</p>
    </div>
    <div style="margin: 32px 0;">
      <a href="${SITE_URL}/admin/membership/applications" class="button">Review Application</a>
    </div>
  </div>
`, "New membership verification request", branding);

export const getApprovalEmail = (planName: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Student Status Verified</h2>
    <p class="text">Your student identity for the <b>${esc(planName)}</b> membership has been successfully verified.</p>
    <div class="highlight-box">
       <p class="text" style="margin-bottom: 0; font-weight: 600; color: #10b981;">Verification Successful</p>
    </div>
    <p class="text">The payment details follow in a separate email. Your membership begins on the day we record your payment, and we will confirm the exact dates then.</p>
    <div style="margin: 32px 0;">
      <a href="${SITE_URL}/profile" class="button">View Payment Details</a>
    </div>
  </div>
`, "Your student status has been verified", branding);

/**
 * How to pay. Sent when an application is accepted — for a student plan that
 * is after the ID is verified, so nobody is asked for money before we know
 * whether we will take it.
 */
export const getPaymentRequestEmail = (
  memberName: string,
  payment: {
    planName: string;
    amount: number;
    reference: string;
    dueDate: Date;
    accountHolder?: string;
    bankName?: string;
    iban?: string;
    bic?: string;
  },
  branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }
) => {
  const row = (label: string, value?: string) =>
    value
      ? `<tr><td style="padding: 6px 12px 6px 0; color: #737373; font-size: 13px;">${esc(label)}</td><td style="padding: 6px 0; font-size: 13px; font-weight: 600;">${esc(value)}</td></tr>`
      : "";

  return getBaseEmailTemplate(`
  <div>
    <h2 class="title" style="text-align: center;">Membership Payment Details</h2>
    <p class="text">Dear ${esc(memberName)}, thank you for joining. To activate your <b>${esc(payment.planName)}</b> membership, please transfer the amount below by <b>${payment.dueDate.toLocaleDateString("en-GB")}</b>.</p>
    <div class="highlight-box" style="text-align: left;">
      <table style="width: 100%; border-collapse: collapse;">
        ${row("Amount", `€${payment.amount.toFixed(2)}`)}
        ${row("Account Holder", payment.accountHolder)}
        ${row("Bank", payment.bankName)}
        ${row("IBAN", payment.iban)}
        ${row("BIC", payment.bic)}
        ${row("Reference", payment.reference)}
      </table>
    </div>
    <p class="text">Please quote the reference exactly — it is how we match your transfer to your membership. If you arranged to pay in cash, bring the amount to the next committee meeting or event instead.</p>
    <p class="text"><b>Your membership starts on the day we record your payment</b>, and runs for the full term from that date. We will email you a receipt confirming the exact dates. A copy of your invoice is attached.</p>
  </div>
`, `Membership payment details — €${payment.amount.toFixed(2)}`, branding);
};

/** Confirmation that the money arrived, carrying the term it bought. */
export const getPaymentReceivedEmail = (
  memberName: string,
  membership: {
    planName: string;
    amount: number;
    startDate?: Date | null;
    endDate?: Date | null;
    term: string;
  },
  branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }
) => {
  const fmt = (d?: Date | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

  return getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Payment Received — Welcome!</h2>
    <p class="text">Dear ${esc(memberName)}, we have recorded your payment of <b>€${membership.amount.toFixed(2)}</b> for the <b>${esc(membership.planName)}</b> membership. Your membership is now active.</p>
    <div class="highlight-box" style="text-align: left;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 12px 6px 0; color: #737373; font-size: 13px;">Member since</td><td style="padding: 6px 0; font-size: 13px; font-weight: 600;">${fmt(membership.startDate)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #737373; font-size: 13px;">Valid until</td><td style="padding: 6px 0; font-size: 13px; font-weight: 600;">${fmt(membership.endDate)}</td></tr>
        <tr><td style="padding: 6px 12px 6px 0; color: #737373; font-size: 13px;">Term</td><td style="padding: 6px 0; font-size: 13px; font-weight: 600;">${esc(membership.term)}</td></tr>
      </table>
    </div>
    <p class="text">Your receipt is attached. We will remind you before your membership is due for renewal.</p>
    <div style="margin: 32px 0;">
      <a href="${SITE_URL}/profile" class="button">Go to My Profile</a>
    </div>
  </div>
`, "Payment received — your membership is active", branding);
};

export const getRejectionEmail = (planName: string, reason?: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Application Update</h2>
    <p class="text">We have reviewed your application for the <b>${esc(planName)}</b> membership. Unfortunately, we could not verify your student status at this time.</p>
    ${reason ? `<div class="highlight-box"><p class="text" style="margin-bottom: 0;"><b>Reason:</b> ${esc(reason)}</p></div>` : ""}
    <p class="text">Please ensure your ID card photo is clear and valid, then you may try submitting a new application.</p>
  </div>
`, "Update regarding your membership application", branding);
export const getContributionNotificationEmail = (uploaderName: string, albumTitle: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">New Media Contribution</h2>
    <p class="text">A community member has shared their perspective for the <b>${esc(albumTitle)}</b> album.</p>
    <div class="highlight-box" style="text-align: left;">
       <p class="text" style="margin-bottom: 8px;"><b>Uploader:</b> ${esc(uploaderName)}</p>
       <p class="text" style="margin-bottom: 0;"><b>Album:</b> ${esc(albumTitle)}</p>
    </div>
    <div style="margin: 32px 0;">
      <a href="${SITE_URL}/admin/gallery/contributions" class="button">Review Contribution</a>
    </div>
  </div>
`, "New media contribution for review", branding);

export const getContributionApprovalEmail = (albumTitle: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Media Approved!</h2>
    <p class="text">Great news! Your contribution to the <b>${esc(albumTitle)}</b> collection has been approved and is now visible to the community.</p>
    <div class="highlight-box">
       <p class="text" style="margin-bottom: 0; font-weight: 600; color: #10b981;">Published to Gallery</p>
    </div>
    <p class="text">Thank you for sharing your perspective with Kerala Samajam Augsburg.</p>
    <div style="margin: 32px 0;">
      <a href="${SITE_URL}/gallery" class="button">View Gallery</a>
    </div>
  </div>
`, "Your media contribution was approved!", branding);

export const getContributionRejectionEmail = (albumTitle: string, reason?: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Contribution Update</h2>
    <p class="text">We have reviewed your submission for the <b>${esc(albumTitle)}</b> album. Unfortunately, we couldn't include it in the collection at this time.</p>
    ${reason ? `<div class="highlight-box"><p class="text" style="margin-bottom: 0;"><b>Reason:</b> ${esc(reason)}</p></div>` : ""}
    <p class="text">We appreciate your participation and encourage you to share other moments that align with our community standards.</p>
  </div>
`, "Update regarding your media contribution", branding);

export const getVerificationEmail = (verifyLink: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Verify Your Account</h2>
    <p class="text">Welcome to the Kerala Samajam Augsburg community! Please verify your email address to activate your member portal.</p>
    <div style="margin: 32px 0;">
      <a href="${verifyLink}" class="button">Verify Email Address</a>
    </div>
    <p class="text" style="font-size: 14px; color: #64748b;">This verification link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
  </div>
`, "Verify your email address", branding);

export const getContactAdminNotificationEmail = (name: string, email: string, subject: string, message: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">New Inquiry Received</h2>
    <p class="text">A new message has been sent through the contact form on the website.</p>
    
    <div class="highlight-box" style="text-align: left;">
       <p class="text" style="margin-bottom: 8px;"><b>From:</b> ${esc(name)}</p>
       <p class="text" style="margin-bottom: 8px;"><b>Email:</b> ${email}</p>
       <p class="text" style="margin-bottom: 16px;"><b>Subject:</b> ${esc(subject)}</p>
       <div style="padding-top: 16px; border-top: 1px solid #fecaca; margin-top: 8px;">
         <p class="text" style="margin-bottom: 0; white-space: pre-wrap;">${esc(message)}</p>
       </div>
    </div>
    
    <div style="margin: 32px 0;">
      <a href="mailto:${esc(email)}" class="button">Reply to ${esc(name)}</a>
    </div>
  </div>
`, `New message from ${esc(name)}: ${esc(subject)}`, branding);

export const getContactUserConfirmationEmail = (name: string, subject: string, branding?: { logoUrl?: string; siteName?: string; primaryColor?: string }) => getBaseEmailTemplate(`
  <div style="text-align: center;">
    <h2 class="title">Namaskaram ${esc(name)}!</h2>
    <p class="text">We've received your message regarding <b>"${esc(subject)}"</b>. Thank you for reaching out to us.</p>
    
    <div class="highlight-box">
       <p class="text" style="margin-bottom: 0; font-weight: 600; color: ${branding?.primaryColor || PRIMARY_COLOR};">Message Received Successfully</p>
    </div>
    
    <p class="text">Our team is reviewing your inquiry and will get back to you as soon as possible, typically within 1-2 business days.</p>
    
    <div style="margin: 32px 0;">
      <a href="${SITE_URL}" class="button">Back to Website</a>
    </div>
  </div>
`, "We've received your inquiry - Kerala Samajam Augsburg", branding);

/*
 * `getInvoiceEmail` lived here. It announced "Payment Successful — your
 * membership is now active" alongside the invoice PDF, which was only ever
 * true because the gateway had already taken the money before it was sent.
 *
 * It is now two templates, because a member is billed before they pay:
 * `getPaymentRequestEmail` (here is what you owe and how to pay it) and
 * `getPaymentReceivedEmail` (we recorded it; here are your term dates).
 */
