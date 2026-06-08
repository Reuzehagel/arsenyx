import {
  Building2,
  Lock,
  Paintbrush,
  Settings as SettingsIcon,
  User,
} from "lucide-react"
import * as React from "react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"

import { AdvancedPanel } from "./advanced-tab"
import { AppearancePanel } from "./appearance-tab"
import { OrganizationsPanel } from "./organizations-tab"
import { PrivacyPanel } from "./privacy-tab"
import { ProfilePanel } from "./profile-tab"

type SectionId =
  | "appearance"
  | "profile"
  | "organizations"
  | "privacy"
  | "advanced"

type Section = {
  id: SectionId
  name: string
  icon: React.ComponentType<{ className?: string }>
}

const SECTIONS: Section[] = [
  { id: "appearance", name: "Appearance", icon: Paintbrush },
  { id: "profile", name: "Profile", icon: User },
  { id: "organizations", name: "Organizations", icon: Building2 },
  { id: "privacy", name: "Privacy", icon: Lock },
  { id: "advanced", name: "Advanced", icon: SettingsIcon },
]

const SECTION_SELECT_ITEMS = SECTIONS.map((s) => ({
  value: s.id,
  label: s.name,
}))

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [active, setActive] = React.useState<SectionId>("appearance")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 md:max-h-[500px] md:max-w-[700px] lg:max-w-[800px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Customize your Arsenyx experience.
        </DialogDescription>
        <SidebarProvider className="items-start">
          <Sidebar
            collapsible="none"
            className="bg-muted/40 hidden border-r md:flex"
          >
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SECTIONS.map((item) => {
                      const Icon = item.icon
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            isActive={item.id === active}
                            onClick={() => setActive(item.id)}
                          >
                            <Icon />
                            <span>{item.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:h-[480px]">
            <header className="flex h-14 shrink-0 items-center gap-2 md:h-16">
              {/* `pr-12` on mobile leaves room for the dialog's X close
                  button which sits absolute top-right. */}
              <div className="flex w-full items-center gap-2 pr-12 pl-4 md:w-auto md:pr-4">
                <Breadcrumb className="hidden md:block">
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {SECTIONS.find((s) => s.id === active)?.name}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
                <Select
                  items={SECTION_SELECT_ITEMS}
                  value={active}
                  onValueChange={(v) => {
                    if (v) setActive(v as SectionId)
                  }}
                >
                  <SelectTrigger className="w-full md:hidden">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SECTIONS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
              <SectionPanel id={active} onClose={() => onOpenChange(false)} />
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

function SectionPanel({ id, onClose }: { id: SectionId; onClose: () => void }) {
  switch (id) {
    case "appearance":
      return <AppearancePanel />
    case "profile":
      return <ProfilePanel />
    case "organizations":
      return <OrganizationsPanel onClose={onClose} />
    case "privacy":
      return <PrivacyPanel />
    case "advanced":
      return <AdvancedPanel />
  }
}
