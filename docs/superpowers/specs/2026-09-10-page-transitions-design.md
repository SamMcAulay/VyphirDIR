# Gravity-Drop Page Transitions — Design Spec

**Status:** Approved, implementation pending

**Context:** Sub-project 4 of the site overhaul. Sub-project 1 ([2026-09-04-react-vite-ssg-foundation-design.md](2026-09-04-react-vite-ssg-foundation-design.md)) moved the site onto React/Vite SSG; sub-project 2 ([2026-09-06-slime-design-system-design.md](2026-09-06-slime-design-system-design.md)) replaced the visual language; sub-project 3 ([2026-09-07-landing-hub-design.md](2026-09-07-landing-hub-design.md)) rebuilt `/` as a radial navigation hub. Every one of those specs deferred a "physics-based gravity-drop page-transition engine" to this one, and each assumed a React Three Fiber + GSAP + Matter.js stack.

**That stack assumption is superseded by this spec.** There is no 3D scene and no rigid-body simulation here. Pieces fall away and tumble off the bottom of the screen under constant acceleration; they never collide, never bounce and never come to rest. That is closed-form integration in a single animation loop, so no new npm dependency is required and none is added.

**Goal:** Navigating between pages breaks the outgoing page into its visible parts, which let go and tumble off the bottom of the screen, revealing the incoming page underneath.

**Non-goal:** No rigid-body physics, collision detection or resting states. No 3D. No new npm dependencies. No changes to the CMS/API, `functions/`, Admin, or the build pipeline. No redesign of any page's layout (that is sub-project 5).

---

## 1. The problem this has to solve first

There is currently **no client-side navigation on this site.** Every internal link is a plain `<a href>`; there is no `Link` component and no `useNavigate` call anywhere in `src/`. React Router is used only to match the current URL so the right page component renders — `StaticRouter` during the build, `BrowserRouter` after hydration. Every click is a full document load handled by the browser.

Sub-project 1's spec states that React Router "owns in-app navigation after first load, so route changes become client-side transitions — this is the seam the physics transition engine will hook into." That seam was described but never wired up, and the anchors go around it.

This blocks the entire feature. Pieces can only fall if the outgoing and incoming pages briefly share one document, and today the browser destroys the outgoing document before anything can be measured. So this spec builds the seam as well as the effect.

**Rejected alternatives.** Animating first and then setting `location.href` makes the visitor wait for the animation before the request even starts, and leaves a blank frame where the old document dies. Cross-document View Transitions hand you a whole-page snapshot rather than individual elements, so nothing can tumble independently; it is also the exact API whose missing Firefox support forced the rewrite in [2026-08-07-cross-browser-page-flip-router-design.md](2026-08-07-cross-browser-page-flip-router-design.md).

## 2. CSP constraint (resolved)

The site ships `style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com` with no `'unsafe-inline'`, defined in three places (`scripts/render-pages.js`, `src/routes.js`, `functions/i/[id].js`). This has silently broken work twice on this project, so it was probed against the exact live policy before this spec was written. Measured in headless Chromium:

| Method | Result |
|---|---|
| `el.style.transform = …` | applies |
| `el.style.cssText = …` | applies |
| `el.style.setProperty('--x', …)` | applies |
| `el.animate(…)` (Web Animations) | applies |
| Constructable stylesheet `insertRule` | applies |
| `el.setAttribute('style', …)` | **blocked** |

Only the attribute path is blocked, and that is the trap that killed the hub geometry and the wave-text stagger. The engine writes transforms through the CSSOM property setter exclusively. **`setAttribute('style', …)` must not appear anywhere in this feature**, and clones must have any inherited `style` attribute stripped rather than copied.

Residual gap: verified in Chromium only, because Firefox headless does not run on this machine. Firefox is the site owner's primary browser and the manual pass in §9 must cover it.

## 3. The navigation seam

A single capture-phase `click` listener on `document`, installed once by a `PageTransitions` component mounted inside the router.

Interception requires **all** of the following. Any failure falls through to the browser untouched:

