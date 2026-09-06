# Slime Design System — Design Spec

**Status:** Approved, implementation pending

**Context:** This is sub-project 2 of the larger site overhaul that sub-project 1 ([2026-09-04-react-vite-ssg-foundation-design.md](2026-09-04-react-vite-ssg-foundation-design.md)) laid the technical groundwork for. Sub-project 1 explicitly shipped **zero visual change** — same dark "datapad" sci-fi theme, same `styles.css`, just re-rendered through React. This spec is the opposite: it replaces the entire visual language, while touching no routing, no build pipeline, and no CMS/API code.

**Goal:** Replace the current dark, notched-corner "datapad" sci-fi theme with a light, bright, rounded "Slime Rancher"-inspired design system — saturated candy-color blocks on a warm cream base, chunky rounded typography, organic blob shapes used as decoration, and a small set of tactile, satisfying micro-interactions (button "pop," letter-wave text hover). The result should look and feel distinctive and unique, not like a generic modern web template.

**Non-goal:** No navigation redesign (the Persona-style centralized menu + mobile fallback is its own, separate sub-project — see Out of Scope). No physics-based page-transition engine (the "gravity drop" transition concept is also a separate, later sub-project — this spec explicitly does not build toward it). No new automated visual-regression/testing infrastructure. No routing, build-pipeline, or CMS/API changes of any kind.

**Supersedes:** `public/styles.css`'s entire dark theme (colors, the `.datapad-wrapper`/`.datapad-screen` notched-panel structure, `Space Mono`/`Quicksand` typography) is replaced outright, not incrementally patched. `src/components/Background.jsx` (the three.js animated starfield) and the `three` npm dependency are deleted, not reskinned — a starfield has no place in a light, bright theme, and removing it is a net simplification.

---

## 1. Design tokens

All tokens are CSS custom properties, replacing the current `:root` block in `public/styles.css` wholesale.

**Base palette:**
```css
--bg-cream: #FFF6E9;      /* page background — warm, not stark white */
--surface: #FFFFFF;        /* card/panel fill, sits on top of --bg-cream */
--text-ink: #3A2A24;       /* body text — warm dark brown, not pure black */
--text-muted: #8A7368;     /* secondary/muted text */
--outline-w: 3px;          /* shared border thickness for the "sticker" look */
```

**Slime accent colors** — five hues, each with a light tint (for backgrounds/badges) and a dark shade (for hover/pressed states and text-on-accent contrast):

| Name | Base | Light | Dark |
|---|---|---|---|
| Pink | `#FF6FA0` | `#FFD3E4` | `#E14C82` |
| Teal | `#23C9B7` | `#C6F5EF` | `#189E90` |
| Honey | `#FFC93C` | `#FFEDB0` | `#E0A800` |
| Lavender | `#B98CFF` | `#E7D8FF` | `#8F5FE0` |
| Tabby | `#FF9A44` | `#FFE0BE` | `#E07A1F` |

Exposed as `--slime-pink`, `--slime-pink-light`, `--slime-pink-dark`, etc. These exact hex values are a starting proposal — tunable during implementation without changing the system's structure.

**Typography:** two Google Fonts, replacing the current `Space Mono` + `Quicksand` `<link>` in `renderShell()`:
- **Fredoka** — headings (`h1`–`h3`), buttons, nav labels, anything "display."
- **Nunito** — body copy, form fields, list/card text.

**Shape tokens:**
```css
--radius-panel: 32px;   /* cards/panels */
--radius-button: 999px; /* pill buttons */
--shadow-pop: 6px 6px 0 var(--accent-dark); /* hard offset "sticker" shadow, no blur */
```

## 2. Per-page accent theming

Each page sets a single `--accent` / `--accent-light` / `--accent-dark` triad (pointing at one of the five slime colors above) on its root wrapper; every component underneath references `--accent` generically rather than hardcoding a specific hue. This gives each page a distinct identity and doubles as a wayfinding cue:

| Page | Accent |
|---|---|
| Landing | Pink |
| Gallery + character pages | Teal |
| Commissions | Honey |
| TOS | Lavender |
| Queue | Tabby |
| Admin | A single muted/desaturated neutral, applied once site-wide (not per-section) — matches the "light touch" scope below |

## 3. Shape language

**Functional UI** (buttons, inputs, cards, panels) stays rounded-rectangle or pill — never an organic blob — so hit-targets and layout remain predictable and usable. The current `.datapad-wrapper`/`.datapad-screen` notched-panel structure is replaced by a single `Panel`-style card convention: `--radius-panel` corners, `--outline-w` colored outline, `--shadow-pop` hard offset shadow.

**Decoration** is where the "pop" comes from: a small reusable set of **4–6 hand-picked organic blob SVG shapes**, each parameterized by size, color, and rotation (a `Blob` component/shape set, not one-off bespoke SVGs per page). Used two ways:
- As background decoration — behind hero content, section dividers, empty states.
- As a `clip-path` mask for portrait/character/commission images, cropping them into a blob silhouette instead of a plain rounded rectangle.

