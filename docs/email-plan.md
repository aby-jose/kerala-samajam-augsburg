# Email System — Diagnosis & Rebuild

**Status: implemented.** Verified end to end on 12 Aug 2026 — a message sent through the real path
(`sendMail` → Resend → `EmailLog`) came back `delivered`, with the display name from site settings,
`reply_to` set from `config.contactEmail`, a preheader, a plain-text alternative and absolute links.

Part 1 records the original diagnosis. Parts 2–4 describe what was built; the phase numbering is kept
so the two halves line up.

**Still to do (deployment, not code):**

1. Set `CRON_SECRET` in the environment, or `/api/cron` refuses to run and no scheduled email is sent.
2. Set `NEXT_PUBLIC_APP_URL` / `SITE_URL` to the real host in production. The renderer now *throws*
   rather than sending localhost links, so this is fail-loud rather than fail-silent — but it means
   every email fails until it is set.
3. Decide the sending domain. Mail currently goes out as `noreply@kudukka.app`, which is verified and
   works; `keralasamajam.de` would need adding to Resend with SPF/DKIM/DMARC.
4. Fill in `config.legal` — street, postcode, register number, board members. The footer omits
   `{{PLACEHOLDER}}` values rather than printing them, so the Impressum block is currently partial.

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

## Part 4 — What was built

### Phase 0 — Transport and observability

**`src/lib/email/transport.ts`** — the provider layer, rewritten.

- The SMTP fallback is built lazily and only when `SMTP_HOST` is actually set. It no longer exists as
  a loaded gun reporting `ESOCKET` for every failure in the system.
- The real provider error always survives. When SMTP does run and also fails, its error is *appended*
  rather than substituted, because the Resend error is the one worth reading.
- Retries 429 and 5xx with backoff (0.4s, 1.2s); never retries a 4xx validation error, which would
  fail identically forever.
- `contentType` is kept on attachments.

**`src/lib/email/send.ts`** — the policy layer every send now goes through.

- `buildFrom` takes the display name from `config.email.fromName`, so the settings field is live for
  the first time. The address still prefers `EMAIL_FROM`, because it must belong to a verified domain
  — that is a deployment fact, not something an admin should be able to break by typing in a form.
  The settings screen now says so, and the address falls back to `config.email.fromEmail` when no
  environment value is set.
- `reply_to` is set from `config.contactEmail`. Nothing set one before, while the ticket email asked
  people to reply.
- Generates a `text/plain` alternative from the HTML.
- `once: true` gives idempotency, keyed on `(template, entityId)` against the log.
- Non-transactional mail checks the recipient's preferences, and carries `List-Unsubscribe` /
  `List-Unsubscribe-Post` headers.
- `sendMailBatch` paces broadcasts at ~2/second to stay inside the provider rate limit.

**`EmailLog` model** — every attempt writes a row: template, recipient, subject, status, provider id,
error, attempt count, entity id, and the rendered HTML. This is the audit trail, the failure list and
the idempotency guard.

**`/admin/emails`** — delivery log with counts, status filters, search, per-row preview (sandboxed
iframe) and resend. It leads with a **configuration warnings** panel that names the faults which make
every send fail at once: no provider, no sender, `SITE_URL` on localhost, missing `ADMIN_EMAIL`, and
an `EMAIL_FROM` that disagrees with Settings. Reading those off a wall of identical errors is how the
original problem stayed invisible.

**Send test** — on `/admin/emails` and in Settings, where the button previously had no handler at
all. It goes down the real path so a mistake shows up in seconds rather than on the next registration.

`@sendgrid/mail` removed. `.env.example` written and un-ignored.

### Phase 1 — Design system

`src/lib/email/` — `tokens.ts`, `components.ts`, `layout.ts`, `templates/`.

- **Tables and inline styles.** The old template was divs and CSS classes, which Outlook's Word engine
  largely ignores.
- **Bulletproof buttons** with a VML fallback, so a call to action does not collapse to a bare link.
- **Preheader** — `previewText` was accepted and thrown away; it is now a hidden, padded div.
- **Palette derived from `config.branding.primaryColor`,** not hardcoded. `onPrimary` and the link
  colour are chosen by measured WCAG contrast, so an unusual brand colour cannot produce an
  unreadable button. The live config turns out to be green, `#14801a`, not the rose default — exactly
  the drift the hardcoded `#e11d48` in the old ticket email was hiding.
- **Serif headlines** (Newsreader → Georgia). The one element that stops these reading as generic SaaS.
- **`siteOrigin()` throws** in production on a localhost value rather than mailing dead links.
- **Impressum footer** from `config.legal` — entity, address, Registergericht, § 26 BGB board.
  `{{PLACEHOLDER}}` values are omitted rather than printed.
- Dark-mode blocks, `color-scheme` meta, 600px, mobile media queries.
- All four unescaped interpolations fixed; `escUrl` drops non-http(s) schemes.
- **`/admin/emails/preview`** renders all 45 templates against fixtures, desktop and mobile.

`src/lib/email.ts` and `src/lib/email-templates.ts` are deleted; all 11 call sites import from
`src/lib/email`.

