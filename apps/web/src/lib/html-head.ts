// Bodies of the inline <head> scripts that vite.config.ts injects into index.html and
// embed.html, sharing their constants with the app. Import-free: vite.config
// loads this file directly.

export const THEME_STORAGE_KEY = "arsenyx-theme"

/** A static-data file's fetched URL: `?v=<data version>` lets the CDN serve
 *  `/data/*` immutable while a catalog regeneration busts it. */
export function versionedDataUrl(path: string, version: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}v=${version}`
}

/** Applies the stored theme before React mounts (no wrong-theme flash). In
 *  the embed iframe this reads the site's own storage, so an embed matches
 *  the theme the visitor picked on Arsenyx. Mirrors ThemeProvider. */
export function themeInitScript(): string {
  return `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||"system";if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`
}

/** The home hero waits on items-index.json; start that fetch in parallel
 *  with the JS bundle. `href` must equal staticDataQuery's URL or the preload
 *  is wasted. */
export function homePreloadScript(href: string): string {
  return `if(location.pathname==="/"){var l=document.createElement("link");l.rel="preload";l.as="fetch";l.crossOrigin="anonymous";l.href=${JSON.stringify(href)};document.head.appendChild(l)}`
}
