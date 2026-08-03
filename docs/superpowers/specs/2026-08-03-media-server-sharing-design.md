# Media Server / Shareable Images — Design Spec

**Status:** Approved, implementation pending

**Goal:** Turn the site into a "semi media server": every content image (character gallery images, commission past-work images) becomes clickable to enlarge, gets a stable shareable URL that produces a rich embed on Discord/WhatsApp/etc., and the character directory becomes browsable from a single `/gallery` overview instead of only per-character deep links.

**Architecture:** One unifying mechanism covers both "enlarge" and "shareable link": every content image gets a permalink page at `/i/<id>`, served by a new Cloudflare Pages Function. Clicking an image navigates to that page (new tab) — the page itself is both the enlarged view and the copyable/embeddable URL. This avoids building a separate JS lightbox and a separate share mechanism. `/gallery` is a new, mostly independent static page following the existing client-fetch pattern already used by `index.html`/`script.js`.

---

## 1. Image IDs

No data model change. Every uploaded image already gets a random UUID as its Cloudinary `public_id` (`functions/api/_shared/cloudinary.js`), embedded in the URL path, e.g. `.../vyphir/characters/392a6c2d-d49f-45fd-9b74-351e1e5cec69.png`. The permalink ID is that UUID, extracted from the URL. It is already unique across every image in `data/characters.json` and `data/commissions.json`, so existing images work immediately with no migration.

A new shared helper, `shared/image-id.js`, exports `extractImageId(url)` — pulls the filename (minus extension) from the URL path. Used both client-side (to build `/i/<id>` links) and server-side (in the lookup Function).

---

## 2. `/i/[id]` permalink page — new Pages Function (`functions/i/[id].js`)

**Lookup:** a pure, exported function `findImageById(charactersData, commissionsData, id)` searches:
- Each character's `images[]` for an entry whose `extractImageId(url) === id` → returns `{ kind: 'character', url, nsfw, title: character.name, description: character.bio, backHref: '/gallery/' + character.slug + '/' }`.
- `commissionsData.pastWork[]` similarly → returns `{ kind: 'commission', url, nsfw, title: 'Commission — Vyphir', description: item.caption || 'Past commission work', backHref: '/commissions/' }`.
- No match → `null`.

This function takes plain parsed JSON objects (no fetch inside it), so it's unit-testable the same way `validateCharacterPayload` etc. are tested today.

**`onRequestGet(context)`:**
- Extracts `id` from `context.params`.
- Fetches `/data/characters.json` and `/data/commissions.json` via same-origin `fetch` (in parallel).
- Calls `findImageById`. If `null`, returns a minimal 404 HTML page (same visual shell, "Image not found" + link back to `/`).
- If found, renders a standalone HTML page:
  - `<title>` and visible heading from `title`.
  - The full image (`<img>`), wrapped in `.char-image-wrap` (reusing existing CSS) — if `nsfw`, wrapped with the `nsfw-blur` class and the page loads `nsfw-reveal.js` to gate it behind the existing click-to-reveal warning, exactly like any other NSFW image on the site. This matters because a permalink can be opened directly by someone who never visited the gallery.
  - A "Copy Link" button — small inline module script (`gallery/permalink.js`) using `navigator.clipboard.writeText(location.href)`, with brief "Copied!" text feedback.
  - A link back to `/` ("Explore more →").
  - Same background/canvas treatment as other pages (`/background.js`, importmap for three.js) for visual consistency.
- **Meta tags:**
  - Always: `<title>`, `og:title`, `og:type=website`, `og:url`, `twitter:card=summary` (no image).
  - Only when `!nsfw`: adds `og:image`, `twitter:image`, and upgrades `twitter:card` to `summary_large_image`. NSFW images intentionally get **no** `og:image`/`twitter:image` — pasting an NSFW permalink into Discord/WhatsApp shows a bare text link, not an auto-displayed picture, avoiding accidental NSFW previews in non-NSFW channels/chats. The image is still viewable by clicking through (behind the reveal gate).
- **Headers:** sets `Content-Security-Policy` as a response header (equivalent policy to the meta-tag version used elsewhere: `default-src 'self'; script-src 'self' https://unpkg.com 'sha256-AhZyvNDdNRAqtFnGIp3LP8YpNDaE+qnvQ7qQk+5LG08='; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self';`) and `Content-Type: text/html; charset=utf-8`.
- GET only; any other method → 405.

---