## 4. Interaction & animation system

Three named effects, kept dependency-light (plain CSS + small React helpers — no new animation library; GSAP/Framer Motion etc. stay reserved for the later transition-engine sub-project):

- **Click "pop"** — a spring-style press-and-release: an immediate squash on `:active` (pure CSS), followed by an overshoot-and-settle bounce on release (needs a briefly-toggled class, since `:active` alone can't animate *after* release). Implemented once as a shared pattern (e.g. a `usePopClick` hook) and reused on every button/interactive card rather than hand-rolled per component.
- **Letter-wave hover** — each character becomes its own `<span>` so CSS can stagger a per-letter bounce via `animation-delay`. Implemented once as a reusable `<WaveText>` component (splits a string into spans with computed stagger delays); the hover animation itself is plain CSS cascading from the parent's `:hover`.
- **Ambient blob drift** — the decorative background blobs (Section 3) slowly translate/rotate on a long (20–40s), transform-only loop, so it stays cheap on mobile.

All three respect `prefers-reduced-motion: reduce`: ambient drift is disabled outright, and pop/wave animations shorten to near-instant.

## 5. Rollout scope

Every page and shared component built in sub-project 1 gets touched, since all of them currently use the `.datapad-wrapper`/`.datapad-screen` convention or the old token set:

**Pages:** Landing, Gallery, GalleryCharacter (+ `GalleryCharacterRoute`), Commissions, Tos, Queue, Admin (light-touch — same layout/components, new tokens/fonts only, no shape/blob overhaul).

**Shared components:** BlueskyFeed, CharacterGalleryStrip, CommissionsPreviewStrip, GalleryIndexGrid, EnlargeableImage, NsfwBlurImage, PastWorkGrid, TosPointList, QueueBoard, CommissionTierList.

**Admin components (light-touch only):** AdminCharacters, AdminCommissionsInfo, AdminPastWork, AdminTos, AdminQueue.

**Deleted:** `src/components/Background.jsx`, the `three` npm dependency, and every `.datapad-*`/notched-corner rule in `public/styles.css`.

**New shared pieces to build once, reuse everywhere:** the tokens file (`public/styles.css`'s `:root`, rewritten), the `Panel` card component, the `Blob` decorative shape set, `<WaveText>`, and the `usePopClick` pattern.

## 6. Deployment / dependency changes

- `package.json`: remove `three`. No new npm dependencies — Fredoka/Nunito are added the same way the current fonts are (a Google Fonts `<link>` in `renderShell()`), and all shape/animation work is plain CSS + existing React.
- `scripts/render-pages.js`'s `renderShell()`: swap the Google Fonts `<link>` (drop Space Mono + Quicksand, add Fredoka + Nunito).
- No CSP changes needed — `three`'s removal has no CSP impact (it was already an npm dependency, not a CDN import map, since sub-project 1's Task 3).

## 7. Testing

This repo has no visual-regression or browser-testing infrastructure, deliberately (its established pattern is SSR-only structural tests via `renderToStaticMarkup`) — this spec doesn't introduce any. Automated tests stay scoped to what they're good at:
- `<WaveText>` splits into the expected number of `<span>`s.
- Each page's accent-theme class/attribute is present in its SSR output.
- New component markup (Panel, Blob) renders with expected structure.
- The existing sub-project-1 test suite (159 tests) must stay green throughout — this is a visual/markup-class change, not a functional one, so any test asserting on an old `.datapad-*` class name needs updating in the same commit that removes it, not left broken.

The actual "does this look and feel right" check is a manual pass in a real browser, same as prior sub-projects. That pass should explicitly check **text contrast on every page** — flipping a dark theme to a light one is a common place for contrast regressions to hide — plus the reduced-motion behavior and mobile performance of the ambient blob drift.

## 8. Rollout / parity checkpoint

This sub-project is done when:
- Every page and shared component uses the new token system, the `Panel` card convention, and the new typography — no `.datapad-*` classes, no `Space Mono`/`Quicksand` references, remain in `public/styles.css` or any component.
- `Background.jsx` and the `three` dependency are fully removed.
- All functional tests pass (159+, updated where they referenced old class names).
- Manual verification: contrast checked on every page, click-pop and letter-wave feel right in a real browser, ambient blob drift is smooth and stops under `prefers-reduced-motion`, admin retains its full functionality with only the light-touch reskin applied.

## Out of scope

- Persona-style centralized navigation menu + mobile fallback — separate sub-project (explicitly deferred during this spec's brainstorm).
- Physics-based gravity-drop page-transition engine (React Three Fiber, GSAP, Matter.js) — separate, later sub-project (explicitly deferred during this spec's brainstorm). This spec's click-pop/wave-hover effects are standalone component-level interactions, not a page-transition mechanism, and don't need to anticipate the transition engine's architecture.
- Any new automated visual-regression or animation-testing tooling.
