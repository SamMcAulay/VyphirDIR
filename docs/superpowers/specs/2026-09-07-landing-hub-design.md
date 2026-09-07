# Landing Hub — Design Spec

**Status:** Approved, implementation pending

**Context:** Sub-project 3 of the site overhaul. Sub-project 1 ([2026-09-04-react-vite-ssg-foundation-design.md](2026-09-04-react-vite-ssg-foundation-design.md)) moved the site onto React/Vite SSG; sub-project 2 ([2026-09-06-slime-design-system-design.md](2026-09-06-slime-design-system-design.md)) replaced the visual language with the Slime design system. Those specs described sub-project 3 as a "Persona-style centralized navigation menu + mobile fallback". **That framing is superseded by this spec.** There is no overlay menu and no trigger button: the landing page itself becomes the navigation hub.

**Goal:** Rebuild `/` (the page vyphir.com points at) as a Persona/Metaphor-inspired radial hub — circular profile photo centre-right, chunky outlined words pinned to the photo's edge radiating outward in a symmetric fan, with hover emphasis and blob-framed preview art.

**Non-goal:** No physics-based page-transition engine (sub-project 4). No changes to routing, the build pipeline, the CMS/API, `functions/`, or Admin. No new npm dependencies.

**Supersedes:** The entire current content of `src/pages/Landing.jsx` — profile card, social links grid, the two preview sections and the Bluesky feed section.

---

## 1. Composition (desktop)

Full-bleed: Landing drops its `Panel` wrapper. Three angular colour slabs sit behind everything, then a hub anchor positioned at `left: 72%; top: 50%` from which the photo and all words are placed in polar coordinates.

**Slabs** (decorative, `aria-hidden`):

| Slab | Placement | clip-path | Extra |
|---|---|---|---|
| teal `#C6F5EF` | `inset: -8% -6% auto -6%; height: 72%` | `polygon(0 0, 100% 0, 100% 58%, 0 100%)` | — |
| pink `#FFD3E4` | `left: -8%; top: 6%; width: 58%; height: 80%` | `polygon(9% 2%, 100% 0, 91% 97%, 0 86%)` | `rotate(-3deg)` |
| honey `#FFEDB0` | `left: 4%; top: 58%; width: 30%; height: 26%` | `polygon(4% 8%, 100% 0, 92% 100%, 0 88%)` | `rotate(4deg)`, `opacity: .85` |

**Photo:** 290px circle at the hub anchor (`translate(-50%, -50%)`), `border: 5px solid #3A2A24`, `box-shadow: 12px 12px 0 rgba(58,42,36,.20)`, `object-fit: cover`. Source is the existing avatar URL `https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401`. It is a link to `/` with an accessible name of "Home".

**Words:** each is positioned absolutely relative to the hub anchor with `transform-origin: 100% 50%` and `transform: translate(-100%, -50%) rotate(var(--rot))`. This pins the word's right edge on the photo's edge (anchor radius 155px) and runs it outward along its own radius. Values are constants, not computed at runtime:

| Word | href | left | top | --rot | font-size | colour | text-stroke | blob px | blob x-bias |
|---|---|---|---|---|---|---|---|---|---|
| Gallery | `/gallery/` | -113px | -106px | 43deg | 44px | `#23C9B7` | 3px | 360 | 34% |
| Commissions | `/commissions/` | -142px | -62px | 23deg | 44px | `#FFC93C` | 3px | 420 | 32% |
| Instagram | `https://www.instagram.com/vyphir` | -154px | -21px | 8deg | 26px | `#FF6FA0` | 2px | 170 | 50% |
| Twitter | `https://x.com/Vyphirr` | -155px | 10px | -4deg | 24px | `#B98CFF` | 2px | 150 | 50% |
| Bluesky | `https://bsky.app/profile/samisaderp.bsky.social` | -150px | 39px | -15deg | 23px | `#23C9B7` | 2px | 145 | 50% |
| Telegram | `https://t.me/Samisaderp#` | -141px | 64px | -25deg | 21px | `#FF9A44` | 2px | 135 | 50% |
| Toyhouse | `https://toyhou.se/samisaderp/characters` | -129px | 87px | -34deg | 20px | `#FF6FA0` | 2px | 125 | 50% |
| Steam | `https://steamcommunity.com/profiles/76561199191219060/` | -113px | 106px | -43deg | 19px | `#B98CFF` | 2px | 115 | 50% |

Word type: Fredoka 700, uppercase, `line-height: 1`, `letter-spacing: -.5px`, `-webkit-text-stroke` in `#3A2A24` with `paint-order: stroke fill`, plus `filter: drop-shadow(3px 3px 0 rgba(58,42,36,.20))`.

External links (all six socials) get `target="_blank"` and `rel="noopener noreferrer"`, matching the current Landing behaviour.

**Scaling for smaller desktops:** the hub is scaled as one unit rather than re-laid out — `scale(1)` at ≥1200px, `scale(0.82)` between 1000px and 1199px, `scale(0.72)` between 900px and 999px. Below 900px the mobile layout in §3 takes over.

## 2. Hover and focus behaviour

Applies on `:hover` **and** `:focus-visible`, so keyboard users get the same emphasis:

- The active word scales to `1.18` about its pinned edge, so it grows outward, away from the photo — never over it.
- Every other word scales to `0.84` and drops to `opacity: .42`.
- The active word's blob fades in from `scale(.5)` to `scale(1) rotate(6deg)` and then pulses (`2.6s ease-in-out infinite`, scale 1 → 1.05, rotate 5deg → 9deg).
- Transitions use the site's existing pop easing, `cubic-bezier(.34,1.56,.64,1)`.

Blobs reuse the four existing paths from `src/components/decor/Blob.jsx`. Socials get a flat blob in their accent-light colour. Gallery and Commissions get **preview blobs** (§4).

**Reduced motion:** under `prefers-reduced-motion: reduce`, drop the scale changes and the pulse entirely. Emphasis becomes opacity only — the active word stays at `opacity: 1` while the others go to `.42`, and its blob appears without animating.

## 3. Mobile (below 900px)

The fan is abandoned, not compressed. Photo centred near the top at 180px, then the eight words in a single vertical list beneath it in DOM order, left-aligned, unrotated, keeping the chunky outlined type and per-word colours (Gallery/Commissions at 34px, socials at 22px). Slabs simplify to the teal and pink only.

There is no hover on touch, so the preview blobs do not apply here; Gallery and Commissions get flat accent-light blobs behind them as decoration. Tapping a word navigates.

## 4. Preview blobs (Gallery and Commissions)

Hovering either heading fills its blob with real art instead of a flat colour:

- The blob path is used as an SVG `clipPath`. Four images fill a 2×2 arrangement of the `0 0 200 200` viewBox, each `preserveAspectRatio="xMidYMid slice"`.
- A tint rect covers the images inside the clip — `#C6F5EF` at `.34` for Gallery, `#FFEDB0` at `.32` for Commissions — so the word stays legible over the art.
- The blob path is stroked on top in `#3A2A24` at `stroke-width: 4` so it reads as a sticker.
- The blob's x-bias (table in §1) pushes it outward from the photo so art never covers the face.

**Data:** image URLs are baked into the page at build time, following the pattern already used for character pages (which embed their data rather than fetching it). `scripts/render-pages.js` already reads `data/characters.json` and `data/commissions.json` during the build; it passes the first four eligible image URLs from each into the Landing render. No client-side fetch, no loading state.

**NSFW exclusion is mandatory.** Only images whose `nsfw` flag is falsy are eligible for either preview set — for characters this means the character's first non-NSFW image, for commissions the first four non-NSFW `pastWork` entries. The front page is never gated, so this filter is a correctness requirement, not a nicety.

If either data file yields fewer than four eligible images, the blob renders with however many exist, tiled to fill; if it yields none, the blob falls back to the flat accent-light colour.

## 5. Structure and accessibility

- The eight words are real `<a>` elements inside a single `<nav>`, in DOM order Gallery → Commissions → Instagram → Twitter → Bluesky → Telegram → Toyhouse → Steam. Rotation is purely visual, so reading order matches the intended order.
- The photo link carries an accessible name of "Home".
- Slabs, blobs and the decorative vertical edge label are `aria-hidden="true"`.
- Focus states are visible: `:focus-visible` triggers the same emphasis treatment as hover (§2), so tabbing through the hub is legible.

## 6. Deletions

Removed entirely, along with their tests and their CSS rules:

- `src/components/BlueskyFeed.jsx` and `tests/bluesky-feed.test.js` — the feed goes away at the user's request.
- `src/components/CharacterGalleryStrip.jsx` and `src/components/CommissionsPreviewStrip.jsx` — their content is now surfaced through the preview blobs; both are used only by Landing.
- All current Landing sections: profile card, links grid, the two preview sections with their CTA buttons, and the feed section.

`LinkButton` stays — it is still used by the Commissions page. Gallery, Commissions, Terms, Queue and character pages keep their existing back-links, restyled only as much as needed to sit comfortably with the new front page. Admin, `functions/`, routing and the build pipeline are untouched.

## 7. Testing

Structural SSR tests in the existing `renderToStaticMarkup` style — this repo has no browser or visual-regression tooling and this spec adds none:

- The hub renders exactly eight nav links with the hrefs in the table above, in that DOM order.
- The photo renders as a link to `/` with an accessible name of "Home".
- Preview image URLs are present in the rendered Landing markup for both Gallery and Commissions.
- No NSFW-flagged URL appears in the rendered Landing markup, given fixture data containing NSFW entries.
- Landing renders no Bluesky feed, no preview strips and no `Panel` wrapper.
- Gallery, Commissions, Terms and Queue still render their back-links.

The existing suite (182 tests as of `0b4a634`) must stay green, adjusted where it asserts on deleted Landing markup.

## 8. Done when

- `/` renders the hub as specified at desktop and the vertical list below 900px.
- Hover and keyboard focus both produce the emphasis treatment; reduced-motion drops the animation.
- Preview blobs show baked, non-NSFW art for Gallery and Commissions.
- The deletions in §6 are complete with no dead CSS or unused imports left behind.
- Full test suite green.
- Manual browser pass: contrast of the outlined words over each slab, fan geometry at 1200px / 1000px / 900px, the mobile list on a phone viewport, and reduced-motion behaviour.

## Out of scope

- Physics-based gravity-drop page transitions — sub-project 4, still unspecced.
- Any navigation overlay, trigger button or open/close animation — superseded by this spec.
- Automated visual-regression or browser-testing infrastructure.