- the event is not already `defaultPrevented`
- `event.button === 0` (left click only, so middle-click still opens a tab)
- none of `metaKey`, `ctrlKey`, `shiftKey`, `altKey` is held
- the event target has an ancestor `<a>` carrying an `href`
- that anchor has no `download` attribute
- its `target` is empty or `_self`
- its `rel` does not contain `external`
- the resolved URL's origin equals `location.origin`
- the resolved URL is not a same-page fragment (same pathname with a hash)
- the resolved pathname, normalised, is transition-eligible

**Normalisation:** exactly one trailing slash, so `/queue` and `/queue/` both resolve to `/queue/`. This is required, not cosmetic: `LinkButton` is used with `href="/queue"` and `href="/tos"` while the route table declares `/queue/` and `/tos/`.

**Eligibility** is derived from the existing `routes` array in `src/routes.js` at runtime, plus the dynamic pattern `/gallery/<slug>/` where `<slug>` is one non-empty segment. There is no second copy of the path list. Routes opt out with a new `noTransition: true` flag, which is set on `/admin/`. `/i/<id>` is served by a Cloudflare function, is not a React route, and is therefore ineligible by construction. Unknown paths are ineligible and fall through, so a real 404 still comes from the host.

**On interception:** `preventDefault()`, run the transition (§4), then hand the pathname to the router via `useNavigate`.

**Two things the browser was doing for free** and the seam must now do itself, both silent when wrong:

- **Title.** Static routes take `title` from the route table. Character pages take `${character.name} | Vyphir`, which is only known once the character data resolves, so that route sets its own title in an effect rather than at navigation time.
- **Scroll.** Reset to the top on every intercepted navigation.

**Known limitation:** browser back and forward buttons navigate without the effect. The listener catches clicks, and `popstate` ordering against React Router's own listener is not guaranteed, so trying to animate it would be racy. Recorded here rather than discovered later.

## 4. What falls

**What the background actually is.** The page background is painted by `body` (`background: var(--bg-cream)`). The `.page-teal` / `.page-honey` / `.page-lavender` / `.page-tabby` / `.page-pink` wrappers paint nothing at all — they only scope CSS custom properties for accent colours and shadows. `.hub` likewise paints nothing; it is a positioning context.

So the walk starts at the page root element inside `#root` and `body` is never part of it. That satisfies "everything bar the background falls" exactly: the cream stays, everything within it goes.

**The rule.** An element *paints* if it has a background colour with non-zero alpha, a background image, a border of non-zero width, a box-shadow or an outline. `<img>`, `<svg>`, `<canvas>` and `<video>` always count as painting. Then, for each element from the page root down:

- **No element children** → it is a piece. Stop.
- **Paints, and has element children** → it is a piece *and* the walk continues into its children. The clone for this piece has its element children removed, so it falls as an empty shell. Direct text nodes stay with the shell.
- **Paints nothing, has element children** → not a piece. Descend.

The middle case is the one that matters. A panel has a background, a border and a shadow, so under a stop-on-paint rule the entire page would fall as one panel-shaped slab, which is the outcome this design explicitly rejects. Instead the panel's chrome falls as its own empty rectangle while the cards, headings and buttons inside it fall separately, so the page genuinely comes apart rather than sliding away.

Consequences worth stating: a gallery card with its own background contributes its shell, its image and its title as three pieces. A bare wrapper that exists only to group three things contributes nothing and lets its three children fall separately. The three decorative slabs on the landing page paint, so they fall too, and the hub disintegrates down to the cream. A page redesigned with more visual structure automatically breaks into more pieces with no change to the engine — which is why this rule was chosen over one keyed to the current panel layout.

**Exclusions.** Elements with zero area are dropped. Elements entirely outside the viewport are dropped, since they would fall unseen.

**Ceiling.** 150 pieces. The walk takes a maximum depth. If a full-depth walk exceeds the ceiling, discard the result and re-walk with the maximum depth reduced by one, repeating until the count is under the ceiling or the depth reaches one, at which point the page's top-level children fall as-is. Animating several hundred cloned nodes drops frames on a phone, and a stuttering transition looks worse than none.

