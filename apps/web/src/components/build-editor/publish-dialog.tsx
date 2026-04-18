import { Check, Globe, Link2, Lock, Users, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import type { BuildDetail } from "@/lib/build-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PublishVisibility = BuildDetail["visibility"];

export type PublishDialogValues = {
  visibility: PublishVisibility;
};

type PublishDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVisibility: PublishVisibility;
  owner: {
    name: string;
    username: string | null;
    image: string | null;
  };
  confirmLabel?: string;
  onConfirm: (values: PublishDialogValues) => void;
};

const VISIBILITY_OPTIONS: {
  value: PublishVisibility;
  label: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    value: "PUBLIC",
    label: "Public",
    description: "Anyone can find and view this build in listings and search.",
    Icon: Globe,
  },
  {
    value: "UNLISTED",
    label: "Unlisted",
    description: "Only people with the link can view. Hidden from listings.",
    Icon: Link2,
  },
  {
    value: "PRIVATE",
    label: "Private",
    description: "Only you (and org members) can view this build.",
    Icon: Lock,
  },
];

export function PublishDialog({
  open,
  onOpenChange,
  initialVisibility,
  owner,
  confirmLabel = "Save build",
  onConfirm,
}: PublishDialogProps) {
  const [visibility, setVisibility] = useState<PublishVisibility>(initialVisibility);

  const handleOpenChange = (o: boolean) => {
    if (o) setVisibility(initialVisibility);
    onOpenChange(o);
  };

  const ownerHandle = owner.username ? `@${owner.username}` : owner.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save build</DialogTitle>
          <DialogDescription>
            Choose who can see this build and where to publish it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Section label="Visibility">
            {VISIBILITY_OPTIONS.map(({ value, label, description, Icon }) => (
              <OptionCard
                key={value}
                selected={visibility === value}
                onSelect={() => setVisibility(value)}
                leading={<Icon className="mt-0.5 size-4 shrink-0" />}
                title={label}
                subtitle={description}
              />
            ))}
          </Section>

          <Section label="Publish as">
            <OptionCard
              selected
              leading={<OwnerAvatar owner={owner} />}
              title={owner.name}
              subtitle={`${ownerHandle} · Yourself`}
            />
            <OptionCard
              disabled
              leading={
                <div className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full">
                  <Users className="size-3.5" />
                </div>
              }
              title="Organizations"
              subtitle="Coming soon"
            />
          </Section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm({ visibility })}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function OptionCard({
  selected = false,
  disabled = false,
  onSelect,
  leading,
  title,
  subtitle,
}: {
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  leading: ReactNode;
  title: string;
  subtitle: string;
}) {
  const className = cn(
    "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
    disabled
      ? "border-dashed opacity-60"
      : "hover:bg-muted/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
    selected && !disabled ? "border-primary bg-primary/5" : "border-border",
  );

  const content = (
    <>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium leading-none">{title}</span>
        <span className="text-muted-foreground text-xs leading-snug">
          {subtitle}
        </span>
      </div>
      {selected && !disabled && (
        <Check className="text-primary size-4 shrink-0" />
      )}
    </>
  );

  if (disabled || !onSelect) {
    return (
      <div className={className} aria-disabled={disabled || undefined}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={className}
    >
      {content}
    </button>
  );
}

function OwnerAvatar({ owner }: { owner: { name: string; image: string | null } }) {
  return (
    <div className="bg-muted flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
      {owner.image ? (
        <img src={owner.image} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-xs font-medium">
          {owner.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
