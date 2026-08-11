import { useRef } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { useHotkey } from "@/lib/hooks/hotkeys"
import { useUrlSearchInput } from "@/lib/hooks/use-url-search-input"

/**
 * Search box for the public directories (`/orgs`, `/users`). Owns the debounce
 * and the `/` focus hotkey so the two pages stay in step.
 *
 * `value` is the committed query from the URL and `onSearch` writes it back —
 * the local input state in between is `useUrlSearchInput`'s job.
 */
export function DirectorySearch({
  value,
  onSearch,
  placeholder,
  label,
}: {
  value: string
  onSearch: (next: string) => void
  placeholder: string
  label: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [local, setLocal] = useUrlSearchInput(value, onSearch)

  useHotkey("/", () => {
    inputRef.current?.focus()
    inputRef.current?.select()
  })

  return (
    <InputGroup>
      <InputGroupInput
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
      {!local && (
        <InputGroupAddon align="inline-end">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