Because a painting element yields both a shell and its descendants, piece counts grow faster than a stop-on-paint rule would produce. The gallery is the page most likely to hit the ceiling, and it is the one to measure against during implementation.

**Asynchronous content.** Gallery, Queue, Terms and Commissions all fetch their content after mount. Navigating before that fetch lands leaves little to break apart, so those pages will sometimes shed only a heading and a back link. This is expected behaviour, not a defect.

## 5. How a transition runs

1. Measure every piece with `getBoundingClientRect()`.
2. Clone each piece into a single fixed-position overlay appended to `document.body`, outside `#root` so React never reconciles it. Leaf pieces are deep-cloned; pieces that paint and have element children are cloned as shells with their element children removed, per §4. Each clone is placed at its measured rect. Clone preparation strips `id` attributes (so the document never holds duplicates), strips any `style` attribute, and removes `name` attributes.
3. Hand the pathname to the router. React paints the incoming page underneath immediately, so the outgoing page reads as crumbling away to reveal it.
4. One `requestAnimationFrame` loop integrates every clone: `v += g·dt`, `y += v·dt`, `x += vx·dt`, `rotation += ω·dt`, writing `transform` through the CSSOM property setter. `dt` is clamped to 32ms so a backgrounded tab cannot teleport everything.
5. A clone is retired once it has fully cleared the bottom edge.
6. The overlay is destroyed when the last clone retires, or after a 3-second hard timeout. The timeout is a safety net: a stuck loop must never leave an inert overlay covering a live page.

**Re-entrancy.** A navigation starting while a transition is running cancels the running one, destroys its overlay immediately, and starts fresh.

**Motion constants.** Starting points, to be tuned against real pages during implementation.

| Quantity | Value |
|---|---|
| Gravity | 2000 px/s² |
| Initial vertical velocity | −60 to 0 px/s |
| Horizontal drift | −40 to 40 px/s |
| Angular velocity | −180 to 180 deg/s |
| Stagger between pieces | 18 ms, total capped at 250 ms |
| Piece ceiling | 150 |

Per-piece randomness is seeded from the piece's index so a given page falls the same way every time, which makes visual regressions reproducible.

Only `transform` is written. No property that forces layout is touched during the loop.

## 6. The incoming page

The incoming settle animates the **real** elements, not clones, since they are already in their final positions and are not going anywhere. They drift in from roughly 24px above their resting positions with a short fade, staggered in DOM order, over about 320ms — comfortably shorter than the fall, so arrival reads as one gesture rather than a second animation. The two overlap.

**The settle cannot use §4's piece list unchanged.** Translating a real element also translates its descendants, so any list containing both an element and its ancestor would animate the same pixels twice at two different offsets. The settle therefore animates only the **leaf** pieces, meaning those with no element children, which are mutually disjoint by construction. Shells and their descendants never both move. In practice this settles the text, images and buttons while their containers stay put, which is the lighter effect the short window wants anyway.

## 7. Required change to the character route

`GalleryCharacterRoute` currently reads its character from the `data-character` attribute on `#root`, which the build bakes into each character page's static HTML. It reads it once, at mount.

Under client-side navigation this breaks. Navigating from `/gallery/` to `/gallery/<slug>/` leaves the document as the one served for `/gallery/`, whose `#root` carries no `data-character`, so the component returns `null` and renders a blank page. Clicking a character card is the most common navigation on the site, so this is a blocker rather than an edge case.

**Fix:** keep the embedded attribute as the fast path when it is present *and its slug matches the current route*; otherwise fetch `/data/characters.json` and select by slug. This is exactly what `GalleryIndexGrid`, `QueueBoard`, `TosPointList` and `Commissions` already do, so it introduces no new pattern. The route sets `document.title` to `${character.name} | Vyphir` once it has data.

## 8. Accessibility and reduced motion

