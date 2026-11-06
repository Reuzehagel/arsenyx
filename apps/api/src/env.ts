export const webOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean)

// Cookie Secure/SameSite flags follow BETTER_AUTH_URL's scheme, not NODE_ENV:
// if NODE_ENV were ever unset in prod, a NODE_ENV check would silently drop
// Secure + SameSite=None and cross-origin login would break.
export const isHttps =
  process.env.BETTER_AUTH_URL?.startsWith("https://") === true
