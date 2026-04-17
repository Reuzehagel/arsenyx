import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"

import { ViewPreferenceProvider } from "@/components/build/view-preference"
import { ThemeProvider } from "@/components/theme-provider"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Arsenyx - Warframe Build Planner",
  description:
    "Open-source Warframe build planner. Fast, keyboard-first, and community-driven.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ colorScheme: "light dark" }}
    >
      <head>
        <meta name="theme-color" content="#09090b" />
        <link rel="preconnect" href="https://cdn.warframestat.us" />
        <link rel="preconnect" href="https://wiki.warframe.com" />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ViewPreferenceProvider>
            {children}
          </ViewPreferenceProvider>
          <Toaster
            richColors
            position="bottom-right"
            toastOptions={{
              className: "sm:max-w-md",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
