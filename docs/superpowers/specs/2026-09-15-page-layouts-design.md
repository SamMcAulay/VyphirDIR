# Inner Page Layouts and Site Bar — Design Spec

**Status:** Approved, implementation pending

**Context:** Sub-project 5 of the site overhaul. Sub-project 1 ([2026-09-04-react-vite-ssg-foundation-design.md](2026-09-04-react-vite-ssg-foundation-design.md)) moved the site onto React/Vite SSG; sub-project 2 ([2026-09-06-slime-design-system-design.md](2026-09-06-slime-design-system-design.md)) introduced the Slime visual language and the shared `Panel` card; sub-project 3 ([2026-09-07-landing-hub-design.md](2026-09-07-landing-hub-design.md)) rebuilt `/` as a radial hub; sub-project 4 ([2026-09-10-page-transitions-design.md](2026-09-10-page-transitions-design.md)) added gravity-drop page transitions and deferred "reworking each page into a more distinctive layout rather than a shared panel" to this spec.

Today every inner page is the same composition: a back link, a large wave-text title and one component inside a single white `Panel`, centred on cream. None of the hub's visual language reaches past the front door, images are small, and on a phone the panel's padding and outlines take space the art could use.

**Goal:** Replace the centred panel on every inner page with a full-width, conventional web layout built mobile-first, keeping the Slime palette, type and micro-interactions. A persistent, themed site bar replaces back links and page titles. Images get as much of the screen as possible, especially on phones.

**Non-goal:** The hub stays the site's one loud moment and is not changed. No changes to Admin, `functions/`, the CMS/API, the data file shapes or the build pipeline. No new npm dependencies.

**Design record:** every decision below was chosen from side-by-side mockups at 1440px and 375px during brainstorming. The mockups are kept locally in `.superpowers/brainstorm/68762-1789483356/content/` (gitignored) and are a reference, not a source of truth; where they differ from this document, this document wins.

---

## 1. Decisions at a glance

