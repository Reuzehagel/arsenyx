# Wiki content attribution

Files in this directory are mirrored from <https://wiki.warframe.com> via
`?action=raw` from the `Module:` namespace. The source URL is preserved at
the top of each `.lua` file as a comment.

Wiki content is licensed [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
This mirror redistributes it under the same license. Arsenyx's code remains
under its own license; the SA obligation attaches only to derivatives of the
SA-licensed *content*, i.e. the files in this directory and any items-index
output derived from them. The surrounding code is unaffected.

## What's here

| File | Source module | Approx. size |
|---|---|---|
| `Weapons_data_primary.lua` | `Module:Weapons/data/primary` | ~310 KB |
| `Weapons_data_secondary.lua` | `Module:Weapons/data/secondary` | ~210 KB |
| `Weapons_data_melee.lua` | `Module:Weapons/data/melee` | ~430 KB |
| `Weapons_data_archwing.lua` | `Module:Weapons/data/archwing` | — |
| `Weapons_data_companion.lua` | `Module:Weapons/data/companion` | — |
| `Weapons_data_railjack.lua` | `Module:Weapons/data/railjack` | — |
| `Weapons_data_modular.lua` | `Module:Weapons/data/modular` | — |
| `Weapons_data_misc.lua` | `Module:Weapons/data/misc` | — |
| `Warframes_data.lua` | `Module:Warframes/data` (Warframes + Archwings + Necramechs + Operators) | — |
| `Companions_data.lua` | `Module:Companions/data` | ~71 KB |
| `Arcane_data.lua` | `Module:Arcane/data` | ~94 KB |
| `Mods_data.lua` | `Module:Mods/data` | ~933 KB |
| `Stances_data.lua` | `Module:Stances/data` | ~222 KB |
| `Focus_data.lua` | `Module:Focus/data` | ~108 KB |
| `Avionics_data.lua` | `Module:Avionics/data` | ~14 KB |

## Regenerate

```sh
bun run scripts/sync-wiki.ts
```

The wiki's parent `Module:Weapons/data` router is deliberately **not**
mirrored — it uses `mw.loadData`, metatables, and an overridden `pairs` to
lazily proxy to its eight subpages. The router's existence is precisely
what guarantees the subpages stay pure-data: Scribunto's `mw.loadData`
contract forbids the loaded module from carrying functions or metatables,
which is what makes the subpages safe to parse with `luaparse`.

Source: <https://wiki.warframe.com>
License: <https://creativecommons.org/licenses/by-sa/4.0/>
