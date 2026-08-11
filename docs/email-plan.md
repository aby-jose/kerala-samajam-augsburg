# Email System — Diagnosis & Rebuild Plan

Status: proposal. Nothing here has been implemented yet.

---

## Part 1 — Why emails are not working

The provider is **not** the problem. I checked the live Resend account with the key in `.env`:

- Domain `kudukka.app` — **verified**, sending enabled, region `eu-west-1`.
- `EMAIL_FROM="noreply@kudukka.app"` matches that verified domain.
- API key `kerala-samajam` is live and was last used today.
- The one email in the send log (`Verify Your Email`, 9 Aug) shows `last_event: delivered`.

So the pipe works. What is broken is everything around it.

### 1.1 Every failure is swallowed — this is the root cause

`sendEmail` in [email.ts:71-74](../src/lib/email.ts#L71-L74) catches all errors and returns `{ success: false, error }`. Out of the ~15 call sites, exactly **one** — `requestPasswordReset` at [auth-actions.ts:210](../src/lib/auth-actions.ts#L210) — reads the return value. Everywhere else:

```ts
await sendEmail({ ... });   // return value discarded
```

An email that never sends looks identical to one that did. Nothing is written to the database, nothing surfaces in the admin panel, nothing alerts. "Emails are not working" has no fingerprint anywhere in the system — which is exactly the symptom being reported.

### 1.2 The SMTP fallback is a fiction that hides the real error

`.env` has no `SMTP_HOST`, `SMTP_USER` or `SMTP_PASSWORD`. I confirmed the behaviour: `nodemailer.createTransport` with an undefined host succeeds at module load, then every `sendMail` dies with `ESOCKET`.

The damage is worse than a dead fallback. Look at the control flow in [email.ts:48-58](../src/lib/email.ts#L48-L58) — the real Resend error is logged and then **discarded** as the code falls through to SMTP. The value returned to the caller carries the meaningless `ESOCKET` from the phantom SMTP transport, not the actionable Resend error (`domain not verified`, `invalid attachment`, `rate limit`, `validation_error`).

### 1.3 The admin email settings are dead wiring

The settings page has From Name and From Email fields at [settings/page.tsx:708-712](<../src/app/admin/(dashboard)/settings/page.tsx#L708-L712>), validated by a Zod schema and persisted into `config.email`. `sendEmail` never reads them — it only ever reads `process.env.EMAIL_FROM` at [email.ts:32](../src/lib/email.ts#L32). An admin who changes the sender address changes nothing, with no error to tell them.

### 1.4 Env drift will point every link at localhost

`.env` has `SITE_URL="http://localhost:3000"` and no `NEXT_PUBLIC_APP_URL` at all. Every button in every email — Verify Email, Set New Password, Review Application, Go to My Profile — is built from those two variables. If this env is what production runs, every call to action in every email is a dead localhost link.

The base template guards against this for the **logo** ([email-templates.ts:41-43](../src/lib/email-templates.ts#L41-L43)) but not for links. That guard is a tell: someone already hit the localhost problem and patched the visible half.

### 1.5 The sender domain does not match the brand

Mail goes out as `noreply@kudukka.app` for an association called Kerala Samajam Augsburg. SPF/DKIM pass — for the wrong domain. Recipients see a mismatch between the display name and the address, which is the exact shape spam filters and cautious humans look for.

No `reply_to` is ever set either, and the ticket email literally says *"If you have any questions, please reply to this email"* ([ticket-actions.ts:78](../src/lib/ticket-actions.ts#L78)) — into a noreply box on an unrelated domain.

### 1.6 The ticket email can fail before it starts, silently

In `registerForEvent` at [event-actions.ts:460-465](../src/lib/event-actions.ts#L460-L465), the entire ticket send sits inside a `try/catch` that only calls `console.error`. If `generateTicketPDF` throws — a config fetch, the QR render, a font — the member gets nothing and the action still returns `{ success: true }`. Same swallow, one layer up.

### 1.7 Smaller faults found on the way

| Issue | Where |
|---|---|
| `previewText` is accepted by the base template and never rendered — no preheader, so inboxes show the logo alt text | [email-templates.ts:26](../src/lib/email-templates.ts#L26) |
| The ticket email is hand-rolled inline HTML that ignores the base template and hardcodes `#e11d48` | [ticket-actions.ts:47-82](../src/lib/ticket-actions.ts#L47-L82) |
| `${registration.name}` and `${registration.event.title}` interpolated unescaped, while the rest of the codebase carefully uses `esc()` | [ticket-actions.ts:53-59](../src/lib/ticket-actions.ts#L53-L59) |
| `${email}` unescaped in the admin contact notification while every sibling field is escaped | [email-templates.ts:407](../src/lib/email-templates.ts#L407) |
| `contentType` is dropped when attachments are mapped for Resend | [email.ts:42-45](../src/lib/email.ts#L42-L45) |
| `@sendgrid/mail` is an unused dependency — a third mail provider nobody calls | `package.json` |
| `@import` of Google Fonts is stripped by Gmail; Manrope/Newsreader never load, and there is no matching fallback stack | [email-templates.ts:53](../src/lib/email-templates.ts#L53) |

### 1.8 Immediate verification steps

Before building anything, confirm which of the above is biting in the deployed environment:

1. Check the production env for `EMAIL_FROM`, `SITE_URL`, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL`, `RESEND_API_KEY`. `ADMIN_EMAIL` missing will make `adminEmail()` **throw** and take the whole membership application down ([admin-contact.ts:17-22](../src/lib/admin-contact.ts#L17-L22)).
2. Trigger one registration and one membership application, then read the server logs for `Resend error:` / `Failed to auto-send ticket`.
3. Cross-check against the Resend dashboard: an email that appears there but bounced is a deliverability problem; an email that never appears is a code problem.

---

## Part 2 — Email inventory

### Already sending

| Trigger | To | Template |
|---|---|---|
| Account registration | Member | `getVerificationEmail` |
| Membership OTP | Member | `getOTPEmail` |
| Password reset request | Member | `getPasswordResetEmail` |
| Student application received | Member | `getMembershipApplicationEmail` |
| Student application received | Admin | `getAdminNotificationEmail` |
| Student status verified | Member | `getApprovalEmail` |
| Application rejected | Member | `getRejectionEmail` |
| Membership payment due | Member | `getPaymentRequestEmail` + invoice PDF |
| Membership payment received | Member | `getPaymentReceivedEmail` + receipt PDF |
| Event registration | Member | inline HTML + ticket PDF — **needs rebuild** |
| Gallery contribution submitted | Admin | `getContributionNotificationEmail` |
| Gallery contribution approved/rejected | Member | `getContribution*Email` |
| Contact form | Admin + Member | `getContact*Email` |

### To add — Events

| # | Trigger | To | Hook point | Priority |
|---|---|---|---|---|
| E1 | Registration confirmed (rebuilt on the design system) | Member | `sendEventTicket` | **P0** |
| E2 | Member cancels own registration | Member | `cancelRegistration` [event-actions.ts:502](../src/lib/event-actions.ts#L502) | **P0** |
| E3 | Member cancels own registration | Admin | same | P1 |
| E4 | Admin removes a registration | Member | `deleteRegistration` [event-actions.ts:568](../src/lib/event-actions.ts#L568) | **P0** |
| E5 | Event cancelled — broadcast to all registrants | Members | needs new action + schema field | **P0** |
| E6 | Event date/venue changed — broadcast | Members | `upsertEvent`, diff-triggered | **P0** |
| E7 | Reminder, 48h before | Members | cron | P1 |
| E8 | Reminder, morning of | Members | cron | P2 |
| E9 | Post-event thank-you + gallery link | Members | cron, day after | P2 |
| E10 | Check-in confirmation | Member | `toggleCheckIn` | P3 |
| E11 | Event full — nudge to the waitlist | Prospect | `registerForEvent` capacity branch | P2 |
| E12 | New event published | Members opted in | `toggleEventPublish` | P2 |

E5 and E6 need schema work: `Event` has no `status` field, so there is currently no way to represent a cancelled event at all ([schema.prisma:86-109](../prisma/schema.prisma#L86-L109)). Add `status EventStatus @default(SCHEDULED)` with `SCHEDULED | CANCELLED | POSTPONED`, plus `cancellationReason String?`.

### To add — Payments

| # | Trigger | To | Hook point | Priority |
|---|---|---|---|---|
| P1 | Event fee recorded as paid | Member | `recordRegistrationPayment` [payment-actions.ts:124](../src/lib/payment-actions.ts#L124) | **P0** |
| P2 | Event fee payment reversed | Member | `revertRegistrationPayment` | P2 |
| P3 | Membership payment overdue (due date passed) | Member | cron | P1 |
| P4 | Second overdue notice, +14d | Member | cron | P2 |
| P5 | Membership expiring in 30 days | Member | cron | **P0** |
| P6 | Membership expiring in 7 days | Member | cron | P1 |
| P7 | Membership expired | Member | cron | **P0** |
| P8 | Weekly payments digest | Admin | cron | P2 |

P1 is the sharpest gap: an admin marks a bank transfer as received and the member is never told. They hold a ticket that still says "amount due" and have no receipt.

### To add — Membership

| # | Trigger | To | Priority |
|---|---|---|---|
| M1 | Welcome / onboarding once membership goes ACTIVE (what your membership gets you, member-only events, profile link) | Member | P1 |
| M2 | Non-student application received — acknowledgement | Member | P1 |
| M3 | Membership renewed | Member | P1 |
| M4 | Membership cancelled or lapsed | Member | P2 |
| M5 | Membership card / digital ID | Member | P3 |

M2 is a real hole: a student applicant gets an acknowledgement, but a standard applicant goes straight to a payment demand with no "we received this" first ([membership-actions.ts:277-297](../src/lib/membership-actions.ts#L277-L297)).

### To add — Account & security

| # | Trigger | To | Priority |
|---|---|---|---|
| A1 | Email verified — welcome | Member | P1 |
| A2 | Password changed confirmation | Member | **P0** (security: this is how a member learns of a takeover) |
| A3 | Email address changed — notice to **both** old and new address | Member | **P0** |
| A4 | New sign-in from an unrecognised device | Member | P3 |
| A5 | Admin account created / role granted | Admin | P2 |

### To add — GDPR

The consent system is built but sends nothing. Under Art. 12(3) GDPR a data subject must be *informed* of the outcome of a request; a page that renders a JSON blob is thin evidence that you did.

| # | Trigger | To | Hook point | Priority |
|---|---|---|---|---|
| G1 | Data export ready | Member | `exportMyData` [privacy-actions.ts:121](../src/lib/privacy-actions.ts#L121) | P1 |
| G2 | Deletion requested — acknowledgement with the deadline | Member | `requestAccountDeletion` | **P0** |
| G3 | Deletion request — admin action needed | Admin | same | **P0** |
| G4 | Deletion request cancelled | Member | `cancelDeletionRequest` | P1 |
| G5 | Deletion completed | Member | on execution | **P0** |
| G6 | Biometric consent granted / withdrawn | Member | `grantBiometricConsent` / `withdraw…` | P2 |
| G7 | Legal document revised — notice + re-consent link | Members | `legal-actions` publish | P1 |

### Total

13 existing (1 needing a rebuild) + **37 new**. P0 subset: 12.

---

## Part 3 — Email design system

### Brand tokens, pulled from the live site

Read out of [globals.css](../src/app/globals.css) rather than reinvented, so email and site cannot drift:

| Token | Value | Use |
|---|---|---|
| Primary | `#e11d48` (`hsl(346.8 77.2% 49.8%)`) | Buttons, rules, accent marks |
| Primary tint | `#fff1f2` | Highlight panels |
| Primary deep | `#9f1239` | Button hover, dark accents |
| Ink | `#1a1a1a` | Headings |
| Body | `#525252` | Paragraphs |
| Muted | `#a3a3a3` | Footer, captions |
| Hairline | `#f0f0f0` | Borders, dividers |
| Canvas | `#fafafa` | Page background outside the card |
| Success | `#059669` · Warning `#d97706` · Danger `#dc2626` | Status blocks only |
| Sans | Manrope → `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial` | Body |
| Serif | Newsreader → `Georgia, 'Times New Roman', serif` | Headlines |

The serif headline is what makes these read as *this* association and not a generic SaaS receipt. Georgia is on essentially every client, so the fallback carries the same character when Manrope and Newsreader are stripped.

Every colour stays overridable from `config.branding`, as the current templates already allow.

### Structural rules

The current template is well-intentioned but fragile in real inboxes:

- **`<div>` layout and CSS classes only.** Outlook desktop uses the Word rendering engine. It ignores `border-radius`, `box-shadow`, `max-width` on divs, and much of the class-based styling. → Rebuild on nested `<table role="presentation">` with **inline styles**, keeping `<style>` in the head only as progressive enhancement (media queries, hover).
- **`@import` for Google Fonts.** Stripped by Gmail and Outlook. → `<link>` plus `@font-face`, with the fallback stack declared inline on every element so the unfonted render is deliberate rather than accidental.
- **560px card.** → 600px, the width every email client and template tests against.
- **No preheader.** → Render `previewText` as a hidden div, followed by whitespace padding so no body text leaks into the inbox snippet.
- **No dark-mode handling.** Gmail and Outlook.com force-invert light emails, which turns `#fff1f2` panels muddy. → `<meta name="color-scheme" content="light">` + `supported-color-schemes`, and a `prefers-color-scheme` block picking explicit dark values instead of accepting the client's inversion.
- **Plain `<a>` buttons.** Outlook renders these as bare links. → Bulletproof buttons: VML fallback in an MSO conditional comment.
- **Single-column card only.** No layout survives everywhere else.

### Component library

One base plus a fixed set of blocks, so a new email is composed, never hand-written:

```
layout/
  base(content, { previewText, branding })   preheader · logo · card · footer
components/
  heading(text, level)                       serif, 3 sizes
  paragraph(html)
  button(label, href, variant)               primary | secondary | ghost
  panel(rows, tone)                          neutral | success | warning | danger
  detailTable(rows)                          label/value pairs (event, payment, term)
  divider()
  codeBlock(code)                            OTP
  eventCard(event)                           date · time · venue · map link
  amountBlock(amount, currency, status)
  footer(config)                             Impressum · contact · unsubscribe
```

### Footer requirements

German law and GDPR both bear on this. Every email footer carries:

- Registered name, legal form, street, postcode, city (`config.legal`)
- Registergericht and Vereinsregister number
- Board members per § 26 BGB
- Contact email and a working `reply_to`
- One-click unsubscribe on **non-transactional** mail only — never on tickets, receipts, or password resets
- `List-Unsubscribe` and `List-Unsubscribe-Post` headers on the same non-transactional mail (Gmail and Yahoo require these for bulk senders)

### Preview harness

A dev-only route rendering every template against fixture data, so a template can be reviewed without triggering a real workflow:

```
/admin/dev/emails            gallery of every template
/admin/dev/emails/[key]      full render, ?fixture=variant
```

Gated behind `NODE_ENV !== "production"` and an admin session.

---

## Part 4 — Implementation phases

### Phase 0 — Make it work and make it visible (½ day)

Nothing else matters until failures are observable.

1. Rewrite `sendEmail`:
   - Read from-address from `config.email` with `EMAIL_FROM` as fallback, so the settings page stops lying.
   - Set `reply_to` from `config.contactEmail`.
   - Drop the SMTP fallback, or gate it behind `if (process.env.SMTP_HOST)` so it stops masking the real error.
   - Preserve and return the actual provider error.
   - Retry 5xx and rate limits with backoff; never retry a 4xx validation error.
   - Keep `contentType` on attachments.
2. Add an `EmailLog` model — recipient, template key, subject, status, provider id, error, related entity id, `createdAt`. Every send writes a row.
3. Add an admin screen at `/admin/emails`: recent sends, failures highlighted, resend button.
4. Fix env: set `SITE_URL` / `NEXT_PUBLIC_APP_URL` to the real host in production; confirm `ADMIN_EMAIL` is set (it throws if missing).
5. Add `keralasamajam.de` (or `ksaugsburg.de`) to Resend, verify SPF/DKIM/DMARC, and move `EMAIL_FROM` onto it.
6. Remove `@sendgrid/mail`.

### Phase 1 — Design system (1½ days)

7. Build `src/lib/email/` — `layout.ts`, `components.ts`, `tokens.ts`, `templates/`.
8. Port the 13 existing templates onto it. Behaviour-preserving; only the markup changes.
9. Render `previewText` as a real preheader on all of them.
10. Escape the four unescaped interpolations.
11. Build the preview harness and check the P0 set through Litmus or Email on Acid — Gmail web, Gmail Android, Apple Mail, iOS Mail, Outlook 365 desktop, Outlook.com.

### Phase 2 — P0 emails (1½ days)

12. Rebuild the event ticket on the design system (E1).
13. Registration cancelled — member and admin (E2, E3, E4).
14. Event cancelled / rescheduled, with the `EventStatus` schema change and a broadcast action (E5, E6).
15. Event payment recorded (P1).
16. Password changed, email changed (A2, A3).
17. GDPR deletion flow — request, admin notice, completion (G2, G3, G5).

### Phase 3 — P1 emails (1 day)

18. Membership welcome, non-student acknowledgement, renewal (M1, M2, M3).
19. Account welcome after verification (A1).
20. Data export ready, deletion cancelled, legal revision notice (G1, G4, G7).

### Phase 4 — Scheduled emails (1 day)

Needs a scheduler — Vercel Cron if you are on Vercel, otherwise a `node-cron` worker or an external ping. All routes authenticated with `CRON_SECRET`.

21. `/api/cron/event-reminders` — daily, T-48h and morning-of (E7, E8)
22. `/api/cron/membership-lifecycle` — daily, T-30 / T-7 / expired (P5, P6, P7)
23. `/api/cron/payment-reminders` — daily, overdue and second notice (P3, P4)
24. `/api/cron/post-event` — daily, day-after thank-you (E9)
25. `/api/cron/admin-digest` — weekly (P8)

Each of these needs an idempotency guard — a `sentAt` marker or an `EmailLog` lookup keyed on `(template, entityId)` — or a cron that runs twice mails everyone twice.

### Phase 5 — Preferences & polish (1 day)

26. `EmailPreference` model: event announcements, reminders, newsletter — transactional mail is never opt-out.
27. Preference centre on the profile page + one-click unsubscribe endpoint.
28. `List-Unsubscribe` headers on bulk mail.
29. Remaining P2/P3 emails.

**Total: 6–7 days.** Phase 0 alone will likely resolve the reported symptom, or at minimum tell you exactly what it is.

---

## Part 5 — Decisions needed before starting

1. **Sending domain.** Keep `kudukka.app`, or verify `keralasamajam.de` / `ksaugsburg.de`? This affects trust and deliverability more than anything else in the plan. `config.contactEmail` currently says `info@ksaugsburg.de`.
2. **Scheduler.** Is this on Vercel (Cron available on Pro), or self-hosted?
3. **Bilingual?** The membership base is German-resident. English-only, or DE/EN with a `locale` on `User`? This roughly doubles Phase 1–3 template work, so it is much cheaper to decide now than to retrofit.
4. **Broadcast scope for E5/E6.** All registrants including cancelled ones, or active only?
5. **Attachment policy.** Ticket PDFs on cancellation/change emails too, or link-only?