| Area | Decision |
|---|---|
| Page chrome | No panel, no card outlines, no visible page titles, no back links (except the character page's "All characters" link). |
| Site bar | Bead ribbon with tonal rims (mockup A1). Stays put between inner pages. Scrolls away with the page; not sticky. |
| Gallery | Cover tiles (G1). |
| Character page | Feature image beside the bio, then a square grid (P2). |
| Commissions | Tiers side by side on desktop (C1); a swipeable tier strip on phones (M1). Past work as a square grid with no captions. |
| Queue | One card per commission with progress beads (Q2). |
| Terms of Service | Everything open with a numbered index, plus Will draw / Won't draw panels (T1). |
| Wave hover | On the bar's section labels and the character name. Not added to other headings. |

## 2. Breakpoints and page frame

Three ranges, used everywhere in this spec:

| Name | Width |
|---|---|
| phone | up to 599px |
| tablet | 600px to 899px |
| desktop | 900px and up (the same switch the hub already uses) |

Content sits in a centred column capped at 1280px. On desktop and tablet it has 8px side padding; on phones, image grids run edge to edge with square corners and text blocks get 14px side padding. The ribbon itself always spans the full viewport width.

Nothing may cause horizontal page scrolling at any width down to 320px. The only horizontal scrolling allowed is inside the tier strip (§6.3) and the Terms chip row (§6.5).

## 3. The site bar

### 3.1 Sections

A new pure module, `src/site/sections.js`, is the single source for the bar:

| key | Visible label | Phone label | Accessible name | href | Colour | Blob |
|---|---|---|---|---|---|---|
| `gallery` | Gallery | Gallery | Gallery | `/gallery/` | teal | 1 |
| `commissions` | Commissions | Comms | Commissions | `/commissions/` | honey | 3 |
| `queue` | Queue | Queue | Queue | `/queue/` | tabby | 2 |
| `tos` | Terms | Terms | Terms of Service | `/tos/` | lavender | 4 |

Blob numbers index the existing `BLOB_PATHS` in `src/components/decor/blob-paths.js`. Gallery and Commissions reuse the hub's blob assignments.

It exports:

- `SECTIONS`, the table above.
- `sectionForPath(pathname)`: returns the section key for a normalised pathname, or `null`. `/gallery/` and `/gallery/<slug>/` both return `gallery`.
- `usesSiteLayout(pathname)`: true exactly when `sectionForPath` returns a key.

### 3.2 Markup

```
header.site-bar.site-bar--{colour}
  svg.site-bar__ribbon            (aria-hidden, full width, wavy band)
  div.site-bar__inner             (max 1280px, centred)
    a.site-bar__photo  href="/"  aria-label="Home"
      img  (the hub photo)
    nav.site-bar__nav  aria-label="Site"
      a.site-bead[.is-active]  href  aria-label={accessible name}  aria-current="page" when active
        svg.site-bead__blob       (aria-hidden)
        WaveText  .site-bead__label--long   (aria-hidden)
        span      .site-bead__label--short  (aria-hidden)
```

The link carries the accessible name, so both visible labels are hidden from assistive technology and CSS shows the long label above phone width and the short label on phones.

### 3.3 Appearance

- **Ribbon:** the same wavy band path as the mockup, filled with the active section's light tint. `preserveAspectRatio="none"`. Bar height 96px on desktop and tablet, 72px on phones.
- **Inactive bead:** filled with its own section's light tint, no outline, ink label.
- **Active bead:** filled with its own section's base colour, with a 5px rim (4px on phones) in that section's dark shade, drawn with `vector-effect: non-scaling-stroke`. Its label uses that section's ink token (§8), never white.
- **Photo:** 70px circle (50px on phones) with a 4px ring (3px on phones) in the active section's base colour.
- **Size:** beads are 128×64px on desktop and scale down on phones so all four plus the photo fit at 320px. Each bead's hit area stays at least 44px tall.
- **Change of section:** fill, rim and ribbon colours change with a 200ms transition. Under `prefers-reduced-motion: reduce` the change is instant.
- **Interaction:** beads use the existing `usePopClick` pop and their long label waves on hover, following the hub's pattern.

Blob fills and strokes are set by CSS classes, not SVG attributes, so the transition works and nothing depends on inline styles (§9).

### 3.4 Where the colour comes from

Each page's colour wrapper (`.page-teal` etc.) sits inside the layout, below the bar, so the bar cannot inherit it. The bar sets its own modifier class from `sectionForPath` instead.

## 4. The layout route

### 4.1 Routing

`src/routes.js` gains `siteLayout: true` on the `/gallery/`, `/commissions/`, `/tos/` and `/queue/` entries.

`App.jsx` renders one layout route whose element is `<SiteLayout />`, with every `siteLayout` route and `/gallery/:slug/` as its children. `/` and `/admin/` stay outside it. React Router keeps a layout element mounted while its child route changes, so moving between inner pages updates the bar in place rather than remounting it.

### 4.2 `SiteLayout`

`src/site/SiteLayout.jsx`:

```
div.site
  <SiteBar />
  main.site-page
    {children ?? <Outlet />}
```

Accepting `children` lets the character build path (§5) render the same tree without a router outlet. Page components no longer render their own wrapper panel or back link.

`SiteBar` lives in `src/site/SiteBar.jsx` and reads the current path with `useLocation`, so it always renders inside a router.

## 5. Server rendering and hydration

- **`render(url)`** already renders `<App />` under `StaticRouter`, so the static pages pick up the layout with no change.
- **`renderCharacter(character)`** currently renders `<GalleryCharacter>` with no router. It becomes:

  ```
  <StaticRouter location={`/gallery/${character.slug}/`}>
    <SiteLayout><GalleryCharacter character={character} /></SiteLayout>
  </StaticRouter>
  ```

  On the client, the tree is `SiteLayout → Outlet → GalleryCharacterRoute → GalleryCharacter`, and `GalleryCharacterRoute` adds no markup of its own and reads the embedded character as its initial state. The two therefore produce identical HTML, which hydration requires.
- **`renderLanding`** is unchanged; the hub has no bar.

`PageTransitions` renders nothing, so its presence in `App` and absence from `renderCharacter` does not affect markup.

## 6. Pages

Every page gets a visually hidden `h1` (the existing `.sr-only` class) with its current title, so the document outline and screen reader announcements survive the removal of visible titles. The character page is the exception: its name is the visible `h1`.

### 6.1 Gallery (`Gallery.jsx`, `GalleryIndexGrid.jsx`)

- **Grid:** 1 column on phones, 2 on tablets, 3 on desktop. Square tiles, 8px gaps (6px on phones), 22px corner radius (square on phones).
- **Tile:** the whole tile is one link to `/gallery/<slug>/`. The cover image uses the existing selection: the first image flagged `thumbnail` that is not NSFW, else the first non-NSFW image, rendered `object-fit: cover`. A character with no safe image gets a tile filled with the teal light tint.
- **Label:** a cream, blob-cornered label in the bottom-left corner holding the name (Fredoka, teal ink) and the first bio line on one line, truncated with an ellipsis.
- **Removed:** the three-thumbnail art row under each card.
- **Interaction:** pop on press, wave on the name when the tile is hovered.

### 6.2 Character page (`GalleryCharacter.jsx`)

- **Top section:** the feature image and the intro.
  - Desktop: two columns, image 44% wide, intro in the remaining space, aligned to the bottom of the image.
  - Tablet and phone: stacked, image first, full width (edge to edge on phones).
  - The feature image uses the same selection as the gallery tile and opens full size on tap.
- **Intro:** a small "← All characters" link to `/gallery/`, the name as a wave-text `h1` in teal ink, the species, and the bio with its line breaks preserved (`white-space: pre-line`).
- **Grid:** every other image, including NSFW ones, as squares. 2 columns on phones, 3 on tablets, 4 on desktop; 8px gaps, 16px corners on desktop and tablet, 5px gaps and square corners on phones.
- **Unchanged behaviour:** tap to enlarge (`EnlargeableImage`) and tap to reveal NSFW (`NsfwBlurImage`). The NSFW cover gets a solid muted fill with white text.
- **No safe image at all:** the top section is just the intro, at full width.

### 6.3 Commissions (`Commissions.jsx`, `CommissionTierList.jsx`, `PastWorkGrid.jsx`)

**Top row.** A status sticker beside the intro (stacked above it on phones):

- open: a blob in teal light tint with a teal dark rim reading "Commissions open!"
- closed: pink light tint with a pink dark rim reading "Commissions closed"

The intro follows with line breaks preserved. When `specialOffer` is non-empty it appears under the intro on a honey light strip with blob corners.

The Queue and Terms of Service buttons are removed, since the bar links to both. With them gone, `LinkButton.jsx` has no importers and is deleted.

**Tier strip.** The tiers always render in one horizontal, snap-scrolling row:

| Range | Tier width |
|---|---|
| phone | 78% of the strip, so the next tier peeks in |
| tablet | half the strip minus the gap |
| desktop | a third of the strip minus the gaps |

So desktop shows at most three tiers side by side, and a fourth or later scrolls exactly as on phones. Details:

- Snap alignment is `start`, with `scroll-padding-inline` equal to the strip's side padding so the first tier is not pulled against the edge.
- The strip is `role="region"`, `aria-label="Commission tiers"` and `tabindex="0"` so it can be scrolled from the keyboard.
- Each tier: its example image as a square with rounded corners, the name as an `h2`, the price in a honey blob, and the description with line breaks preserved.

**Overflow indicators**, shown only while the strip's content is wider than the strip:

- a hint row above it reading "`N` tiers · swipe →"
- dots, one per tier, with the dot for the tier nearest the left edge elongated; the dots are `aria-hidden`
- a honey scrollbar (`scrollbar-color` plus the WebKit scrollbar pseudo-elements)
- a nudge: when overflow is first detected, the strip gets a class that plays a CSS animation sliding the row 46px left and back, twice, after a 0.9s delay. It is not played under `prefers-reduced-motion: reduce`.

Overflow is measured in an effect and re-measured on resize. The active dot follows the scroll position, read from a passive scroll listener and throttled to one update per animation frame. Both reach the DOM only as class names.

**Past work.** A visible `h2` "Past work", then a square grid: 2 columns on phones, 3 on tablets, 4 on desktop, edge to edge on phones. Captions are no longer displayed. Each image's alt text stays as it is today: the caption when present, otherwise "Past gift art" or "Past commission work". NSFW items keep tap to reveal.

### 6.4 Queue (`Queue.jsx`, `QueueBoard.jsx`)

A new pure function in `src/components/queue-entries.js`:

`queueEntries({ columns, cards })` returns `{ stages, active, finished }`, where:

- `stages` is the enabled columns, in data order.
- Cards whose `columnId` is not an enabled stage are dropped (today's behaviour).
- Each remaining card gains `stageIndex` and `stageCount`.
- When there are two or more stages, cards in the last stage are `finished`; everything else is `active`. With a single stage nothing counts as finished.
- `active` is sorted by `stageIndex`, furthest along first. The sort is stable, so cards within a stage keep data order.
- `finished` keeps data order.

**Layout.** One column of cards on phones and tablets, two on desktop. `active` cards first, then a label "Finished · `N`", then `finished` cards. Neither group renders when it is empty.

**Card.** A tabby light fill with blob-ish corners and no outline, containing:

- the title as an `h2`
- one meta line joining whichever of "For: …", "target dd/mm/yyyy" and the relative age ("added 2 days ago") exist, separated by " · "
- the bead track, `aria-hidden`: one small blob bead per stage, joined by short bars. Beads and bars before the current stage are filled tabby. The current bead is larger, filled tabby, with a tabby dark ring. Later beads are cream.
- a stage line: "`stage name` · stage `i` of `n`" for active cards, and just the stage name for finished ones. This line is what conveys progress to screen readers.

Finished cards use a desaturated fill, and their track uses muted beige in place of tabby.

### 6.5 Terms of Service (`Tos.jsx`, `TosPointList.jsx`)

A new pure function in `src/components/split-tos.js`:

`splitTos(points)` returns `{ will, wont, points }`:

- `will` and `wont` are the texts of every `yesno` bullet across all points, split on `value`, in data order.
- `points` is the input with `yesno` bullets removed from each point's `bullets`. Plain bullets, bodies and titles are untouched.

**Draw panels.** Two panels side by side at every width: "Will draw" (teal light fill, teal ink, ✓ markers) and "Won't draw" (pink light fill, pink ink, ✕ markers). A panel with an empty list does not render; if both are empty, neither does.

**Desktop layout.** Two columns: a 220px index on the left and the body on the right.

- The index is a `nav` with `aria-label="Terms"`: one link per point, each with a small numbered blob and the point's full title, pointing at `#tos-<n>`.
- It is `position: sticky` with a small top offset. The bar is not sticky, so nothing covers it.
- The body is the draw panels, then every point.

**Phone and tablet layout.** The index becomes a horizontally scrollable row of chips reading "`n` `title`", above the draw panels.

**Points.** Each point is a `section` with `id="tos-<n>"` and `scroll-margin-top` so a jump does not land flush against the viewport edge. It holds an `h2` with a numbered lavender blob and the title, the body with line breaks preserved, and the remaining bullets.

**Current point.** An `IntersectionObserver` marks the topmost visible point. Its index link and chip get `is-current` and `aria-current="true"`, which on desktop draws a lavender light fill with a lavender dark inner ring. Index links are same-page fragments, which the transition seam already declines to intercept, so they jump without a transition.

### 6.6 Loading, empty and error states

Pages keep fetching their data after mount, and a page with no data yet still renders nothing below the bar. The leftover terminal-style copy is replaced:

| Where | Was | Becomes |
|---|---|---|
| any fetch failure | `> DATA UNAVAILABLE.` | Couldn't load this right now. Try refreshing the page. |
| gallery, no characters | `> NO CHARACTERS ARCHIVED YET` | No characters here yet. |
| queue, no enabled stages or no cards | `> QUEUE IS CURRENTLY EMPTY` | The queue is empty right now. |
| terms, no points | `> NO TERMS PUBLISHED YET` | No terms published yet. |

## 7. Page transitions

The piece rule in the page-transitions spec §4 is unchanged. What changes is **where the walk starts**, because `#root`'s first rendered child is now the whole layout, bar included.

A new pure function, `transitionScope(fromPath, toPath)` in `src/transitions/scope.js`, returns:

- `'page'` when both paths satisfy `usesSiteLayout`: the bar is shared by both pages, so only the content below it may fall or settle.
- `'document'` otherwise, meaning any navigation to or from a page outside the layout (in practice the hub). The whole tree falls or settles, so the bar falls when leaving for the hub and settles in when arriving from it.

`pageRoot(scope)` in `collect-pieces.js`:

- `'document'` behaves exactly as `pageRoot()` does today.
- `'page'` returns `firstRenderedChild` of `main.site-page`, falling back to the `'document'` result if that element is absent.

`PageTransitions` computes the scope on click from the current and target pathnames, uses it for the fall, and stores it next to `pendingSettleFor` so the arrival settles the same scope. Everything else about the seam is unchanged:

- The bar's links are ordinary eligible links.
- Clicking the active section from its own page is already ignored by the same-path guard.
- Browser back and forward still navigate without the effect.

## 8. Tokens and styles

**New tokens** in `public/styles.css`, one per slime colour: `--slime-teal-ink`, `--slime-honey-ink`, `--slime-tabby-ink`, `--slime-lavender-ink` and `--slime-pink-ink`. Each is the text colour used on that colour's base fill and on its light tint, and each must reach a contrast ratio of at least 4.5:1 against both. The mockup's teal label colour (`#0E5E56`) falls short on the teal base fill, so teal uses `#0A4540` (5.2:1). Honey `#5E4400` (6.0:1), tabby `#6B3300` (4.8:1) and lavender `#3E1F7A` (4.9:1) keep their mockup values, and pink uses `#6A1234` (4.6:1 on the pink base).

**Changed token:** `--text-muted` darkens from `#8A7368`, which measures 4.1:1 on cream, to `#735E53` (5.7:1).

**Also new:** `--surface-muted: #F4EDE3`, `--bead-muted: #D9CBBB` and `--bead-muted-ring: #B8A594`, for finished queue cards.

A unit test parses these tokens out of the stylesheet and asserts every text and fill pairing this spec uses reaches 4.5:1.

**New class families,** one prefix per component: `site-bar`, `site-bead`, `site-page`, `gallery-tile`, `character-`, `tiers`, `past-work`, `queue-`, `tos-`.

**Removed with their last users:**

- `.panel-wrapper`, `.panel`, `.panel--wide`, `.panel--xwide`
- `.links-grid` and `.link-btn`
- `.profile`, `.section-title`, `.char-species`, `.char-bio` and `.char-image-grid`
- the `.gallery-index-*` rules
- `.tier-card` and `.tier-price`
- the old `.queue-*` board rules
- the old `.tos-*` card rules
- `.commission-status`, `.commission-special-offer` and `.gallery-empty`

**Kept, because `functions/i/[id].js` still uses them:** `.back-link`, `.feed-error`, `.datapad-wrapper`, `.datapad-screen`, `.char-image-wrap` and the `.nsfw-*` rules. The `/i/<id>` image page is server-rendered by that Cloudflare function from the same stylesheet. Where a rule shares a selector list with `.panel*` (for example `.panel-wrapper, .datapad-wrapper`), only the `.panel*` selector is removed.

**Deleted files:** `src/components/Panel.jsx`, `tests/panel.test.js` and `src/components/LinkButton.jsx`. `usePopClick` loses its only user with `LinkButton` and gains the bar's beads, so it stays.

## 9. CSP

The site's `style-src` has no `'unsafe-inline'`, and style attributes are silently discarded (page-transitions spec §2). Therefore:

- No `style={…}` props and no `setAttribute('style', …)` anywhere in this work.
- Every piece of dynamic state (active bead, overflow, active dot, nudge, current Terms point) reaches the DOM as a class name or an ARIA attribute.
- SVG presentation attributes (`d`, `viewBox`, `preserveAspectRatio`) are allowed, as on the hub. Fills and strokes that change with state are set from CSS classes.

A test (§11) scans the new and changed components for `style=` to keep this from regressing silently, since a discarded style is invisible to every other test.

## 10. Accessibility

- **Headings:** one `h1` per page (§6), with `h2` for tiers, "Past work", queue cards and Terms points.
- **Current location:** the active bead has `aria-current="page"`; the current Terms point's links have `aria-current="true"`.
- **Focus:** every link and tile gets a visible `:focus-visible` ring in its section's dark shade.
- **Keyboard:** the tier strip is focusable and scrollable with the arrow keys; the Terms index links jump to their sections.
- **Decoration:** the ribbon, bead blobs, queue tracks and dots are `aria-hidden`. The meaning they carry is repeated in text: the link names, the stage line and the "N tiers" hint.
- **Reduced motion:** turns off the bead colour transition and the tier nudge, on top of the existing reduced-motion rules for pop, wave and transitions.
- **Contrast:** §8's ink tokens meet 4.5:1. The muted grey-brown `--text-muted` on cream is checked against 4.5:1 during the manual pass.
- **Touch targets:** beads, gallery tiles and Terms chips are at least 44px tall. The dots are decorative and not interactive.

## 11. Testing

The repo's established pattern is SSR structural tests plus pure-function unit tests, with motion and layout verified by hand. This spec follows it and adds no browser test tooling.

**Unit tests (pure functions):**

- `sectionForPath` and `usesSiteLayout`: each section path, with and without a trailing slash; `/gallery/<slug>/`; `/`, `/admin/`, `/i/<id>` and an unknown path return `null` or false.
- `transitionScope`:
  - inner to inner is `'page'`, including gallery to character and character to gallery
  - inner to hub and hub to inner are `'document'`
  - admin paths are `'document'`
- `queueEntries`:
  - disabled stages drop their cards
  - active cards are ordered furthest along first, keeping data order within a stage
  - the last stage is finished only when there are two or more stages
  - empty input returns empty groups
- `splitTos`:
  - yes/no bullets from several points are collected in order
  - plain bullets, bodies and titles are preserved
  - points left with no bullets keep an empty array
  - no yes/no bullets returns empty `will` and `wont`

**SSR structural tests:**

- `SiteBar` for each section: four bead links, exactly one `aria-current="page"` on the right section, the photo link to `/` with `aria-label="Home"`, and the section's colour modifier class.
- Each inner page under `render(url)`: the bar is present, no `panel-wrapper` or `back-link` remains, and there is a visually hidden `h1` with the page title.
- The character page from the build output: the bar with Gallery active, the character name as a visible `h1`, the "All characters" link to `/gallery/`, and `data-character` still on `#root`.
- Components rendered with fixture data:
  - the gallery tile link and label
  - the character feature image and grid count, with the feature image excluded from the grid
  - the tier strip's region attributes and one `h2` per tier
  - past work with no caption paragraphs and correct alt text
  - queue cards with the stage line and a "Finished" label only when finished cards exist
  - the Terms index links matching point ids, and the draw panels omitted when empty
- **CSP guard:** no `style=` in the SSR output of any page or of the rewritten components.

**Updated in the same commit that removes what they assert on:** `panel.test.js` (deleted), and the panel and back-link assertions in `gallery-index-page`, `commissions-page`, `queue-page`, `tos-page`, `page-transitions` and `render-pages`.

**Regression:** the full existing suite stays green.

**Manual browser pass** using the Chromium harness from this brainstorm (`.superpowers/sdd/2026-09-15-page-layouts/still.mjs`) and the transitions harness (`.superpowers/sdd/2026-09-12-page-transitions/`):

- every inner page at 375, 768 and 1440px, plus 320px for the bar
- inner to inner navigation: frames mid-fall show the bar still and only page content falling
- inner to hub and hub to inner: the bar falls and settles with the page
- the character page loaded directly and reached by client-side navigation, with no hydration mismatch warnings in the console
- the tier strip: swipe, dots following, the nudge playing once, no nudge with reduced motion emulated, and no hint or dots on desktop with three tiers
- the Terms index: highlighting while scrolling, and jumping on click
- contrast spot checks on the bead labels, sticker, price blob and muted text
- Firefox, by hand

## 12. Delivery

One implementation plan, in phases. Each phase ends with the site working and the suite green:

1. `sections.js`, `SiteBar`, `SiteLayout`, the layout route, `renderCharacter`, `transitionScope` and `pageRoot(scope)`. At the end of this phase the pages still render their old panels, now under the bar.
2. Gallery and character pages.
3. Commissions: status sticker, tier strip, past work, `LinkButton` removal.
4. Queue: `queueEntries` and progress beads.
5. Terms of Service: `splitTos`, index, draw panels.
6. Cleanup: `Panel` and dead CSS removal, the copy changes, the CSP guard test, the manual pass.

## 13. Done when

- No inner page renders a `Panel`, a back link (other than "All characters") or a visible page title.
- The bar appears on every inner page and the character pages, highlights the right section, fits at 320px, and stays still while navigating between inner pages.
- The bar falls when leaving for the hub and settles in when arriving from it.
- Each page matches its layout in §6 at phone, tablet and desktop widths.
- The ink tokens and focus rings meet §8 and §10.
- No `style=` in any rendered page.
- Full test suite green, with the new tests in §11.
- Manual pass complete, including Firefox.

## Out of scope

- Any change to the hub or Admin.
- A sticky bar.
- Data or CMS changes, including an explicit "finished" flag on queue columns. §6.4's last-stage rule stands in for it.
- Responsive image sizes (for example Cloudinary transforms or `srcset`). Grids load the same image files they do today.
- A lightbox or in-page enlarge view; tapping still opens `/i/<id>`.
- Transitions on browser back and forward.
- Wave hover on headings other than the bar labels and the character name.
