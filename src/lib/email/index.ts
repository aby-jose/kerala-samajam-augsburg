/**
 * The email system's public surface.
 *
 * Application code should import from here and nowhere deeper — `sendMail` for
 * a single message, `sendMailBatch` for a broadcast, and `templates` for the
 * message itself. That keeps the transport, the logging and the preference
 * rules on one path, which is the whole point: the previous arrangement let
 * any module reach straight for a provider and drop the result on the floor.
 */

export {
  sendMail,
  sendMailBatch,
  getEmailContext,
  buildFrom,
  wasRedactedForStorage,
  renderFor,
} from "./send";
export type { SendMailOptions, SendMailResult, TemplateOutput, EmailCategory } from "./send";
export type { EmailContext, EmailDocument } from "./layout";
export { renderEmail } from "./layout";
export { renderMessage } from "./shell";
export type { Message, MessageContext, MessageSection, MessageClose } from "./shell";
export { deliver, transportStatus } from "./transport";
export { absoluteUrl, siteOrigin, buildTheme } from "./tokens";
export { esc } from "./components";

import * as account from "./templates/account";
import * as events from "./templates/events";
import * as membership from "./templates/membership";
import * as payments from "./templates/payments";
import * as gallery from "./templates/gallery";
import * as contact from "./templates/contact";
import * as privacy from "./templates/privacy";
import * as staff from "./templates/staff";

export const templates = { account, events, membership, payments, gallery, contact, privacy, staff };
