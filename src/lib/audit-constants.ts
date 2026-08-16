/**
 * Shared between the "use server" audit action and the client page that
 * paginates against it. A "use server" file may only export async
 * functions, so this constant can't live in audit-actions.ts itself.
 */
export const AUDIT_PAGE_SIZE = 50;
