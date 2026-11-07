/**
 * Lua → JS reader for wiki module mirrors in `data/raw/wiki/`.
 *
 * Each mirrored file is the raw `Module:Foo/data` Lua source the wiki serves
 * via `?action=raw`, with a four-line attribution header prepended by
 * `sync-wiki.ts`. The bodies are pure-data table literals (the parent
 * `Module:Weapons/data` router uses `mw.loadData`, which forbids functions
 * or metatables in the loaded module — that contract is what makes them
 * safe to luaparse).
 *
 * We parse the file, walk to the top-level `return <table>` statement, and
 * convert the AST into the equivalent plain JS object. Anything we don't
 * support (function expressions, arithmetic ops, table concat, etc.) throws
 * loudly with the source line number — the mirror is deliberately not
 * sed-patched; if a wiki edit introduces unsupported syntax, file a wiki
 * ticket or add a curated override, don't paper over it here.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { parse as luaparse } from "luaparse"

import { RAW_WIKI_DIR } from "./paths"

// `luaparse` types are loose: every node carries arbitrary fields and the
// shape depends on the node `type`. We type the few we care about at use
// sites; treating the AST as `any` here keeps the file readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any

/** Modules sync-wiki.ts mirrors. `Module:Weapons/data/{primary,...}` are the
 *  eight subpages declared by the router; the rest are independent top-level
 *  Module pages. All are pure data per the upstream contract.
 *
 *  `Modular/data` carries the per-combination stat modifiers for Kitguns and
 *  Zaws (chamber/grip/loader and strike/grip/link tables). DE ships modular
 *  parts as zero-stat shells, so this module is the only verifiable source for
 *  the reconstructed stats — see merge-modular.ts. */
export const WIKI_MODULES = [
  "Weapons/data/primary",
  "Weapons/data/secondary",
  "Weapons/data/melee",
  "Weapons/data/archwing",
  "Weapons/data/companion",
  "Weapons/data/railjack",
  "Weapons/data/modular",
  "Weapons/data/misc",
  "Warframes/data",
  "Companions/data",
  "Arcane/data",
  "Mods/data",
  "Modular/data",
  // Per-ability stat values, each tagged with the mod stat it scales by
  // (Modifier) — see merge-ability-stats.ts.
  "Ability/data/stats",
] as const

export type WikiModule = (typeof WIKI_MODULES)[number]

/** `Weapons/data/primary` → `Weapons_data_primary.lua`. */
export function wikiModuleFile(module: string): string {
  return module.replace(/\//g, "_") + ".lua"
}

/** Parse one mirrored module from data/raw/wiki/. */
export function readWiki(module: WikiModule): Record<string, unknown> {
  return readWikiModule(resolve(RAW_WIKI_DIR, wikiModuleFile(module)))
}

/** Every `Weapons/data/*` module in WIKI_MODULES, sorted by file name (a
 *  later subpage wins a duplicate weapon name; the sort keeps the order the
 *  old directory scan had). */
export function readWikiWeaponSubpages(): Record<string, unknown>[] {
  return WIKI_MODULES.filter((m) => m.startsWith("Weapons/data/"))
    .map(wikiModuleFile)
    .sort()
    .map((n) => readWikiModule(resolve(RAW_WIKI_DIR, n)))
}

/** Walk a parsed module and yield every record `isRecord` accepts, without
 *  descending into it. Tables nest arbitrarily (Mods_data has a top-level
 *  `DefaultUpgrades` subtable; Warframes_data has Warframes / Archwings /
 *  Necramechs / Operators; per-slot Weapons_data_* are flat). */
function* walkWikiRecords(
  obj: unknown,
  isRecord: (rec: Record<string, unknown>) => boolean,
): Generator<Record<string, unknown>> {
  if (!obj || typeof obj !== "object") return
  const rec = obj as Record<string, unknown>
  if (isRecord(rec)) {
    yield rec
    return
  }
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") yield* walkWikiRecords(v, isRecord)
  }
}

const nonEmpty = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0

