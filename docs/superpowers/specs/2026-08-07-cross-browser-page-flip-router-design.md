# Cross-Browser Page-Flip Router — Design Spec

**Status:** Approved, implementation pending

**Goal:** The 3D page-flip transition shipped in [2026-08-06-hover-effects-page-flip-design.md](2026-08-06-hover-effects-page-flip-design.md) relies on the native cross-document View Transitions API (`@view-transition { navigation: auto; }`). As of August 2026 that's only implemented in Chrome/Edge/Opera and Safari 18.2+ — Firefox (the site owner's primary browser) has no cross-document support yet, so navigating between pages there just does a plain, unanimated jump. This spec replaces the native-only mechanism with a small client-side router that drives the *same-document* View Transitions API (which Firefox 153 already supports) for every browser, so the flip is consistent everywhere instead of Chrome-only.

**Non-goal:** No visual change. The flip must look identical to the existing Chromium behavior — same keyframes, same timing, same panel-edge-on flip. This is purely a delivery-mechanism change: JS drives the same CSS that already exists, instead of the browser's native cross-document navigation doing it for free.

**Also fixes in passing:** a real Firefox rendering bug found while testing the previous spec's hover effects — `.link-btn`, `.gallery-card`, and `.gallery-index-card` each combine an ancestor `filter: drop-shadow()` (added for the "extrude" hover effect) with a `::before` pseudo-element using `backdrop-filter: blur()` (the existing notched-border-contrast technique). That combination is known to corrupt `backdrop-filter` sampling, especially mid-animation. Fix: those three selectors' `filter: drop-shadow()` becomes `box-shadow()` instead — visually near-identical at these small offsets, and it doesn't touch the backdrop-filter compositing path. `.commissions-cta`, `.past-work-card`, and `.char-image-wrap` don't have a backdrop-filter descendant and are unaffected. This part is already implemented and verified (Firefox video capture, no shimmer) as of this spec being written.

---

## 1. Scope: which pages, which links

The router only concerns itself with the 4 page types that already share `.datapad-screen` / participate in the flip:

| Path pattern | Page | Script module |
|---|---|---|
| `/` | Home | `/script.js` |
| `/gallery/` | Gallery index | `/gallery/gallery-index.js` |
| `/gallery/<slug>/` | Character page (static, pre-generated) | `/gallery/character.js` |
| `/commissions/` | Commissions | `/commissions/commissions.js` |

