import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark" | "system"

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = "arsenyx-theme"

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function readStoredTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark" || stored === "system")
    return stored
  return "system"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(
    getSystemTheme,
  )

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setSystemTheme(mql.matches ? "dark" : "light")
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme = theme === "system" ? systemTheme : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", resolvedTheme === "dark")
  }, [resolvedTheme])

  const setTheme = (next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
