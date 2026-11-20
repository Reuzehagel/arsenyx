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

/** Starts the static-data fetches a route's loader waits on in parallel with
 *  the JS bundle, instead of after it. Keys are exact pathnames, or a prefix
 *  ending in `/*` (which needs at least one more character). Each href must
 *  equal staticDataQuery's URL or the preload is wasted. */
export function dataPreloadScript(byPath: Record<string, string[]>): string {
  return `(function(){var p=location.pathname,m=${JSON.stringify(byPath)};for(var k in m){var w=k.slice(-2)==="/*",b=w?k.slice(0,-1):k;if(w?p.indexOf(b)===0&&p.length>b.length:p===b)m[k].forEach(function(h){var l=document.createElement("link");l.rel="preload";l.as="fetch";l.crossOrigin="anonymous";l.href=h;document.head.appendChild(l)})}})()`
}
