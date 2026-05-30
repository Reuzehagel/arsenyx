# release-history.json — curated snapshot

Maps `name → { releaseDate?, vaulted? }` for the catalog. Two facts we
can't get from DE PublicExport or wiki Lua directly:

- **releaseDate** — the wiki ships `Introduced = "32.0.5"` (a Warframe
  update version), not a calendar date. Resolving update → date is
  wiki-only data scattered across per-update pages. We could scrape
  those, but the resulting map is small and changes monotonically —
  easier to snapshot. Bootstrapped from the legacy `items-index.json`
  at the branch base.
- **vaulted** — Prime gear rotates in/out of relic drop tables. DE's
  PublicExport doesn't expose vault state and the wiki Lua modules don't
  carry it either. Two sources contribute:
  - https://wiki.warframe.com/w/Prime_Vault#Vaulted_Items — the canonical
    current rotation (114 items as of last refresh).
  - 19 additional "permanently unavailable" Primes that the Vault page
    omits but were historically tracked: Founders-exclusives (Excalibur
    Prime, Lato Prime, Skana Prime) and legacy deep-vault items (Nyx
    Prime, Valkyr Prime, Cernos Prime, …). These need manual review when
    DE unvaults them.

Total `vaulted: true` entries: ~133.

## Keyed by name, not uniqueName

Display name ("Braton Prime") is the contributor-friendly key. The build
resolves names to DE uniqueNames at emit time. This makes the file
robust to DE uniqueName drift (rename of `/Lotus/Powersuits/.../Foo` →
`/Lotus/Powersuits/.../FooBar` no longer silently drops a row) and
matches how the wiki Vault page is structured.

## Refresh path

- New item added in a DE update: append `"Foo Prime": {"releaseDate":
  "YYYY-MM-DD"}` (date from the patch notes).
- Prime vaults or unvaults: flip `vaulted: true` / drop the field.
  Re-run the wiki extraction via the snapshot script if you're doing a
  bulk refresh.

Names that don't match any v2 item are reported during build but not
fatal — they're just dead entries (e.g. a Prime that got renamed in
DE).
