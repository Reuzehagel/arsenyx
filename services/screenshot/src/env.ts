function required(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env: ${key}`)
  return value
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export const env = {
  PORT: Number(optional("PORT", "3000")),
  DATABASE_URL: required("DATABASE_URL"),
  R2_ACCOUNT_ID: required("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: required("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: required("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET: required("R2_BUCKET"),
  CF_ZONE_ID: required("CF_ZONE_ID"),
  CF_API_TOKEN: required("CF_API_TOKEN"),
  SHARED_SECRET: required("SHARED_SECRET"),
  ALLOWED_SCREENSHOT_ORIGINS: optional("ALLOWED_SCREENSHOT_ORIGINS", "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean),
  SCREENSHOT_BASE_URL: optional("SCREENSHOT_BASE_URL", "https://arsenyx.com"),
  PUBLIC_BASE_URL: optional("PUBLIC_BASE_URL", "https://ss.arsenyx.com"),
}
