import type { VariantMode } from "@arsenyx/shared/warframe/build-data"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Confirms a forma & shards mode switch on a build that already has forma or
 *  shards placed. `target` is the mode being switched to; null = closed. */
export function VariantModeDialog({
  target,
  activeLabel,
  onCancel,
  onConfirm,
}: {
  target: VariantMode | null
  activeLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target === "linked"
              ? "Share forma & shards across variants?"
              : "Give each variant its own forma & shards?"}
          </DialogTitle>
          <DialogDescription>
            {target === "linked"
              ? `Every variant will use the forma and Archon Shards of "${activeLabel}". The other variants' forma and shards will be replaced.`
              : "Each variant keeps the forma and Archon Shards it has now. After this, changing them only affects the variant you're editing."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={target === "linked" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {target === "linked" ? "Replace and share" : "Switch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
