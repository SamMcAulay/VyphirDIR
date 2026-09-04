# React/Vite SSG Foundation — Design Spec

**Status:** Approved, implementation pending

**Context:** This is sub-project 1 of a larger site overhaul (bright/bubbly "kandi-toony" reskin, Persona-style oversized navigation, physics-based gravity-drop page transitions). The full overhaul assumes a React + React Three Fiber + GSAP + Matter.js stack; the live site is currently plain HTML/CSS/vanilla JS with no bundler. This spec covers **only** the migration to a React-based build — getting every existing page rendering through React with zero visual change and zero functional regression. Design system, navigation, and the physics transition engine are separate specs that build on top of this one.

**Goal:** Introduce a Vite + React + React Router build pipeline, deployed on Cloudflare Pages, that renders every existing route through React components while preserving:
- The git-backed CMS flow (admin form → `POST /api/publish-*` Cloudflare Function → GitHub commit → Pages rebuild) untouched.
- Per-page baked OG/meta tags at build time (character pages, commissions page) — this site has already had a production Discord-embed-caching incident tied to this exact mechanism (2026-08-20), so regressing it is the single biggest risk in this migration.
- `/admin/` access control, which lives outside this repo (Cloudflare Access on that path) and needs no in-app auth code.
- All 110 existing `node --test` tests, adapted where they assert on generated-HTML output.

**Non-goal:** No new visuals, no design-system tokens, no navigation redesign, no transition engine. `styles.css` ships as-is, just now emitted by React components instead of string templates. This sub-project's only job is proving the new rendering pipeline is a safe, inert swap-in for the old one.

**Supersedes:** The current client-side router (`router.js` + `shared/route-table.js`, see [2026-08-07-cross-browser-page-flip-router-design.md](2026-08-07-cross-browser-page-flip-router-design.md)) is replaced by React Router, which takes over both initial static rendering (via `StaticRouter`) and in-app client-side navigation (via hydration). The existing View Transitions page-flip is out of scope here — it either continues to work incidentally or is explicitly turned off; the real replacement is the physics transition engine in a later sub-project.

---

## 1. Architecture

Vite drives the dev server and produces the client bundle. A build script, `scripts/render-pages.js`, renders every route to static HTML at build time using `ReactDOMServer.renderToString` wrapped in React Router's `StaticRouter`:

- **Static routes** (`/`, `/gallery/`, `/commissions/`, `/tos/`, `/queue/`, `/admin/`) — one render pass each.
- **Data-driven routes** (`/gallery/<slug>/`, one per character) — one render pass per entry in `data/characters.json`, replacing `generate-characters.js`'s template-string approach.
- Commission preview asset generation (image/gif processing via `sharp`/`gifenc` in `generate-commissions-preview.js`) is unaffected — that script doesn't emit page HTML, it emits an image asset consumed by the commissions page. It stays as its own script, run in the same `npm run build` sequence.

Each rendered page is wrapped in an HTML shell carrying that route's own `<title>`/OG meta (sourced from the page component's data, not a hardcoded per-file string) and a hydration `<script type="module">` entry point. Output goes to a `dist/` directory.

`ReactDOM.hydrateRoot` picks up each page client-side for interactivity. React Router owns in-app navigation after first load, so route changes become client-side transitions — this is the seam the physics transition engine (a later sub-project) will hook into.

`functions/` (all `/api/publish-*` Cloudflare Functions, `_shared/github.js`, `_shared/cloudinary.js`) ships completely unchanged — Cloudflare Pages natively serves static build output and `/functions` API routes from the same deploy, so nothing here needs to move or be rewritten.

## 2. Directory structure

```
src/
  pages/          # one component per route: Landing, Social(*), Commissions,
                   # Gallery, GalleryCharacter, Tos, Queue, Admin
  components/      # shared pieces currently duplicated inline per page:
                   # nav shell, Bluesky feed widget, form fields, gallery cards
  lib/             # existing shared/*.js utilities, moved near-verbatim
                   # (slugify, format-date, escape-html, image-id) — pure,
                   # framework-agnostic, no rewrite needed
scripts/
  render-pages.js  # new: SSG build step (see above)
  generate-commissions-preview.js  # unchanged: still emits the preview image asset
data/              # unchanged: characters.json, commissions.json, queue.json, tos.json
functions/         # unchanged: all CMS API endpoints
```

