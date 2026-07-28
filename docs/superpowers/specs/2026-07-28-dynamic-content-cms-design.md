# Dynamic Content CMS — Design Spec

Date: 2026-07-28
Status: Approved, implementation in progress

## Goal

Replace hand-coded links in `script.js` with a self-service upload workflow, and
add a `/commissions` endpoint, without introducing manual editing, hard-coding,
or ongoing server maintenance. Secondary goal: character profiles should be
rich enough to work as a Toyhouse alternative (multiple images, bio, NSFW
flag), each with its own pretty URL.

## Non-goals

- No multi-editor/collaborator support — single admin (site owner) only.
- No draft/staging workflow — publishing from `/admin` goes live on the next
  deploy (~30–60s), there is no preview step.
- No real access control on NSFW images — the blur/reveal is a content
  warning, not a security boundary. The underlying image URL is always public.
- No framework/build tooling beyond one small Node generator script — the
  public site remains plain HTML/CSS/JS.

## Architecture

- **Hosting**: migrate from GitHub Pages to Cloudflare Pages, connected
  directly to this GitHub repo via Cloudflare's native git integration (push
  to `main` → Cloudflare builds and deploys). `.github/workflows/pages.yml` is
  removed; Cloudflare's build step replaces it.
- **Public site is 100% static** on the read path — no Function runs when a
  visitor loads a page. A build-time Node script
  (`scripts/generate-characters.js`) reads `data/characters.json` and emits
  one static page per character (`gallery/<slug>/index.html`) from
  `templates/character.html`, giving real pretty URLs
  (`vyphir.com/gallery/drasil`) with zero runtime cost per view.
- **`/admin` is the only dynamic, authenticated part of the site.** Cloudflare
  Access protects `/admin/*` and `/api/*` — the site owner authenticates via
  an email magic link before any request reaches the page or a Function.
- **Two Cloudflare Pages Functions** hold the real secrets server-side, never
  exposed to the browser:
  - `functions/api/publish-character.js`
  - `functions/api/publish-commissions.js`

  Both use a GitHub PAT (fine-grained, scoped to this repo only, Contents
  read/write permission only, ~90-day expiry) and a real Cloudinary API
  secret (signed uploads), stored as Cloudflare Pages encrypted secrets.
- **Data stays git-backed**: `data/characters.json` and `data/commissions.json`
  are the source of truth, edited only via the Functions' GitHub Contents API
  calls. A Function write is a normal commit, which triggers Cloudflare's
  normal rebuild.

## Security hardening (bundled into this work)

- Strict `Content-Security-Policy` meta tag on every page
  (`script-src 'self' <only the CDNs actually used>; object-src 'none';
  base-uri 'self'`).
- Subresource Integrity (`integrity="sha384-..."`) hashes on the `three.js`
  (unpkg) and Font Awesome (cdnjs) `<script>`/`<link>` tags.
- All rendering (existing gallery teaser, new character pages, commissions
  page) builds DOM nodes via `textContent`/`createElement`, never
  `innerHTML` with interpolated data — closes the same XSS shape already
  fixed once in the Bluesky feed (see `9b2a87f`), and applies it to the
  gallery renderer in `script.js:64`, which currently still uses `innerHTML +=`.
- Cloudinary uploads are signed (server-side secret), not an unsigned public
  preset — no exposed preset string to abuse.
- GitHub PAT is fine-grained, single-repo, Contents-only, time-limited —
  never stored in the browser, never committed to the repo.
- Cloudflare Access requires authentication before `/admin` or `/api/*` is
  reachable at all — no page is servable to an unauthenticated visitor.
- Uploaded images get randomized (not sequential/predictable) filenames in
  Cloudinary, reducing guessability of NSFW-flagged image URLs.

## Data schemas

`data/characters.json`:
```json
{
  "characters": [
    {
      "slug": "drasil",
      "name": "Drasil",
      "species": "",
      "bio": "",
      "images": [
        { "url": "https://res.cloudinary.com/.../drasil-1.webp", "nsfw": false }
      ]
    }
  ]
}
```

`data/commissions.json`:
```json
{
  "status": true,
  "intro": "",
  "specialOffer": "Currently PWYW (Pay What You Want)!",
  "tiers": [
    { "name": "Headshot", "price": "", "description": "", "example": "" }
  ],
  "pastWork": [
    { "url": "https://res.cloudinary.com/.../piece-1.webp", "caption": "" }
  ]
}
```