- **`prefers-reduced-motion: reduce` skips the entire effect.** No overlay, no clones, no settle; the navigation happens plainly. This matches every other sub-project in this repo. The check is read at transition time, not cached at load.
- The overlay carries `aria-hidden="true"` and `inert`, and is `pointer-events: none`. Nothing that is falling is focusable, clickable or reachable by a screen reader.
- Focus moves to the incoming page's document body on navigation, so keyboard users are not left with focus on a detached clone.
- Falling clones are decorative duplicates; the real content is present and readable underneath from the moment the router commits.

## 9. Module layout

| File | Responsibility |
|---|---|
| `src/transitions/should-intercept.js` | Pure predicate. Imports nothing. Takes the event's relevant fields, the resolved URL, and the eligible path list; returns a boolean. |
| `src/transitions/collect-pieces.js` | The §4 walk. DOM-dependent. |
| `src/transitions/fall.js` | Clone preparation, the overlay, the animation loop, cleanup. |
| `src/transitions/settle.js` | The §6 incoming animation. |
| `src/transitions/PageTransitions.jsx` | React wiring: installs the listener, derives eligible paths from `routes`, drives the router, sets title and scroll. Mounted inside `App`. |
| `public/styles.css` | Overlay and piece rules, plus the reduced-motion block. |

`PageTransitions` must be SSR-safe: no `document` access during render, everything in effects, since `App` is also rendered by `entry-server.jsx` under `StaticRouter`.

## 10. Testing

This repo has no browser or visual-regression tooling, and both sub-project 2 and sub-project 3 explicitly declined to add any. This spec adds none either. Instead the decision logic is extracted into pure functions where the real bugs live, and motion is verified by hand.

**Unit tests** for `shouldIntercept`, table-driven, each asserting a boolean:

- plain left click on an internal link → intercept
- each of ctrl, meta, shift and alt held → do not intercept
- middle click and right click → do not intercept
- `download` attribute present → do not intercept
- `target="_blank"` → do not intercept
- external origin (each of the six hub socials) → do not intercept
- `/admin/` → do not intercept
- `/i/<id>` → do not intercept
- an unknown path → do not intercept
- same-page fragment → do not intercept
- already `defaultPrevented` → do not intercept
- `/queue` and `/tos` without trailing slashes → intercept, normalised
- `/gallery/<slug>/` → intercept
- a click on an element nested inside an anchor → intercept

**Unit tests** for title lookup: every static route resolves to the title in the route table.

**Component tests** for the character route: renders from embedded data when the slug matches; fetches and selects by slug when the attribute is absent or belongs to another character; renders nothing rather than crashing when the slug matches no character.

**Regression:** the existing suite (197 tests as of `84d7102`) must stay green.

**Manual browser pass**, using the Chromium harness already in `.superpowers/sdd/2026-09-07-landing-hub/`:

- frames captured mid-fall from the hub and from the gallery, at a desktop and a phone viewport
- a character card click, confirming the correct character renders after a client-side navigation
- the title changing on client-side navigation
- reduced-motion emulation confirming the effect is skipped entirely
- middle-click and ctrl-click confirming a new tab still opens
- **Firefox**, by hand, since the CSP probe and every capture in this project are Chromium-only

## 11. Done when

- Clicking an internal link breaks the outgoing page into pieces that fall and tumble off the bottom, revealing the incoming page.
- The background stays put; everything else falls.
- Middle-click, modifier-click, external links, `/admin/` and `/i/<id>` all behave exactly as they do today.
- Character pages render the right character after a client-side navigation.
- Titles and scroll position are correct on every client-side navigation.
- Reduced motion skips the effect.
- No `setAttribute('style', …)` anywhere in the feature.
- Full test suite green, with the new unit tests above.
- Manual pass complete, including Firefox.

## Out of scope

- Reworking each page into a more distinctive layout rather than a shared panel — **sub-project 5**, to be specced separately. The piece rule in §4 is deliberately layout-agnostic so that redesign will not invalidate this engine.
- Transitions on browser back and forward (§3).
- Rigid-body physics, collisions, bouncing or resting piles.
- Any change to Admin, `functions/`, the CMS/API or the build pipeline.
