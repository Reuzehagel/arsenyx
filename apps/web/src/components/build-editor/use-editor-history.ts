import { useCallback, useReducer, useRef } from "react"

/**
 * Generic undo/redo stack for a single editor mount.
 *
 * The build editor spreads its state across the slot/arcane hooks and a dozen
 * `useState`s, with no single source of truth — so history is modeled as full
 * snapshots rather than a command log. The owner is responsible for two halves:
 *
 *   - `apply(snapshot)` — write a snapshot back into all the live setters.
 *   - a debounced effect that calls `commit(currentSnapshot)` after edits.
 *
 * The effect must funnel restore-driven changes through `consumeApply` so an
 * undo/redo doesn't get re-recorded as a brand-new edit (which would corrupt
 * the stacks). Snapshots are scoped to one EditorShell mount — a variant switch
 * remounts and starts fresh, which keeps cross-variant complexity out of here.
 */

const MAX_HISTORY = 100

export interface EditorHistory<T> {
  /**
   * Record a new history point. Pushes the prior baseline onto the undo stack
   * and clears the redo stack. The caller debounces this so a burst of edits
   * collapses into a single undo step.
   */
  commit: (snapshot: T) => void
  /**
   * Reconcile a snapshot that arrived from `undo`/`redo`. Returns true (and
   * swallows the change) when the snapshot is the one we just applied, so the
   * recording effect can bail before scheduling a spurious commit.
   */
  consumeApply: (snapshot: T) => boolean
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function useEditorHistory<T>(
  initial: T,
  apply: (snapshot: T) => void,
  /**
   * Treat a commit whose snapshot equals the current baseline as a no-op and
   * skip it. Guards against spurious entries — notably React StrictMode
   * double-invoking the recording effect on mount, which would otherwise seed
   * a phantom undo step before any real edit.
   */
  isEqual?: (a: T, b: T) => boolean,
): EditorHistory<T> {
  const past = useRef<T[]>([])
  const future = useRef<T[]>([])
  // The state the live editor currently reflects. Every commit/undo/redo keeps
  // this in lock-step with what's on screen.
  const baseline = useRef<T>(initial)
  const applying = useRef(false)
  // canUndo/canRedo derive from the ref stacks, so a render has to be forced
  // when they change — the refs alone won't trigger one.
  const [, bump] = useReducer((n: number) => n + 1, 0)

  const isEqualRef = useRef(isEqual)
  isEqualRef.current = isEqual

  const commit = useCallback((snapshot: T) => {
    if (isEqualRef.current?.(snapshot, baseline.current)) return
    past.current.push(baseline.current)
    if (past.current.length > MAX_HISTORY) past.current.shift()
    future.current = []
    baseline.current = snapshot
    bump()
  }, [])

  const consumeApply = useCallback((snapshot: T) => {
    if (!applying.current) return false
    applying.current = false
    baseline.current = snapshot
    return true
  }, [])

  const undo = useCallback(() => {
    if (past.current.length === 0) return
    const prev = past.current.pop() as T
    future.current.push(baseline.current)
    baseline.current = prev
    // Flag the restore so the recording effect skips it. Cleared synchronously
    // by the next `consumeApply`, which the apply's re-render triggers.
    applying.current = true
    apply(prev)
    bump()
  }, [apply])

  const redo = useCallback(() => {
    if (future.current.length === 0) return
    const next = future.current.pop() as T
    past.current.push(baseline.current)
    baseline.current = next
    applying.current = true
    apply(next)
    bump()
  }, [apply])

  return {
    commit,
    consumeApply,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  }
}