`specialOffer`, when set, renders above/instead of the tiers list on the
commissions page (used today for PWYW; tiers stay in the schema for when
priced tiers are reintroduced).

## Components

**Public (static):**
- `index.html` / `script.js` / `styles.css` — homepage; teaser gallery
  (client-fetches `data/characters.json`), new nav link to `/commissions`,
  CSP + SRI added, gallery renderer made DOM-safe.
- `gallery/<slug>/index.html` — generated per character at build time from
  `templates/character.html`; renders name, species, bio, image grid with
  NSFW blur/click-to-reveal via `gallery/character.js`.
- `commissions/index.html` + `commissions/commissions.js` — single static
  page, client-fetches `data/commissions.json`.

**Admin (behind Cloudflare Access):**
- `admin/index.html` + `admin/admin.js` — Characters panel (list + add/edit
  form: name, species, bio, multi-image upload with per-image NSFW
  checkbox) and Commissions panel (status, intro, special offer, tiers
  repeater, past-work upload). Confirm dialog before every publish.

**Functions:**
- `functions/api/publish-character.js`, `functions/api/publish-commissions.js`
  — validate input, upload images to Cloudinary (signed), read-modify-write
  the relevant JSON file via GitHub Contents API.

**Build:**
- `scripts/generate-characters.js` — Cloudflare Pages build command; reads
  `data/characters.json` + `templates/character.html`, emits
  `gallery/<slug>/index.html` per character. Handles slug generation
  (URL-safe, collision-checked).

## Data flow

**Publish (character or commissions):** admin form → client-side validation
(UX only) → POST to the relevant Function → Function re-validates (security
boundary) → Cloudinary signed upload(s) → GitHub Contents API GET (capture
`sha`) → merge edit → PUT (using that `sha`) → commit lands on `main` →
Cloudflare Pages rebuild (runs `generate-characters.js` for character
changes) → deploy live (~30–60s). Admin UI shows "Published — live shortly"
without waiting for the rebuild.

**View:** every public page is a plain static asset fetch or JSON fetch — no
Function, no auth, no per-request cost.

## Error handling

- GitHub write conflict (409, stale `sha`): Function retries once
  (re-fetch/reapply/PUT) before surfacing a "try again" error.
- Cloudinary upload failure: Function returns a specific error; admin UI
  shows it inline next to the offending image field.
- Expired/missing Cloudflare Access session: Function call rejected; admin UI
  prompts to refresh/re-login.
- Public page fetch failure: same graceful fallback pattern already used for
  the Bluesky feed ("data unavailable" message).
- Unknown character slug: pages are only generated for real entries, so a bad
  slug is a normal static 404 — no special handling needed.

## Testing

- Unit tests (Node's built-in test runner, no new dependency) for: slug
  generation in `generate-characters.js` (collisions, special characters,
  empty names) and request-validation logic in both Functions.
- Manual verification via `wrangler pages dev` locally: both admin forms
  against a test Cloudinary preset/GitHub branch, generated character pages,
  blur/reveal behavior, commissions rendering — before pointing production
  DNS at Cloudflare Pages.

## Cost

$0/month under normal personal-site usage. Every piece (Cloudflare Pages,
Pages Functions, Cloudflare Access, Cloudinary, GitHub) fits inside its free
tier at this scale; see conversation history for the specific limits. The
only realistic future cost is Cloudinary's bandwidth quota if site traffic
grows far beyond a personal directory's normal range.

## Manual steps required from the site owner (not automatable by an agent)

These require an authenticated human in each service's dashboard; the
implementation cannot create these accounts or credentials itself:

1. Create/confirm a Cloudflare account; connect this GitHub repo as a
   Cloudflare Pages project.
2. Move `vyphir.com` DNS to Cloudflare (or reconfigure the existing zone).
3. Create a Cloudflare Access application protecting `/admin/*` and
   `/api/*`, restricted to the owner's email.
4. Create a Cloudinary account; note the Cloud Name and generate an API
   key/secret for signed uploads (no unsigned preset needed).
5. Create a GitHub fine-grained PAT scoped to this repo only, Contents
   read/write permission only, with an expiry date.
6. Add the Cloudinary API secret and GitHub PAT as encrypted secrets on the
   Cloudflare Pages project.

A full step-by-step guide for these is delivered separately once
implementation is complete.
