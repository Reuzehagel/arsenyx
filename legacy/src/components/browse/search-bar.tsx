"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { Icons } from "@/components/icons"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  defaultValue?: string
  placeholder?: string
  className?: string
  /** Optional callback for client-side filtering (bypasses URL updates) */
  onSearchChange?: (value: string) => void
}

export function SearchBar({
  defaultValue = "",
  placeholder = "Search items...",
  className,
  onSearchChange,
}: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement>(null)
  const searchParamsString = searchParams.toString()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [inputValue, setInputValue] = useState(defaultValue)
  const inputValueRef = useRef(inputValue)

  useEffect(() => {
    inputValueRef.current = inputValue
  }, [inputValue])

  const handleSearch = useCallback(
    (value: string) => {
      // If client-side callback provided, use that instead of URL updates
      if (onSearchChange) {
        onSearchChange(value)
        return
      }
      const params = new URLSearchParams(searchParamsString)
      if (value) {
        params.set("q", value)
      } else {
        params.delete("q")
      }
      const next = params.toString()
      if (next === searchParamsString) return
      router.push(`?${next}`, { scroll: false })
    },
    [router, searchParamsString, onSearchChange],
  )

  // Debounced search
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInputValue(value)
      // Use a small debounce for better UX
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => handleSearch(value), 150)
    },
    [handleSearch],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Local keyboard shortcuts (/ to focus, Escape to clear/blur)
  // Note: Ctrl+K is handled globally by the Cmd+K search palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // / to focus search (not in inputs)
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          return // Allow / in inputs
        }
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }

      // Escape to clear and blur
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        e.preventDefault()
        if (inputValueRef.current) {
          setInputValue("")
          handleSearch("")
        } else {
          inputRef.current?.blur()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleSearch])

  return (
    <div className={cn("relative", className)}>
      <Icons.search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleChange}
        className="pl-9"
      />
    </div>
  )
}