### Phases 2–3 — The emails themselves

Schema: `Event.status` (`SCHEDULED | POSTPONED | CANCELLED`), `cancellationReason`, `cancelledAt`.

| Trigger | Template | Where |
|---|---|---|
| Registration confirmed | `event.ticket` — rebuilt on the design system | `ticket-actions.ts` |
| Member cancels | `event.registration-cancelled` + admin copy | `cancelRegistration` |
| Admin removes a registration | `event.registration-removed` | `deleteRegistration` |
| Event cancelled | `event.cancelled`, broadcast | new `cancelEvent` action |
| Event reinstated | broadcast | new `reinstateEvent` |
| Date/venue changed | `event.rescheduled`, broadcast, diff-triggered | `upsertEvent` |
| Event full | `event.full` | `registerForEvent` capacity branch |
| New event announced | `event.announcement` | new `announceEvent` |
| Event fee recorded | `payment.event-recorded` | `recordRegistrationPayment` |
| Event fee reversed | `payment.event-reverted` | `revertRegistrationPayment` |
| Password changed | `account.password-changed` | `resetPassword` |
| Email address changed | `account.email-changed`, to **both** addresses + re-verification | `updateProfile` |
| Email verified | `account.welcome` | `verifyEmail` |
| Standard application | `membership.application-received` | `createMembershipSubscription` |
| Membership activated | `membership.active` / `membership.renewed` | `recordSubscriptionPayment` |
| Data export | `privacy.data-export-ready` | `exportMyData` |
| Erasure requested | `privacy.deletion-requested` + admin notice | `requestAccountDeletion` |
| Erasure withdrawn | `privacy.deletion-cancelled` | `cancelDeletionRequest` |
| Erasure carried out | `privacy.deletion-completed` | new `completeAccountDeletion` |

`completeAccountDeletion` is new machinery, not just an email: the request side existed and the
execution side did not, so a member could ask for erasure and nothing in the system could complete it.
It anonymises the profile, the sessions, the accounts and the email-keyed event registrations, keeps
the financial skeleton under § 147 AO / § 257 HGB, and sends the notice *before* clearing the address.

Deleting an event now notifies its registrants first, then removes the rows — previously the list of
people who needed to hear about it was destroyed along with the event.

### Phase 4 — Scheduled email

`src/lib/email-jobs.ts` plus `GET|POST /api/cron`, authenticated with a `CRON_SECRET` bearer token.
Unset, the endpoint **refuses to run** — an open URL that mails the whole membership is not a safe
default. `vercel.json` schedules it daily at 08:00.

One route, not five: every job is a daily sweep over a handful of rows, and five secrets and five
schedules is five chances for one to be silently forgotten. `?job=<name>` runs one by hand.

| Job | Does |
|---|---|
| `event-reminders` | T-2 days and morning-of. Optional — respects the reminder preference. |
| `post-event` | Day-after thank-you with the gallery link. Checked-in attendees, or all registrants if nobody worked the door. |
| `membership-lifecycle` | T-30, T-7, and expiry — which also corrects the status, so the member list stops disagreeing with the ledger. |
| `payment-reminders` | Overdue at the payment term and once more at +14 days. Two notices, never a daily nag. |
| `admin-digest` | Weekly committee summary. Silent in a week with nothing in it. |
| `log-retention` | Clears stored HTML after 90 days, so the log does not become a second copy of the membership database. |

Every job is idempotent via `once`, with the occasion in the key (`${subscriptionId}:30`) so next
year's notice is a different key from this year's.

### Phase 5 — Preferences

Three switches on `User` — announcements, reminders, newsletter. Transactional mail is deliberately
absent: offering to switch off a ticket or a receipt would be offering something we cannot honour.

- Preference panel in the profile's Privacy tab.
- `/unsubscribe?token=…&c=…` acts on page load rather than behind a button, because
  `List-Unsubscribe-Post` means Gmail fetches the URL with no browser attached. An **undo** is what
  makes that safe.
- The token column is indexed but **not unique** — MongoDB treats a missing field as `null`, so a
  unique index cannot build against an existing collection.

---

## Part 5 — Decisions taken

Answered with defaults so implementation could proceed. Any of these can change.

1. **Sending domain — kept `kudukka.app`.** It is verified and delivering. The address is a single
   env var, so moving to `keralasamajam.de` is a DNS job plus one variable, no code.
2. **Scheduler — `vercel.json` cron.** The endpoint takes a plain bearer token, so any external
   pinger works equally well if you are not on Vercel.
3. **Bilingual — English only for now.** The existing templates were English, and doubling the work
   mid-rebuild would have been the wrong order. `EmailContext` is the seam a `locale` would thread
   through when you want it.
4. **Broadcast scope — all current registrants.** A cancelled registration is a deleted row, so there
   is nobody else to include.
5. **Attachments — confirmations only.** Ticket and invoice PDFs ride the confirmation and the
   receipt; cancellation and change notices link instead. A resend from the admin log re-sends the
   stored HTML without attachments, so a lost ticket is re-issued from its own screen.
