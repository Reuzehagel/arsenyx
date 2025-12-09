"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Optional callback for client-side filtering (bypasses URL updates) */
  onSearchChange?: (value: string) => void;
}

export function SearchBar({
  defaultValue = "",
  placeholder = "Search items...",
  className,
  onSearchChange,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const searchParamsString = searchParams.toString();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      // If client-side callback provided, use that instead of URL updates
      if (onSearchChange) {
        onSearchChange(value);
        return;
      }
      const params = new URLSearchParams(searchParamsString);
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      const next = params.toString();
      if (next === searchParamsString) return;
      router.push(`?${next}`, { scroll: false });
    },
    [router, searchParamsString, onSearchChange]
  );

  // Debounced search
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Use a small debounce for better UX
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => handleSearch(value), 150);
    },
    [handleSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K or /
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey)
      ) {
        // Don't trigger if already focused on an input
        if (
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          if (e.key === "/") return; // Allow / in inputs
          if (e.key === "k") {
            e.preventDefault();
            inputRef.current?.select();
            return;
          }
        }
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }

      // Escape to clear and blur
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        e.preventDefault();
        if (inputRef.current?.value) {
          inputRef.current.value = "";
          handleSearch("");
        } else {
          inputRef.current?.blur();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSearch]);

  return (
    <div className={cn("relative", className)}>
      <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        defaultValue={defaultValue}
        onChange={handleChange}
        className="pl-9 pr-20"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1">
        <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 inline-flex">
          <Icons.command className="h-3 w-3" />K
        </kbd>
      </div>
    </div>
  );
}