/** Every record carrying an `InternalName` (= DE uniqueName), whole, so
 *  callers can pluck arbitrary fields (IsExilus, Polarity, …). */
export function* iterWikiRecords(
  obj: unknown,
): Generator<{ internalName: string; record: Record<string, unknown> }> {
  for (const record of walkWikiRecords(obj, (r) => nonEmpty(r["InternalName"])))
    yield { internalName: record["InternalName"] as string, record }
}

/** `(InternalName, Image)` pairs. Unlike `iterWikiRecords`, a record with an
 *  InternalName but no Image is descended into. */
export function* iterWikiImageEntries(
  obj: unknown,
): Generator<{ internalName: string; image: string }> {
  for (const rec of walkWikiRecords(
    obj,
    (r) => nonEmpty(r["InternalName"]) && nonEmpty(r["Image"]),
  ))
    yield {
      internalName: rec["InternalName"] as string,
      image: rec["Image"] as string,
    }
}

/** Tracks bare identifiers we've already warned about — keeps logs readable
 *  when the same wiki typo recurs across many weapon entries. */
const seenUnquotedIdents = new Set<string>()

function readWikiModule(path: string): Record<string, unknown> {
  const src = readFileSync(path, "utf8")
  // We use encodingMode "none" because luaparse's pseudo-latin1 and
  // x-user-defined modes both reject source code points beyond U+00FF, and
  // wiki module strings legitimately contain U+2019 (smart apostrophe in
  // "Mag's"), U+014D (ō in some Tenno names), etc. The cost is that
  // StringLiteral.value comes back as `null` and we have to unescape `.raw`
  // ourselves (`luaUnescape` below).
  const ast = luaparse(src, {
    comments: false,
    locations: true,
    encodingMode: "none",
  })

  // Collect top-level locals so we can resolve `local Foo = {...}; return Foo`.
  // We only need *table* locals; everything else is a parser/helper we ignore.
  const locals = new Map<string, Node>()
  for (const stmt of ast.body) {
    if (stmt.type !== "LocalStatement") continue
    for (let i = 0; i < (stmt.variables?.length ?? 0); i++) {
      const v = stmt.variables[i]
      const init = stmt.init?.[i]
      if (
        v?.type === "Identifier" &&
        init?.type === "TableConstructorExpression"
      ) {
        locals.set(v.name as string, init)
      }
    }
  }

  const ret = ast.body.find((n: Node) => n.type === "ReturnStatement") as
    | { arguments: Node[] }
    | undefined
  if (!ret) throw new Error(`No return statement in ${path}`)
  let arg: Node | undefined = ret.arguments[0]
  if (!arg) throw new Error(`return has no argument in ${path}`)

  // `return { ... }` (most modules) or `return Foo` (a local, e.g. Mods/data).
  if (arg.type === "Identifier") {
    const resolved = locals.get(arg.name as string)
    if (!resolved) {
      throw new Error(
        `return references unknown local "${arg.name as string}" in ${path}`,
      )
    }
    arg = resolved
  }

  const result = luaToJs(arg, path)
  if (typeof result !== "object" || result === null || Array.isArray(result)) {
    throw new Error(`Top-level return in ${path} is not a table`)
  }
  return result as Record<string, unknown>
}

/**
 * Decode a Lua string literal as it appears in source. `raw` is the literal
 * text from the source file *including* the surrounding delimiter — one of:
 *   - `"..."` — double-quoted, escapes processed
 *   - `'...'` — single-quoted, escapes processed
 *   - `[[...]]`, `[=[...]=]`, etc. — long bracket, escapes literal
 */