Everything else — `/admin/` (separate design system, explicitly excluded from the original spec too), `/i/<id>` permalink pages (serverless-function-rendered, and every link to them already carries `target="_blank"` via `shared/enlargeable.js`, so they're naturally never intercepted), external links, mailto:, and any unrecognized path — is left completely alone for the browser to handle as a normal navigation.

Clicks are only intercepted when: plain left-click (no ctrl/cmd/shift/alt), no `target` attribute, no `download` attribute, same-origin, and the resolved pathname matches one of the 4 patterns above. Clicking a link to the current page (e.g., a nav link back to the page you're already on) is prevented but does nothing (no redundant fetch/flip).

## 2. Bootstrap consolidation

Today each page loads two script tags: `background.js` (starfield, self-contained side-effect module) and its own page script (`script.js`, `gallery-index.js`, `commissions.js`, or `character.js`), and that page script runs its logic immediately at module-load time.

This becomes:
- A single new file, `router.js`, replaces both tags on every page: `<script type="module" src="/router.js"></script>`.
- `router.js` does `import './background.js';` at its own top level — since `router.js` is only ever loaded once per real page load (client-side swaps never touch `<head>`/script tags), the starfield still only initializes once, exactly as today.
- `script.js`, `gallery-index.js`, `commissions.js`, `character.js` are refactored to `export function init() { ... }` containing exactly what currently runs at module scope, with the automatic top-level call removed. They no longer do anything just by being imported.
- On its own load, `router.js` determines the current page type from `location.pathname` against the same 4-pattern table, dynamically imports the matching module, and calls `.init()`. This covers the real/first load — there is no behavior change on first paint.

`#webgl-canvas` and the Three.js renderer live outside `.datapad-screen` in every template and are never touched by a swap, so they're unaffected by any of this.

## 3. Navigation flow

```
document click (delegated listener)
  -> filter: plain click, no target/download, same-origin, matches route table
  -> preventDefault
  -> navigate(url, route, push: true)

popstate (back/forward)
  -> navigate(new URL(location.href), matchRoute(location.pathname), push: false)
```

`navigate(url, route, { push })`:
1. `fetch(url.pathname)`. On network error or non-2xx response, hard-fallback: `location.href = url.href` (real navigation, exactly what would've happened without the router) and stop.
2. Parse the response with `DOMParser`. Extract the new `.datapad-wrapper` (for its class list — pages toggle a `datapad-wrapper--wide` modifier) and `.datapad-screen` (for its content) and `<title>`. If either selector comes back empty, same hard-fallback as above — never show a broken swap.
3. A monotonically increasing navigation token is captured before the fetch and checked after it resolves; if a newer `navigate()` call has started in the meantime (double-click, rapid back/forward), this stale response is discarded and does nothing further. This prevents an in-flight slow response from clobbering a page the user already navigated past.
4. `if (push) history.pushState({}, '', url.pathname)`.
5. Build an `applySwap` closure: set `wrapper.className` to the fetched wrapper's className, set `panel.innerHTML` to the fetched panel's innerHTML, set `document.title`, `window.scrollTo(0, 0)`, then dynamically `import()` the route's module and call `.init()`.
6. If `document.startViewTransition` exists, run `applySwap` inside it (`await document.startViewTransition(applySwap).finished`) — this reuses the exact same `::view-transition-old(main-panel)` / `::view-transition-new(main-panel)` CSS already in place, unchanged. If it doesn't exist (very old browsers), just `await applySwap()` directly — no animation, but a fully working swap.

`prefers-reduced-motion` needs no new handling: the existing media query already neutralizes the `::view-transition-*` animations, and since the same pseudo-elements are reused here, that rule keeps applying regardless of whether the transition was triggered by real navigation or `startViewTransition()`.

## 4. HTML template changes

`index.html`, `gallery/index.html`, `commissions/index.html`, `templates/character.html` each lose their `background.js` + page-script tags in favor of the single `/router.js` tag. Because character pages are statically pre-generated from `templates/character.html` via `scripts/generate-characters.js`, every already-published character page gets regenerated (`npm run build`) so they pick up the same change — the existing, already-established workflow for template edits on this site.

CSP note: all 4 templates' `script-src` already includes `'self'`; `router.js` and every module it dynamically imports are same-origin, so no CSP change is needed. `admin/index.html` is untouched — it keeps its own stricter CSP and its own `admin.js`, and is not part of this routing scheme at all.

## 5. Testing approach

- `matchRoute()` (the path-pattern-to-module lookup) is pure, dependency-free logic — gets real `node --test` unit tests alongside the existing suite (route matches for all 4 patterns, rejects `/admin/`, `/i/123`, external-looking paths, trailing-slash variants where relevant).
- The fetch/swap/transition behavior itself isn't practically unit-testable in this Node-based suite (it's DOM + network + browser-animation behavior). Verified the same way the CSS-only version was verified: Playwright screenshots and video captures in both Chromium and Firefox, checking:
  - Client-side navigation actually flips and swaps content correctly in both engines.
  - Back/forward restores the correct page and content.
  - Each page's dynamic content (character carousel, Bluesky feed, commissions preview, gallery index cards) re-populates correctly after a *client-side* swap, not just on the very first real load — this is the specific failure mode the cached-dynamic-import restructuring exists to prevent.
  - `prefers-reduced-motion` still results in an instant (correct, just unanimated) swap.
  - A simulated fetch failure falls back to a real navigation rather than a broken/blank panel.
- `npm test` (existing suite) re-run to confirm nothing server/build-side regressed.

## Out of scope

- No in-memory page cache for back/forward (always re-fetches). Acceptable for a small personal site; can be added later if back/forward ever feels slow.
- No visual loading indicator during the fetch — pages are small and same-origin, expected latency is low enough that a spinner would likely just flash.
- `/admin/` and `/i/<id>` remain fully outside this system, as they already were in the original page-flip spec.
