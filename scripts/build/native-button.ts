/**
 * Finds shadcn `<Button>` tags that render a non-<button> element (a Link,
 * an <a>) without `nativeButton={false}`. Base UI logs a console error for
 * those and drops native button semantics. Returns the 1-based line of each
 * offending tag.
 *
 * shortcut: scans characters, not a real JSX parse — a `{`/`}` or `>` inside
 * a string attribute can end a tag early. Upgrade to the TS compiler API if
 * that ever misfires.
 */
export function findNativeButtonOffenders(source: string): number[] {
  const lines: number[] = []
  const openRe = /<Button(?=[\s/>])/g
  for (let m = openRe.exec(source); m; m = openRe.exec(source)) {
    const tag = openingTag(source, m.index)
    const render = /\brender=\{\s*\(?\s*<([A-Za-z][\w.]*)/.exec(tag)
    if (!render || render[1] === "button") continue
    if (/\bnativeButton\b/.test(tag)) continue
    lines.push(source.slice(0, m.index).split("\n").length)
  }
  return lines
}

/** The text of the JSX opening tag starting at `start`, up to its closing
 *  `>` at brace depth 0 (so `render={<Link />}` stays inside the tag). */
function openingTag(source: string, start: number): string {
  let depth = 0
  for (let i = start + 1; i < source.length; i++) {
    const c = source[i]
    if (c === "{") depth++
    else if (c === "}") depth--
    else if (c === ">" && depth === 0) return source.slice(start, i + 1)
  }
  return source.slice(start)
}