function luaUnescape(raw: string): string {
  if (raw.startsWith("[")) {
    // Long-bracket string. Match `[=*[` ... `]=*]` with matching count.
    const open = raw.match(/^\[(=*)\[/)
    if (!open)
      throw new Error(`Malformed long-bracket string: ${raw.slice(0, 32)}`)
    const eq = open[1] ?? ""
    const inner = raw.slice(open[0].length, raw.length - (eq.length + 2))
    // Lua strips a leading \n if present.
    return inner.startsWith("\n") ? inner.slice(1) : inner
  }
  const quote = raw[0]
  if (quote !== '"' && quote !== "'") {
    throw new Error(`Unrecognized string literal: ${raw.slice(0, 32)}`)
  }
  const inner = raw.slice(1, -1)
  let out = ""
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!
    if (ch !== "\\") {
      out += ch
      continue
    }
    const next = inner[++i]
    switch (next) {
      case "a":
        out += "\x07"
        break
      case "b":
        out += "\b"
        break
      case "f":
        out += "\f"
        break
      case "n":
        out += "\n"
        break
      case "r":
        out += "\r"
        break
      case "t":
        out += "\t"
        break
      case "v":
        out += "\v"
        break
      case "\\":
        out += "\\"
        break
      case '"':
        out += '"'
        break
      case "'":
        out += "'"
        break
      case "\n":
        out += "\n"
        break
      case "x": {
        const hex = inner.slice(i + 1, i + 3)
        if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
          throw new Error(`Bad \\x escape in ${raw.slice(0, 64)}`)
        }
        out += String.fromCharCode(parseInt(hex, 16))
        i += 2
        break
      }
      case "u": {
        // \u{HHHH} unicode escape.
        if (inner[i + 1] !== "{") {
          throw new Error(
            `Bad \\u escape (expected '{') in ${raw.slice(0, 64)}`,
          )
        }
        const close = inner.indexOf("}", i + 2)
        if (close < 0)
          throw new Error(`Unterminated \\u{} in ${raw.slice(0, 64)}`)
        const hex = inner.slice(i + 2, close)
        out += String.fromCodePoint(parseInt(hex, 16))
        i = close
        break
      }
      case "z": {
        // \z skips following whitespace.
        while (i + 1 < inner.length && /\s/.test(inner[i + 1]!)) i++
        break
      }
      default: {
        // \ddd decimal byte (1-3 digits).
        if (next !== undefined && /[0-9]/.test(next)) {
          let digits = next
          while (digits.length < 3 && /[0-9]/.test(inner[i + 1] ?? "")) {
            digits += inner[++i]!
          }
          out += String.fromCharCode(parseInt(digits, 10))
          break
        }
        throw new Error(
          `Unknown Lua escape \\${next ?? "<EOF>"} in ${raw.slice(0, 64)}`,
        )
      }
    }
  }
  return out
}

