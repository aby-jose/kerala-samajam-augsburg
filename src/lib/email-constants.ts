/**
 * Shared between the "use server" email-admin actions and the client page
 * that paginates against them. A "use server" file may only export async
 * functions, so this constant can't live in email-admin-actions.ts itself.
 */
export const EMAIL_LOG_PAGE_SIZE = 50;
