import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete"
import type { Extension } from "@codemirror/state"

/** A mod/arcane the `[[` autocomplete can insert — see guide-refs.ts for the
 *  reference syntax this expands to. */
export type RefCandidate = {
  kind: "mod" | "arcane"
  uniqueName: string
  name: string
  /** Disambiguator shown dimmed after the name (e.g. "Warframe", "Rifle"). */
  detail?: string
}

/**
 * `[[` typeahead for guide-ref links (issue #228). Typing `[[vita` offers
 * matching mods/arcanes; picking one replaces the `[[query` text with the
 * resolved markdown link `[Vitality](mod:/Lotus/…)`. Candidates are read
 * through a getter because the catalogs load async (React Query) after the
 * editor mounts — the extension itself is created once.
 *
 * Plain `[` keeps its normal markdown-link meaning; only a double bracket
 * triggers the popup, so prose with brackets doesn't get ambushed.
 */
export function refAutocomplete(
  getCandidates: () => RefCandidate[],
): Extension {
  // The mapped options (~1800 objects + apply closures) are cached on the
  // candidate array's identity — the caller memoizes it per catalog load, so
  // re-triggering `[[` reuses the same options instead of re-allocating.
  let cachedFor: RefCandidate[] | undefined
  let cachedOptions: Completion[] = []

  const optionsFor = (candidates: RefCandidate[]): Completion[] => {
    if (candidates === cachedFor) return cachedOptions
    cachedFor = candidates
    cachedOptions = candidates.map((c) => ({
      label: c.name,
      detail: c.detail,
      type: c.kind === "mod" ? "variable" : "constant",
      apply: (view, _completion, from, to) => {
        // `from` is the result position (after `[[`); also remove the
        // brackets themselves, plus a trailing `]]` the author (or an
        // auto-close pair) may have already typed after the cursor.
        const after = view.state.sliceDoc(to, to + 2)
        const end = after === "]]" ? to + 2 : after[0] === "]" ? to + 1 : to
        view.dispatch({
          changes: {
            from: from - 2,
            to: end,
            insert: `[${c.name}](${c.kind}:${c.uniqueName})`,
          },
        })
      },
    }))
    return cachedOptions
  }

  const source = (context: CompletionContext): CompletionResult | null => {
    // Everything from `[[` to the cursor, same line, no closing bracket yet.
    const match = context.matchBefore(/\[\[[^\][\n]*$/)
    if (!match) return null
    // Without explicit invocation, require at least one typed character so
    // bare `[[` doesn't pop a 1600-entry list.
    if (!context.explicit && match.to - match.from < 3) return null

    return {
      // Position after `[[` so CodeMirror filters labels against the typed
      // query, not the brackets.
      from: match.from + 2,
      options: optionsFor(getCandidates()),
      // Keep this result active (re-filtered client-side) while the user
      // keeps typing name characters — avoids re-running the source per key.
      validFor: /^[^\][\n]*$/,
    }
  }

  return autocompletion({
    override: [source],
    icons: false,
    // The list is long; cap rendering work.
    maxRenderedOptions: 40,
  })
}
