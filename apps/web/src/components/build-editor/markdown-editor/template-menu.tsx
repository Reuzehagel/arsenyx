import { type EditorView } from "@codemirror/view"
import { ChevronDown, LayoutTemplate, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import {
  BUILTIN_TEMPLATES,
  deleteUserTemplate,
  loadUserTemplates,
  saveUserTemplate,
  type GuideTemplate,
} from "./guide-templates"
import { insertTemplate } from "./markdown-commands"

/**
 * Template picker for the toolbar: built-in scaffolds plus the user's own
 * saved templates (localStorage). Selecting one drops it into the editor;
 * "Save current as template" captures the live document.
 */
export function TemplateMenu({
  getView,
  getValue,
}: {
  getView: () => EditorView | null
  getValue: () => string
}) {
  const [userTemplates, setUserTemplates] = useState<GuideTemplate[]>(() =>
    loadUserTemplates(),
  )
  // Control the menu's open state so opening it forces a re-render — `canSave`
  // reads the live document via `getValue()`, and the memoized toolbar doesn't
  // re-render on plain typing (no format change), so without this the disabled
  // state would be stale (e.g. still disabled after typing a plain paragraph).
  const [menuOpen, setMenuOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState("")

  const apply = (tpl: GuideTemplate) => {
    const view = getView()
    if (!view) return
    insertTemplate(view, tpl.body)
  }

  const remove = (id: string) => {
    setUserTemplates(deleteUserTemplate(id))
  }

  const commitSave = () => {
    setUserTemplates(saveUserTemplate(name, getValue()))
    setName("")
    setSaveOpen(false)
  }

  const canSave = getValue().trim().length > 0

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="ghost" size="sm">
              <LayoutTemplate />
              Templates
              <ChevronDown className="opacity-50" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Starters</DropdownMenuLabel>
            {BUILTIN_TEMPLATES.map((tpl) => (
              <DropdownMenuItem key={tpl.id} onClick={() => apply(tpl)}>
                {tpl.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          {userTemplates.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Your templates</DropdownMenuLabel>
                {userTemplates.map((tpl) => (
                  <DropdownMenuItem
                    key={tpl.id}
                    onClick={() => apply(tpl)}
                    className="pr-1"
                  >
                    <span className="min-w-0 flex-1 truncate">{tpl.name}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${tpl.name}`}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded-md"
                      onClick={(e) => {
                        // Keep the menu open and don't trigger the insert.
                        e.preventDefault()
                        e.stopPropagation()
                        remove(tpl.id)
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canSave}
            onClick={() => {
              if (canSave) setSaveOpen(true)
            }}
          >
            <Plus />
            Save current as template…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Reuse this guide's structure on future builds. Saved in this
              browser only.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="template-name">Template name</FieldLabel>
            <Input
              id="template-name"
              autoFocus
              value={name}
              placeholder="e.g. Steel Path frame"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  commitSave()
                }
              }}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={commitSave}>Save template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
