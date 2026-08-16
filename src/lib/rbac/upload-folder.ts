export const CONTRIBUTION_FOLDER_PREFIX = "kerala-samajam/contributions/";

const DEFAULT_FOLDER = "kerala-samajam/gallery";

/**
 * Which Cloudinary folder an upload lands in.
 *
 * This used to ask "is the caller an admin", which was the same question as
 * "may the caller publish" only while every admin could do everything. Once
 * roles split, a Content Editor with no gallery permission would still have
 * cleared that check and written straight into the live gallery, skipping the
 * moderation queue every ordinary member goes through.
 *
 * `mayPublish` is `gallery.media.upload` resolved against the *admin* session.
 * An administrator browsing the public site therefore lands in the queue like
 * anyone else, which is the separation `guards.ts` already asks for: admin
 * capability is reached through the admin portal or not at all.
 */
export function resolveUploadFolder(opts: {
  mayPublish: boolean;
  requested?: string;
}): string {
  const requested = opts.requested || DEFAULT_FOLDER;
  if (opts.mayPublish) return requested;
  return requested.startsWith(CONTRIBUTION_FOLDER_PREFIX)
    ? requested
    : `${CONTRIBUTION_FOLDER_PREFIX}misc`;
}
