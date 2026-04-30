# Product

## Register

brand

## Users

Experienced Warframe players who already know what a build is and what they want from one. They're switching tabs from in-game arsenal screens, Discord, and existing planners (Overframe, semlar) to plan, compare, and share loadouts. They are tab-rich, attention-poor, and allergic to onboarding.

Newcomers are welcome but not the audience the surface is tuned for. The site should feel like a power tool that newcomers can grow into, not a welcome mat that experts have to step over.

## Product Purpose

Arsenyx is a fast, keyboard-first, open-source build planner for Warframe. The site exists so a player can go from "I want to plan a build" to "I have a shareable URL" in under a minute, without ads, without logins for read-only use, and without the visual noise of competing tools.

Success on the landing surface: a returning player presses one key (search) and is in. A new visitor who has never seen Arsenyx understands within five seconds that this is a real, working planner — not a marketing page — and can see live game data they recognise.

## Brand Personality

Three words: **precise, restrained, lived-in**.

Voice is short, declarative, never excited. No exclamation points. No second-person hype. Numbers and game terms do the talking. The tool's confidence comes from showing the work, not from describing it.

## Anti-references

- **Overframe** — busy density, dim navy, gamer-card grids stacked endlessly, "SIGN IN" as the loudest element. Visual debt of a decade-old gaming forum.
- **Generic SaaS landing pages** — gradient hero, "trusted by" logo strip, three-or-four-up feature card grid, "Join thousands of …" social-proof copy, "Ready to X?" closing CTA. Arsenyx must read nothing like a Y Combinator template.
- **Neon / cyberpunk gamer aesthetic** — RGB accents, glow-on-hover, angled clip-paths, "futuristic" sci-fi typography. The game is already that; the tool should not be.
- **Glassmorphism and gradient text** — banned outright per shared design laws. No frosted cards, no `bg-clip-text` rainbow headlines.
- **Hero-metric template** — "10,000+ builds · 50+ frames · ⭐ 1.2k stars" three-up bar. Cliché.
- **Welcome-mat copy** — "Build. Share. Dominate.", "Plan your perfect loadout", "Join thousands of Tenno". Replace with surfaces that *show* the planner, not slogans about it.

## Design Principles

1. **Show the tool, don't describe it.** The landing page is the product on display. Real items, real builds, real data, scrollable. If a section can be replaced with a screenshot of the planner working, it should be.
2. **Monochrome by conviction.** Tinted neutrals only. Color enters the page exclusively through game data — damage type chips, polarity glyphs, mod rarity borders — never decoratively. The palette belongs to Warframe; the chrome belongs to Arsenyx.
3. **Density without noise.** A power user expects to see a lot at once and read it fast. Tight rows, hairline rules, mono labels, scannable tables. Negative space is structural, not decorative.
4. **Keyboard is the identity.** The press-`/`-to-search behaviour is not a feature in a card; it is the way the page is operated. Make the surface respond visibly to it.
5. **Earn every word.** No paragraph the user can't paraphrase in five words. No restated headings. No closing CTAs that repeat the opening one.

## Accessibility & Inclusion

- Target WCAG 2.2 AA on color contrast and keyboard navigation. Every interactive element reachable and visibly focused.
- Per project decision: skip screen-reader-specific accommodations and `prefers-reduced-motion` gates for now (see `feedback_accessibility_scope.md`).
- All text content is English-only. Game terms (Tenno, Warframe, Arsenal, mod, arcane) are used without explanation — the audience knows them.
