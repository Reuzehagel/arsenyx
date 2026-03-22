"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search, Undo2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/lib/warframe/images";
import { getHelminthAbilities } from "@/lib/warframe/helminth";
import type { HelminthAbility } from "@/lib/warframe/types";

interface HelminthAbilityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (ability: HelminthAbility | null) => void;
    currentAbilityName?: string;
}

export function HelminthAbilityDialog({
    open,
    onOpenChange,
    onSelect,
    currentAbilityName,
}: HelminthAbilityDialogProps) {
    const [query, setQuery] = useState("");
    const abilities = useMemo(() => getHelminthAbilities(), []);

    const filteredAbilities = useMemo(() => {
        if (!query.trim()) return abilities;
        const lowerQuery = query.toLowerCase();
        return abilities.filter(
            (a) =>
                a.name.toLowerCase().includes(lowerQuery) ||
                a.source.toLowerCase().includes(lowerQuery)
        );
    }, [abilities, query]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl h-[80vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Subsume Ability</DialogTitle>
                </DialogHeader>

                <InputGroup className="shrink-0">
                    <InputGroupAddon align="inline-start">
                        <Search />
                    </InputGroupAddon>
                    <InputGroupInput
                        placeholder="Search abilities..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </InputGroup>

                <ScrollArea className="flex-1 -mx-6 px-6 min-h-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-4 pt-1">
                        <Button
                            variant="outline"
                            className="h-auto p-3 flex items-center justify-start gap-3 hover:bg-accent/50"
                            onClick={() => {
                                onSelect(null);
                                onOpenChange(false);
                            }}
                        >
                            <div className="size-10 rounded bg-muted flex items-center justify-center border">
                                <Undo2 className="text-muted-foreground" />
                            </div>
                            <div className="flex flex-col items-start text-left">
                                <span className="font-medium">Restore Original Ability</span>
                                <span className="text-xs text-muted-foreground">Remove Helminth infusion</span>
                            </div>
                        </Button>

                        {filteredAbilities.map((ability) => (
                            <Button
                                key={ability.uniqueName}
                                variant={currentAbilityName === ability.name ? "secondary" : "ghost"}
                                className="h-auto p-3 flex items-center justify-start gap-3 hover:bg-accent/50"
                                onClick={() => {
                                    onSelect(ability);
                                    onOpenChange(false);
                                }}
                            >
                                <div className="size-10 rounded bg-muted overflow-hidden relative border shrink-0">
                                    {ability.imageName ? (
                                        <Image
                                            src={getImageUrl(ability.imageName)}
                                            alt={ability.name}
                                            fill
                                            unoptimized
                                            sizes="48px"
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                            ?
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-start text-left overflow-hidden">
                                    <span className="font-medium truncate w-full">{ability.name}</span>
                                    <span className="text-xs text-muted-foreground truncate w-full">
                                        {ability.source}
                                    </span>
                                </div>
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