`(*)` The landing page currently *is* "Social Links" — profile + link grid + character/commission previews all on `/`. This spec keeps that structure; if a later sub-project wants Social Links split into its own route, that's a page-composition change, not a foundation change.

`shared/*.js` files are deleted from their current location once their logic lives in `src/lib/`; nothing keeps both copies live to avoid drift.

## 3. Data flow

Unchanged at the CMS boundary:

```
Admin form (React component now, same fields)
  -> POST /api/publish-character (or -commissions/-tos/-queue)
  -> Function validates, uploads images via Cloudinary, commits data/*.json to GitHub
  -> GitHub push triggers Cloudflare Pages rebuild
  -> npm run build: vite build (client bundle) + render-pages.js (SSG) + generate-commissions-preview.js
  -> New/updated static pages deployed
```

The only thing that changes is *what* renders the HTML (React components via `render-pages.js` instead of `template.replace()` string interpolation in the old `generate-characters.js`) — the trigger chain, the data shape, and the Function code are identical to today.

## 4. Testing

- Pure-function tests (`slugify`, `format-date`, `escape-html`, `image-id`, `route-table` equivalents) need no behavioral changes since the utilities move to `src/lib/` largely as-is — only import paths change.
- `generate-characters.test.js` and `generate-commissions-preview.test.js` are rewritten against `render-pages.js`'s output: same assertions (does `dist/gallery/<slug>/index.html` exist, does it contain the expected name/species/bio/images), different implementation under test.
- `head-parity.test.js` (checks OG/meta tag consistency across generated pages) is the most important test to get right here — it's the regression guard for the exact class of bug already hit in production. Extended to run against every SSG-rendered route, not just character pages.
- `redirects-module-paths.test.js` updated for the new `src/` layout; `_redirects` rules themselves are unaffected (they redirect docs/scripts/config paths, none of which move in a way that changes their matching).
- `publish-*.test.js` (Function-level tests) need no changes — the Functions aren't touched by this migration.
- All tests continue running via `node --test`; no test-runner change.

## 5. Deployment changes

- `wrangler.toml`: `pages_build_output_dir` changes from `"."` to `"dist"`.
- `package.json`: `build` script becomes `vite build && node scripts/render-pages.js && node scripts/generate-commissions-preview.js`. New deps: `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`.
- CSP (`meta http-equiv="Content-Security-Policy"` per page) is regenerated per-page by the same mechanism as today's OG tags — no new external script/style hosts are introduced by this sub-project, so the existing allowlist (`'self'`, `unpkg.com` for the three.js import map, Google Fonts, Font Awesome via cdnjs) carries forward unchanged.

## 6. Rollout / parity checkpoint

This sub-project is done when, verified manually and via tests:

- Every existing route (`/`, `/gallery/`, `/gallery/<slug>/` for every published character, `/commissions/`, `/tos/`, `/queue/`, `/admin/`) renders its current content, forms, and links with **zero visual change** — same `styles.css`, same DOM structure closely enough that nothing looks or behaves differently to a visitor.
- All `POST /api/publish-*` flows still work end-to-end through the (now-React) admin forms: add character, edit commissions info, add past-work entry, edit TOS, edit queue card.
- All tests pass (`node --test`).
- Discord/Twitter link unfurls on a character page and the commissions page are manually re-verified unchanged (the specific incident class from 2026-08-20).
- The starfield background (`background.js`, currently outside `.datapad-screen`, driven by the existing three.js import map) still renders on every page — this sub-project doesn't touch it, just needs to confirm it survives the hydration boundary.

## Out of scope

- Design system (Pink/Sand/Blue tokens, bubble typography, kandi accents) — next sub-project.
- Persona-style navigation and its mobile fallback — later sub-project.
- Physics-based gravity-drop transition engine (React Three Fiber, GSAP, Matter.js) — later sub-project. React Router's client-side navigation (added in this spec) is the seam it will attach to, but no transition logic ships here.
- Astro or any other meta-framework — deliberately not adopted; see the approaches discussion (custom SSG script chosen over `vite-react-ssg` or Astro to minimize new dependency surface and stay close to this repo's existing hand-rolled-script style).
- Any change to `/admin/` access control — it's gated by Cloudflare Access outside this repo and isn't touched.