function luaToJs(node: Node, path: string): unknown {
  switch (node.type) {
    case "TableConstructorExpression": {
      // Lua distinguishes positional values (`{ "a", "b" }` → array) from
      // keyed entries (`{ Name = "x" }` or `{ ["Name"] = "x" }` → object).
      // Wiki modules mix both patterns: e.g. `Polarities = { "Naramon", ... }`
      // is an array, while `["Coda Bubonico"] = { ... }` is an object key.
      // If every field is a TableValue, we emit an array; otherwise we emit
      // an object, treating any positional values as 1-based numeric keys
      // (matching Lua semantics).
      const fields: Node[] = node.fields
      const allValue = fields.every((f) => f.type === "TableValue")
      if (allValue) {
        return fields.map((f) => luaToJs(f.value, path))
      }
      const obj: Record<string, unknown> = {}
      let pos = 1
      for (const f of fields) {
        if (f.type === "TableValue") {
          obj[String(pos++)] = luaToJs(f.value, path)
        } else if (f.type === "TableKey") {
          // ["Coda Bubonico"] = ...  — key is an expression we resolve
          const key = luaToJs(f.key, path)
          if (typeof key !== "string" && typeof key !== "number") {
            throw new Error(
              `Non-string/number table key (${typeof key}) in ${path}`,
            )
          }
          obj[String(key)] = luaToJs(f.value, path)
        } else if (f.type === "TableKeyString") {
          // Name = ...  — key is a bare identifier
          obj[f.key.name as string] = luaToJs(f.value, path)
        } else {
          throw new Error(`Unhandled table field type: ${f.type} in ${path}`)
        }
      }
      return obj
    }
    case "StringLiteral":
      // `.value` is null under encodingMode "none". `.raw` includes the
      // surrounding quotes and any Lua escape sequences. We decode it
      // ourselves.
      return luaUnescape(node.raw as string)
    case "NumericLiteral":
      return node.value as number
    case "BooleanLiteral":
      return node.value as boolean
    case "NilLiteral":
      return null
    case "UnaryExpression":
      if (node.operator === "-") {
        const arg = luaToJs(node.argument, path)
        if (typeof arg !== "number") {
          throw new Error(`Unary minus applied to non-number in ${path}`)
        }
        return -arg
      }
      throw new Error(
        `Unsupported unary operator ${node.operator as string} in ${path}`,
      )
    case "BinaryExpression": {
      // Wiki data uses arithmetic for derived stats — e.g. `HeavyAttack = 510 * 2`.
      // We constant-fold the supported operators; everything else fails loud.
      const left = luaToJs(node.left, path)
      const right = luaToJs(node.right, path)
      const op = node.operator as string
      if (op === "..") {
        // String concat is well-defined on strings and numbers in Lua.
        return String(left) + String(right)
      }
      if (typeof left !== "number" || typeof right !== "number") {
        throw new Error(
          `Non-numeric operands to "${op}" at line ${node.loc?.start?.line ?? "?"} in ${path}`,
        )
      }
      switch (op) {
        case "+":
          return left + right
        case "-":
          return left - right
        case "*":
          return left * right
        case "/":
          return left / right
        case "%":
          return left % right
        case "^":
          return Math.pow(left, right)
        default:
          throw new Error(`Unsupported binary operator "${op}" in ${path}`)
      }
    }
    case "Identifier": {
      // Wiki editors occasionally type `False`/`True`/`Nil` (capitalized)
      // instead of the lowercase Lua literals. Lua treats those as unknown
      // identifiers → `nil` at runtime, so the wiki page renders fine but
      // semantically the field is missing. We honour intent and silently
      // normalize the four obvious typo shapes.
      const name = node.name as string
      const lower = name.toLowerCase()
      if (lower === "true") return true
      if (lower === "false") return false
      if (lower === "nil") return null
      // Anything else is most often an unquoted string in a context where
      // strings are expected — e.g. `Procs = { "", Knockdown, "" }` where
      // the editor forgot the quotes. We treat it as a string of its own
      // name (matching the editor's intent) and log a one-time warning so
      // a human can patch the wiki upstream. We track names we've warned
      // about to avoid spamming the build output when a typo appears in
      // dozens of weapon entries.
      if (!seenUnquotedIdents.has(name)) {
        seenUnquotedIdents.add(name)
        console.warn(
          `[read-wiki] unquoted identifier "${name}" at line ${node.loc?.start?.line ?? "?"} in ${path} — treating as the string "${name}". Likely a missing quote on the wiki.`,
        )
      }
      return name
    }
    case "MemberExpression": {
      // Wiki data legitimately uses `math.huge` (positive infinity, e.g.
      // for instant-fire weapons) and occasionally `math.pi`. We resolve a
      // small allow-list of math constants; any other member expression is
      // an unsupported reference and fails loud.
      const base = node.base
      const ident = node.identifier
      if (
        base?.type === "Identifier" &&
        base.name === "math" &&
        ident?.type === "Identifier"
      ) {
        if (ident.name === "huge") return Number.POSITIVE_INFINITY
        if (ident.name === "pi") return Math.PI
        if (ident.name === "maxinteger") return Number.MAX_SAFE_INTEGER
        if (ident.name === "mininteger") return Number.MIN_SAFE_INTEGER
      }
      throw new Error(
        `Unsupported member expression "${base?.name as string}.${ident?.name as string}" at line ${node.loc?.start?.line ?? "?"} in ${path}`,
      )
    }
    default:
      throw new Error(
        `Unhandled Lua node type "${node.type as string}" at line ${node.loc?.start?.line ?? "?"} in ${path}`,
      )
  }
}
