import { redirect } from "next/navigation"

// Settings are now handled via a Sheet in the user menu.
// Redirect any direct visits to the home page.
export default function SettingsPage() {
  redirect("/")
}
