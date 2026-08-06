# Hover Extrusion Effects + Page-Flip Transition — Design Spec

**Status:** Approved, implementation pending

**Goal:** Make interactive elements feel physically tactile — buttons look pressed in on hover, images/cards look lifted toward the viewer on hover — and add a themed 3D flip transition between pages, all without introducing a client-side router or touching per-page behavior scripts. Also fix a near-invisible border on the homepage's commissions preview images.

**Architecture:** Everything is CSS-only, entirely in the shared `styles.css` (already linked by every page), with zero HTML/JS changes. The page-flip relies on the native cross-document View Transitions API (`@view-transition { navigation: auto; }`), which every current-generation browser (Chrome/Edge/Opera, Safari 18.2+, Firefox 144+) supports; unsupported browsers silently fall back to a normal navigation with no animation and no errors.

---

## 1. Button "push-in" hover — `.link-btn`, `.commissions-cta`

These currently sit flat (no shadow). Add a resting raised shadow, then on hover/active, move the button into that shadow's footprint and drop the shadow — it reads as sinking into the panel.

```css
.link-btn, .commissions-cta {
    filter: drop-shadow(3px 4px 0 rgba(0, 0, 0, 0.4));
    transition: filter 0.08s linear, transform 0.08s linear, color 0.08s linear;
}
.link-btn:hover, .link-btn:active,
.commissions-cta:hover, .commissions-cta:active {
    transform: translate(3px, 4px);
    filter: drop-shadow(0 0 0 transparent);
}
```

This is additive to the existing color-swap hover rules (background fill → hot pink, text → dark) already on these selectors — both apply together. `filter: drop-shadow(...)` respects each element's `clip-path` notch shape (same technique already used on `.datapad-screen`), so the shadow follows the notched corners correctly.

## 2. Image/card "extrude-out" hover

Applied at the container level (the element that owns the notch `clip-path`) so the whole clipped tile lifts as one unit, rather than zooming the photo inside a fixed frame:

- `.gallery-card` (homepage character carousel)
- `.gallery-index-card` (`/gallery/` index cards)
- `.past-work-card` (commissions page past-work grid)
- `.char-image-wrap` (character page artwork grid)

```css
transform: translateY(-4px) scale(1.04);
filter: drop-shadow(4px 8px 10px rgba(0, 0, 0, 0.5));
```

added into each selector's existing `:hover` rule (three of the four already have one for a background/opacity change; `.char-image-wrap:hover` is new), plus `transition: transform 0.2s ease-out, filter 0.2s ease-out` added to each base rule. This is a noticeably slower/softer transition than the button press (0.08s linear) — a "lift" reads differently from a "click."

`.commissions-preview-grid img` has no wrapper div, so the same transform/filter hover is applied directly to the `img`.

**Implementation-time check:** confirm the horizontal-scroll container around `.gallery-card` doesn't clip the lift/shadow via `overflow` on a non-scroll axis; adjust that container's overflow if needed.

## 3. Commissions preview border

`.commissions-preview-grid img` currently has `border: 1px solid rgba(255, 255, 255, 0.1)` — effectively invisible against the panel. Replace with a themed, clearly visible border that intensifies as part of the hover lift:

```css
.commissions-preview-grid img {
    border: 2px solid rgba(255, 105, 180, 0.55);
}
.commissions-preview-grid img:hover {
    border-color: var(--hot-pink);
}
```

## 4. Page-flip transition

`.datapad-screen` is the shared content wrapper on every public page (`index.html`, `gallery/index.html`, `gallery/<char>/index.html` via `templates/character.html`, `commissions/index.html`). The admin page uses a different design system and is excluded.

```css
@view-transition {
    navigation: auto;
}

.datapad-screen {
    view-transition-name: main-panel;
}

::view-transition-group(main-panel) {
    animation-timing-function: steps(2, jump-none);
}

::view-transition-old(main-panel) {
    animation: panel-flip-out 0.45s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

::view-transition-new(main-panel) {
    animation: panel-flip-in 0.45s cubic-bezier(0.4, 0, 0.2, 1) 0.45s forwards;
}

@keyframes panel-flip-out {
    to { transform: perspective(1800px) rotateY(90deg); }
}

@keyframes panel-flip-in {
    from { transform: perspective(1800px) rotateY(-90deg); }
    to   { transform: perspective(1800px) rotateY(0deg); }
}
```

**How it satisfies the brief:**
- The panel rotates around its own vertical center axis (`rotateY` on each snapshot independently — no shared parent `perspective` needed).
- Content is instantly viewable: both "old" and "new" snapshots are pixel captures of already-rendered pages, not a live fetch — no loading state at any point in the flip.
- The browser's own resize animation of the panel's box (from the old page's captured size to the new page's) normally interpolates smoothly across the full duration; overriding just its `animation-timing-function` to `steps(2, jump-none)` makes it hold the old size through the first half and snap to the new size exactly at the 90°/edge-on midpoint, instead of a gradual resize mid-flip.
- The starfield canvas sits outside the named panel and is left untouched by default (no animation applied to `::view-transition-old(root)`/`::view-transition-new(root)`) so it doesn't double-expose or cross-fade oddly; this will be checked visually and revisited if it looks wrong in practice.
- Zero JS, zero HTML changes: every internal link between these four page types gets the effect automatically once the CSS lands in the shared stylesheet.

**Tuning note:** the exact duration, easing curve, and perspective distance above are a starting point, not final — they'll be adjusted by eye (via headless-browser screenshots at 0%, ~50%, and 100% of the transition) during implementation.

---

## Testing approach

No new JS logic is introduced, so there's nothing to unit-test. Verification is visual:
- Headless-browser screenshots of each affected hover state (buttons pressed, cards lifted, preview border visible) to confirm the transform/shadow/border render as intended and don't get clipped by an ancestor's `overflow`.
- A screenshot sequence through a real navigation between two of the four page types, sampled mid-animation, to confirm the flip and the exactly-at-90° size swap.
- Existing `npm test` suite re-run to confirm the pure-CSS change touches nothing it tests.

## Out of scope

- `.permalink-copy-btn` and the admin page's buttons — neither currently has a raised-shadow aesthetic; adding one wasn't requested.
- Redesigning the commissions-preview images into notched frames — only the border visibility was asked for.
- Any custom JS router / fetch-based page swap — the native View Transitions API covers the requested effect without one.
