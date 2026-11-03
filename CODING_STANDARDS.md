# Coding standards

Applied at review. Mechanical rules live in oxlint / `just check`, not here.

## Game rules come from the catalog

A Warframe rule (which mods conflict, fit a slot, stack, trade; ability or item behaviour) is read from `apps/web/public/data/` ([index](docs/commands.md#what-the-built-catalog-holds)) or cites a wiki page. Flag a hand-written list or regex of mod/item names that encodes such a rule: it drifts with every game update. Example: `mod-conflicts.json`, never a `/^(Primed|Umbral…)/` name filter.