## 3. Click-to-enlarge wiring (`shared/enlargeable.js`, new)

Exports `setupEnlargeableImages(root = document)`, following the same shape as `nsfw-reveal.js`. For each `.char-image-wrap img` under `root`:
- Skips if already wired (idempotency guard, same pattern as `setupNsfwReveal`).
- Computes `/i/${extractImageId(img.src)}`.
- Wraps the `<img>` in an `<a href="..." target="_blank" rel="noopener">` inside the existing `.char-image-wrap` — the NSFW warning overlay (`.nsfw-warning`, `position: absolute; inset: 0`) already sits on top and intercepts clicks while blurred, per the existing CSS/JS; once `.revealed` is added, the overlay's `display: none` lets the underlying link receive clicks normally. **No CSS changes needed** — the stacking already works for this.

Wired into:
- `gallery/character.js` (character detail pages) — alongside the existing `setupNsfwReveal()` call.
- `commissions/commissions.js` (past-work grid) — alongside its existing `setupNsfwReveal()` call.
- `gallery/gallery-index.js` (new, see below) — for the "other artwork" thumbnails only.

Tier example images and the homepage's rotating character-gallery/commissions-preview thumbnails are **not** made enlargeable — those are navigational previews (link to the character page / commissions page), not standalone content, consistent with today's behavior.

---

## 4. `/gallery` index page (`gallery/index.html` + `gallery/gallery-index.js`)

New static page, same shell pattern as `index.html`/`commissions/index.html` (canvas background, same CSP meta tag, back-link to `/`).

`gallery/gallery-index.js`:
- Fetches `/data/characters.json`.
- Empty state: same pattern as `script.js`'s `gallery-empty` handling if `characters` is empty.
- For each character, renders a card:
  - Icon: the character's thumbnail image (`images.find(i => i.thumbnail && !i.nsfw) || images.find(i => !i.nsfw)`, same selection logic already used in `script.js`).
  - Name (heading).
  - Bio preview: first line of `bio`, truncated to ~120 chars with an ellipsis if longer.
  - Up to 3 additional non-NSFW images (excluding the icon) as small thumbnails, each individually wrapped in `.char-image-wrap` and run through `setupEnlargeableImages`.
  - The icon + name + bio area is a link to `/gallery/<slug>/`; the extra-artwork thumbnails are separate enlarge links (not the card link) — clicking one opens its permalink, not the character page.
- Layout: reuse the existing card/grid visual language (`gallery-card`-style styling) rather than inventing a new visual pattern; new CSS only for the bio-preview text and the small thumbnail row within a card.

---

## Error handling

- `/i/<id>` for an unknown id → 404 HTML page, not a 500 or blank page.
- `/i/<id>` when `data/characters.json` or `data/commissions.json` fails to fetch/parse → 500 HTML page with a generic "data unavailable" message, consistent with the existing `catch` → `feed-error`-style messaging used elsewhere.
- `gallery/gallery-index.js` fetch failure → same `console.error` + empty-state-style fallback pattern already used in `script.js`.

## Security

- No new write surface — `/i/[id].js` is read-only (`onRequestGet` only), no auth needed (same as every other public page).
- CSP on the permalink page is at least as strict as existing pages (explicit header instead of meta tag, same allowlist).
- NSFW `og:image` suppression is a deliberate content-safety choice (see above), not an oversight.

## Testing

New `node:test` cases, no new test framework/dependency:
- `shared/image-id.js`: `extractImageId` against representative Cloudinary URLs (with/without query strings, `.png`/`.jpg`).
- `functions/i/[id].js`: `findImageById` — match in characters, match in pastWork, no match, and NSFW vs non-NSFW result shape.

Manual verification in-browser (dev server): enlarge flow from a character page and from commissions past work opens `/i/<id>` in a new tab with the correct image; NSFW images still gate behind the reveal-click on the permalink page itself; `/gallery` renders all current characters with bios and extra artwork; copy-link button copies the current URL.

## Out of scope

- Reordering or otherwise changing which images are "extra artwork" on `/gallery` beyond the simple selection rule above.
- A modal/lightbox overlay UI (explicitly rejected in favor of a real navigable permalink page, since Discord/WhatsApp embeds require server-rendered meta tags anyway, and a client-only modal wouldn't produce a shareable URL).
- Analytics/view counts on permalink pages.
- Tier-example images and homepage preview thumbnails becoming enlargeable.
