// Field length limits the API enforces and the web forms mirror as
// `maxLength`, so a form can't accept text the server then truncates.

/** Tightened from 50 after someone used the name field as a billboard. */
export const ORG_NAME_MAX = 32
export const ORG_SLUG_MAX = 30
export const ORG_DESCRIPTION_MAX = 200

export const DISPLAY_USERNAME_MAX = 50
export const USERNAME_MAX = 30

/** Build name; the editor input mirrors it as `maxLength`. */
export const BUILD_NAME_MAX = 120

/** Free-text `?q=` search terms on the user/org/admin directories. */
export const SEARCH_Q_MAX = 100
/** Free-text `?q=` / `?item=` on the build lists and typeahead. */
export const BUILD_SEARCH_Q_MAX = 200

/** How many orgs one user may own (be ADMIN of). Raised per-user by hand if a
 *  real community ever needs more — the limit exists because someone spun up
 *  a pile of orgs to spam the directory. */
export const MAX_ORGS_PER_USER = 3

/** What the API stores for a build's guide summary. */
export const GUIDE_SUMMARY_MAX = 400
/** The guide editor's input limit — tighter than what the API stores
 *  (GUIDE_SUMMARY_MAX), which stays the server-side cap. */
export const GUIDE_SUMMARY_EDITOR_MAX = 160
