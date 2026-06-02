# Arsenyx

Warframe build planner. Users create, share, and discover equipment builds. This
glossary captures the language **specific to Arsenyx** — the app's own concepts,
plus the handful of Warframe terms whose meaning is precise or app-specific here.
Canonical game terms with a single accepted meaning (Mod, Arcane, Polarity, Forma,
Riven…) are intentionally left out — the game and the wiki already define them, and
[CLAUDE.md](./CLAUDE.md) forbids encoding game facts from memory anyway.

It is a glossary, not a spec or a roadmap: every term below corresponds to a concept
the code actually models today.

## Builds

**Build**:
The shareable, addressable unit a user creates — one **Item**, plus a name, **Slug**,
**Visibility**, optional **Guide**, and social counts. A Build is a container: the
actual loadout lives in its **Variants**.
_Avoid_: Loadout, Setup (those refer to a single Variant, not the whole shareable object).

**Variant**:
One concrete loadout within a Build — its mods, arcanes, shards, forma, incarnon, and
helminth choices. A Build has 1–5 Variants; the Variant is the thing the editor edits.
_Avoid_: Build (the container, not the loadout), Loadout. Also note: a Warframe Prime/Wraith/Prisma
"variant" is **not** a Variant here — those are modeled as separate **Items** in the catalog.

**Guide**:
Optional authored prose on a Build: a short summary (≤160 chars) and a longer description
(≤50k chars). Can be build-wide or per-Variant.
_Avoid_: Description (too generic — the Guide is the summary + description pair), Notes.

**Visibility**:
Who can see a Build. Exactly three levels: **PUBLIC** (discoverable in browse),
**UNLISTED** (reachable by direct link, not listed), **PRIVATE** (owner / org members only).
_Avoid_: Privacy, Draft, Published (these conflate the three-state enum with a boolean).

**Slug**:
The immutable, URL-safe id of a Build (a 10-char nanoid excluding lookalike characters).
The public key in `/builds/:slug`.
_Avoid_: ID, Permalink.

## Social actions

**Like**:
A one-click endorsement of a Build by a viewer; the count is denormalized on the Build,
and you cannot Like your own. Modeled as `BuildLike`.
_Avoid_: **Vote**, **Upvote**, Star, Heart.

**Bookmark**:
A viewer saving a Build to their personal list for later. Modeled as `BuildBookmark`.
_Avoid_: **Favorite**, Save, Pin, Collection.

**Fork**:
A copy of an existing Build created under the forking user's own ownership, initialized
PRIVATE and linked back to the original via `forkedFromId`.
_Avoid_: Clone, Copy, Remix, Duplicate.

**Partner Build**:
A symmetric link between two Builds (e.g. complementary multiplayer loadouts) that requires
mutual consent — both owners must confirm it. Modeled as the self-referential `BuildLink`.
_Avoid_: Linked Build, Related Build, Combo.

## People

**User**:
A registered person who owns the Builds they create and is credited for them by username
(the byline). Owns the Build outright — edit and delete rights — regardless of any
Organization it is published under.
_Avoid_: Author, Owner, Account, Member (all collapse into User; "Member" specifically means an Organization membership, below).

**Organization**:
An optional team namespace a Build can be published under; its members hold an ADMIN or
MEMBER role, and the org name appears in or replaces the User's byline on its Builds.
_Avoid_: Team, Group, Studio. "Org" is an acceptable short form.

## Items & loadout (Warframe terms, as Arsenyx models them)

**Item**:
Any single equippable the catalog knows about — a Warframe, weapon, Necramech, Companion,
etc. A Build is always for exactly one Item. Prime/variant editions are distinct Items, not
**Variants**.
_Avoid_: Frame, Weapon, Gear (those name subtypes; "Item" is the umbrella the catalog uses).

**Category**:
The Item's top-level type, one of a fixed set of 10 (warframes, primary, secondary, melee,
necramechs, companions, companion-weapons, exalted-weapons, archwing, railjack). Drives slot
layout and arcane eligibility.
_Avoid_: Type, Class, Kind. (Reserve "class" for an Item's mechanical `displayClass`, e.g. "Sniper Rifle".)

**Slot**:
A position in a Variant that holds one mod. Kinds: **normal**, **aura**, **exilus**, and
**stance** — each with its own placement rules. A slot also carries its polarity (innate or
re-stamped by Forma).
_Avoid_: Cell, Position.

**Capacity** / **Drain**:
**Drain** is the cost a placed mod charges against the Item's mod **Capacity** (the budget,
30 base, 60 with a Reactor/Catalyst). Arsenyx computes both live as you edit.
_Avoid_: Cost, Points, Energy (Energy is an in-game ability resource, unrelated).

## Example dialogue

> **Dev:** A user opened a Build with two Variants — do Likes attach to the Variant they're viewing?
>
> **Domain:** No. Likes, Bookmarks, and the Slug all live on the **Build** — the shareable
> container. **Variants** are just the 1–5 loadouts inside it; switching Variants doesn't change
> what you Liked.
>
> **Dev:** And if they Fork it?
>
> **Domain:** They get their own PRIVATE Build, all Variants copied, linked back via `forkedFromId`.
> Likes and Bookmarks don't carry over — those belong to the original.
>
> **Dev:** Right. And when it's published under their Organization with the username hidden —
> who's the owner?
>
> **Domain:** Still the **User**. The Org only changes the byline; ownership and edit rights never
> leave the User.
