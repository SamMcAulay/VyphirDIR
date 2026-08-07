# Cross-Browser Page-Flip Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing 3D page-flip transition (built for the native cross-document View Transitions API, which only Chromium/Safari 18.2+ support) also work in Firefox, by adding a small client-side router that drives the same-document View Transitions API for every browser instead.

**Architecture:** A new `router.js` intercepts clicks on internal links matching 4 known page patterns (home, gallery index, character page, commissions), fetches the target page's HTML, swaps `.datapad-screen`'s content inside `document.startViewTransition()`, and calls that page's `init()`. The 4 existing per-page scripts (`script.js`, `gallery-index.js`, `commissions.js`, `character.js`) are refactored from "run immediately on module load" to "export an `init()` function the router calls explicitly" — necessary because dynamic `import()` of an already-loaded module URL returns the cached module without re-running its top-level code, so relying on module-load side effects would mean a page's dynamic content only ever populates once per session.

**Tech Stack:** Vanilla JS (ES modules), no new dependencies. `node --test` for the one pure-logic unit (route matching). Playwright (already installed locally under `~/.cache/ms-playwright/`, both `chromium` and `firefox`) for manual cross-browser verification, since the fetch/swap/transition behavior itself isn't unit-testable in this Node-based suite.

## Global Constraints

- No new npm dependency — hand-rolled router only (per approved spec, Approach A).
- No visual change in any settled (non-mid-navigation) state — same colors, layout, hover effects, content.
- Router only ever intercepts same-origin, non-modified, non-`target`, non-`download` clicks whose path matches one of exactly 4 patterns: `/`, `/gallery/`, `/gallery/<slug>/`, `/commissions/`. Everything else (`/admin/`, `/i/<id>`, external links) is left to normal browser navigation, untouched by this feature.
- `/admin/` keeps its own separate script (`admin/admin.js`) and stricter CSP — not touched by any task in this plan.
- Any failure (fetch error, non-2xx, missing `.datapad-screen`/`.datapad-wrapper` in the response) falls back to a real `location.href` navigation rather than showing a broken swap.
- `prefers-reduced-motion` must keep working with zero new code — it already neutralizes `::view-transition-*` animations via existing CSS, and this plan reuses those same pseudo-elements/rules unchanged.
- Character pages (`gallery/<slug>/index.html`) are generated output — never hand-edit them; edit `templates/character.html` and regenerate via `npm run build`.

---

### Task 1: Pure route-matching logic

**Files:**
- Create: `shared/route-table.js`
- Test: `tests/route-table.test.js`

**Interfaces:**
- Produces: `matchRoute(pathname: string): { module: string } | null` — every later task (router.js, and its own tests) calls this exact function with this exact signature.

- [ ] **Step 1: Write the failing test**

Create `tests/route-table.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute } from '../shared/route-table.js';

test('matchRoute matches the home page', () => {
    assert.deepEqual(matchRoute('/'), { module: '/script.js' });
});

test('matchRoute matches the gallery index', () => {
    assert.deepEqual(matchRoute('/gallery/'), { module: '/gallery/gallery-index.js' });
});

test('matchRoute matches a character page', () => {
    assert.deepEqual(matchRoute('/gallery/vyphir/'), { module: '/gallery/character.js' });
    assert.deepEqual(matchRoute('/gallery/sir-reginald-fluffington/'), { module: '/gallery/character.js' });
});

test('matchRoute matches the commissions page', () => {
    assert.deepEqual(matchRoute('/commissions/'), { module: '/commissions/commissions.js' });
});

test('matchRoute rejects the admin area', () => {
    assert.equal(matchRoute('/admin/'), null);
    assert.equal(matchRoute('/admin/index.html'), null);
});

test('matchRoute rejects permalink pages', () => {
    assert.equal(matchRoute('/i/abc123'), null);
});

test('matchRoute rejects paths missing a trailing slash', () => {
    assert.equal(matchRoute('/gallery'), null);
    assert.equal(matchRoute('/gallery/vyphir'), null);
    assert.equal(matchRoute('/commissions'), null);
});

test('matchRoute rejects an empty character slug', () => {
    assert.equal(matchRoute('/gallery//'), null);
});

test('matchRoute rejects unknown paths', () => {
    assert.equal(matchRoute('/nonexistent/'), null);
    assert.equal(matchRoute(''), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/route-table.test.js`
Expected: FAIL — `Cannot find module '../shared/route-table.js'`

- [ ] **Step 3: Write the implementation**

Create `shared/route-table.js`:

```js
const ROUTES = [
    { pattern: /^\/$/, module: '/script.js' },
    { pattern: /^\/gallery\/$/, module: '/gallery/gallery-index.js' },
    { pattern: /^\/commissions\/$/, module: '/commissions/commissions.js' },
    { pattern: /^\/gallery\/[^/]+\/$/, module: '/gallery/character.js' },
];

export function matchRoute(pathname) {
    const route = ROUTES.find(({ pattern }) => pattern.test(pathname));
    return route ? { module: route.module } : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/route-table.test.js`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add shared/route-table.js tests/route-table.test.js
git commit -m "feat: add pure route-matching logic for the page-flip router"
```

---

### Task 2: The router engine

**Files:**
- Create: `router.js` (project root, sibling to `script.js` and `background.js`)

**Interfaces:**
- Consumes: `matchRoute(pathname)` from `shared/route-table.js` (Task 1) — returns `{ module: string } | null`.
- Consumes (by convention, from Tasks 3-6): every module named in the route table exports an optional `init(): void` and an optional `cleanup(): void`. Neither is required to exist — the router calls them defensively with `typeof mod.init === 'function'` guards, so this task can be written and committed before any page script is migrated, without breaking anything (nothing loads `router.js` yet until Task 3+ wires it into an HTML page).
- Produces: nothing consumed elsewhere — this is the top-level entry point wired in via a `<script type="module" src="/router.js">` tag in Tasks 3-6.

This task has no automated test (it's DOM/browser/fetch-driven glue code with nothing pure to unit-test in the Node suite — that's covered by the spec's testing section and verified end-to-end in Task 8). Use `node --check` as a syntax sanity check only.

- [ ] **Step 1: Write `router.js`**

Create `/home/sam/Documents/VyphirDIR/router.js`:

```js
import { matchRoute } from './shared/route-table.js';
import './background.js';

let activeModulePath = null;
let navToken = 0;

function currentPanel() {
    return document.querySelector('.datapad-screen');
}

function currentWrapper() {
    return document.querySelector('.datapad-wrapper');
}

async function runInit(modulePath) {
    const mod = await import(modulePath);
    if (typeof mod.init === 'function') {
        mod.init();
    }
    activeModulePath = modulePath;
}

async function runCleanup() {
    if (!activeModulePath) return;
    const mod = await import(activeModulePath);
    if (typeof mod.cleanup === 'function') {
        mod.cleanup();
    }
}

async function navigate(url, route, { push }) {
    const token = ++navToken;
    let html;

    try {
        const response = await fetch(url.pathname);
        if (!response.ok) throw new Error(`bad status ${response.status}`);
        html = await response.text();
    } catch (error) {
        console.error('router: fetch failed, falling back to a real navigation', error);
        window.location.href = url.href;
        return;
    }

    if (token !== navToken) return; // a newer navigation has since started; discard this one

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newPanel = doc.querySelector('.datapad-screen');
    const newWrapper = doc.querySelector('.datapad-wrapper');
    const panel = currentPanel();
    const wrapper = currentWrapper();

    if (!newPanel || !newWrapper || !panel || !wrapper) {
        window.location.href = url.href;
        return;
    }

    if (push) {
        history.pushState({}, '', url.pathname);
    }

    const applySwap = async () => {
        await runCleanup();
        wrapper.className = newWrapper.className;
        panel.innerHTML = newPanel.innerHTML;
        document.title = doc.title;
        window.scrollTo(0, 0);
        await runInit(route.module);
    };

    if (document.startViewTransition) {
        await document.startViewTransition(applySwap).finished;
    } else {
        await applySwap();
    }
}

function matchRoutableClick(event) {
    if (event.defaultPrevented || event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

    const link = event.target.closest('a');
    if (!link || link.target || link.hasAttribute('download')) return null;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return null;

    const route = matchRoute(url.pathname);
    if (!route) return null;

    return { url, route };
}

document.addEventListener('click', (event) => {
    const match = matchRoutableClick(event);
    if (!match) return;

    const { url, route } = match;
    event.preventDefault();

    if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return; // already on this page, do nothing
    }

    navigate(url, route, { push: true });
});

window.addEventListener('popstate', () => {
    const route = matchRoute(window.location.pathname);
    if (!route) return;
    navigate(new URL(window.location.href), route, { push: false });
});

const initialRoute = matchRoute(window.location.pathname);
if (initialRoute) {
    runInit(initialRoute.module);
}
```

- [ ] **Step 2: Syntax-check it**

Run: `node --check router.js`
Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add router.js
git commit -m "feat: add client-side router driving same-document View Transitions"
```

---

### Task 3: Migrate the home page (`script.js` + `index.html`)

**Files:**
- Modify: `script.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `script.js` exports `init(): void` and `cleanup(): void`, matching the convention Task 2's router already calls defensively.

- [ ] **Step 1: Refactor `script.js` to export `init`/`cleanup` instead of running at module load**

Replace the entire contents of `script.js` with:

```js
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

let autoScrollCleanup = null;

function setupAutoScroll(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let autoScrollInterval;
    const scrollStep = 155;
    const delay = 2500;

    const startScroll = () => {
        autoScrollInterval = setInterval(() => {
            if (Math.ceil(container.scrollLeft + container.clientWidth) >= container.scrollWidth) {
                container.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                container.scrollBy({ left: scrollStep, behavior: 'smooth' });
            }
        }, delay);
    };

    const stopScroll = () => clearInterval(autoScrollInterval);

    startScroll();

    container.addEventListener('mouseenter', stopScroll);
    container.addEventListener('mouseleave', startScroll);
    container.addEventListener('touchstart', stopScroll, {passive: true});
    container.addEventListener('touchend', startScroll, {passive: true});

    autoScrollCleanup = () => {
        stopScroll();
        container.removeEventListener('mouseenter', stopScroll);
        container.removeEventListener('mouseleave', startScroll);
        container.removeEventListener('touchstart', stopScroll);
        container.removeEventListener('touchend', startScroll);
    };
}

async function loadCharacterGallery() {
    const galleryDiv = document.getElementById('character-gallery');
    if (!galleryDiv) return;

    try {
        const response = await fetch('/data/characters.json');
        const data = await response.json();
        const characters = data.characters || [];

        if (characters.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'gallery-empty';
            empty.textContent = '> NO CHARACTERS ARCHIVED YET';
            galleryDiv.appendChild(empty);
            return;
        }

        shuffleArray(characters);

        characters.forEach((char) => {
            const images = char.images || [];
            const firstImage = images.find((img) => img.thumbnail && !img.nsfw) || images.find((img) => !img.nsfw);
            if (!firstImage) return;

            const card = document.createElement('a');
            card.className = 'gallery-card';
            card.href = `/gallery/${char.slug}/`;

            const img = document.createElement('img');
            img.src = firstImage.url;
            img.alt = char.name;
            img.loading = 'lazy';

            const caption = document.createElement('p');
            caption.textContent = char.name;

            card.append(img, caption);
            galleryDiv.appendChild(card);
        });

        setupAutoScroll('character-gallery');
    } catch (error) {
        console.error(error);
    }
}

async function loadCommissionsPreview() {
    const container = document.getElementById('commissions-preview');
    if (!container) return;

    try {
        const response = await fetch('/data/commissions.json');
        const data = await response.json();
        const recentPastWork = (data.pastWork || []).filter((item) => !item.nsfw).slice(-3).reverse();

        if (recentPastWork.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'gallery-empty';
            empty.textContent = '> NO PAST WORK YET';
            container.appendChild(empty);
            return;
        }

        recentPastWork.forEach((item) => {
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = item.caption || '';
            img.loading = 'lazy';
            container.appendChild(img);
        });
    } catch (error) {
        console.error(error);
    }
}

const bskyHandle = 'samisaderp.bsky.social';

async function loadBlueskyFeed() {
    const feedContainer = document.getElementById('bsky-feed');
    if (!feedContainer) return;

    try {
        const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${bskyHandle}&limit=3`);
        const data = await response.json();

        feedContainer.innerHTML = '';

        data.feed.forEach(item => {
            const post = item.post?.record;
            if (!post) return;
            const date = new Date(post.createdAt).toLocaleDateString();

            const entry = document.createElement('div');
            entry.className = 'feed-entry';

            const header = document.createElement('div');
            header.className = 'feed-entry-header';

            const handle = document.createElement('span');
            handle.className = 'feed-handle';
            handle.textContent = `@${bskyHandle}`;

            const dateSpan = document.createElement('span');
            dateSpan.className = 'feed-date';
            dateSpan.textContent = date;

            header.append(handle, dateSpan);

            const text = document.createElement('p');
            text.className = 'feed-text';
            text.textContent = post.text;

            entry.append(header, text);
            feedContainer.appendChild(entry);
        });

    } catch (error) {
        console.error(error);
        const errorMsg = document.createElement('p');
        errorMsg.className = 'feed-error';
        errorMsg.textContent = '> UPLINK FAILED.';
        feedContainer.innerHTML = '';
        feedContainer.appendChild(errorMsg);
    }
}

export function init() {
    autoScrollCleanup = null;
    loadCharacterGallery();
    loadCommissionsPreview();
    loadBlueskyFeed();
}

export function cleanup() {
    if (autoScrollCleanup) {
        autoScrollCleanup();
        autoScrollCleanup = null;
    }
}
```

This removes the old `import './background.js';` (now owned by `router.js`) and the three bare top-level calls (`loadCharacterGallery(); loadCommissionsPreview(); loadBlueskyFeed();`), replacing them with the exported `init`/`cleanup`. `setupAutoScroll` now records a teardown closure into the module-scoped `autoScrollCleanup`, so repeated home-page visits via the router don't leak a `setInterval` bound to a detached carousel element.

- [ ] **Step 2: Syntax-check it**

Run: `node --check script.js`
Expected: no output (success)

- [ ] **Step 3: Point `index.html` at the router**

In `index.html`, replace:

```html
    <script type="module" src="script.js"></script>
```

with:

```html
    <script type="module" src="/router.js"></script>
```

- [ ] **Step 4: Commit**

```bash
git add script.js index.html
git commit -m "feat: migrate home page to the client-side router"
```

---

### Task 4: Migrate the gallery index (`gallery-index.js` + `gallery/index.html`)

**Files:**
- Modify: `gallery/gallery-index.js`
- Modify: `gallery/index.html`

**Interfaces:**
- Produces: `gallery/gallery-index.js` exports `init(): void`.

- [ ] **Step 1: Replace the bottom of `gallery/gallery-index.js`**

Replace this line (currently the last line of the file):

```js
document.addEventListener('DOMContentLoaded', loadGalleryIndex);
```

with:

```js
export function init() {
    loadGalleryIndex();
}
```

- [ ] **Step 2: Syntax-check it**

Run: `node --check gallery/gallery-index.js`
Expected: no output (success)

- [ ] **Step 3: Point `gallery/index.html` at the router**

In `gallery/index.html`, remove this line from `<head>`:

```html
    <script type="module" src="/background.js"></script>
```

and replace this line (currently just before `</body>`):

```html
    <script type="module" src="/gallery/gallery-index.js"></script>
```

with:

```html
    <script type="module" src="/router.js"></script>
```

- [ ] **Step 4: Commit**

```bash
git add gallery/gallery-index.js gallery/index.html
git commit -m "feat: migrate gallery index page to the client-side router"
```

---

### Task 5: Migrate character pages (`character.js` + `templates/character.html` + regenerate)

**Files:**
- Modify: `gallery/character.js`
- Modify: `templates/character.html`
- Generated (via `npm run build`): `gallery/blair/index.html`, `gallery/drasil/index.html`, `gallery/faeyren/index.html`, `gallery/gritchin/index.html`, `gallery/pharron/index.html`, `gallery/vyphir/index.html`, `gallery/zephyr/index.html`

**Interfaces:**
- Produces: `gallery/character.js` exports `init(): void`.

- [ ] **Step 1: Replace the bottom of `gallery/character.js`**

Replace:

```js
document.addEventListener('DOMContentLoaded', () => {
    setupEnlargeableImages();
    setupNsfwReveal();
});
```

with:

```js
export function init() {
    setupEnlargeableImages();
    setupNsfwReveal();
}
```

- [ ] **Step 2: Syntax-check it**

Run: `node --check gallery/character.js`
Expected: no output (success)

- [ ] **Step 3: Point `templates/character.html` at the router**

In `templates/character.html`, remove this line from `<head>`:

```html
    <script type="module" src="/background.js"></script>
```

and replace this line (currently just before `</body>`):

```html
    <script type="module" src="/gallery/character.js"></script>
```

with:

```html
    <script type="module" src="/router.js"></script>
```

- [ ] **Step 4: Regenerate the static character pages**

Run: `npm run build`
Expected output: `Generated 7 character page(s): vyphir, pharron, gritchin, faeyren, drasil, blair, zephyr` (order may vary — matches `data/characters.json`)

- [ ] **Step 5: Confirm only the script tags changed in the generated output**

Run: `git diff --stat gallery/*/index.html`
Expected: 7 files changed, each with a small number of insertions/deletions (the two script-tag lines) — no other content should differ. Spot-check one with `git diff gallery/vyphir/index.html` and confirm the diff is limited to the `<script>` lines.

- [ ] **Step 6: Commit**

```bash
git add gallery/character.js templates/character.html gallery/*/index.html
git commit -m "feat: migrate character pages to the client-side router"
```

---

### Task 6: Migrate the commissions page (`commissions.js` + `commissions/index.html`)

**Files:**
- Modify: `commissions/commissions.js`
- Modify: `commissions/index.html`

**Interfaces:**
- Produces: `commissions/commissions.js` exports `init(): void`.

- [ ] **Step 1: Replace the bottom of `commissions/commissions.js`**

Replace this line (currently the last line of the file):

```js
document.addEventListener('DOMContentLoaded', loadCommissions);
```

with:

```js
export function init() {
    loadCommissions();
}
```

- [ ] **Step 2: Syntax-check it**

Run: `node --check commissions/commissions.js`
Expected: no output (success)

- [ ] **Step 3: Point `commissions/index.html` at the router**

In `commissions/index.html`, remove this line from `<head>`:

```html
    <script type="module" src="/background.js"></script>
```

and replace this line (currently just before `</body>`):

```html
    <script type="module" src="/commissions/commissions.js"></script>
```

with:

```html
    <script type="module" src="/router.js"></script>
```

- [ ] **Step 4: Commit**

```bash
git add commissions/commissions.js commissions/index.html
git commit -m "feat: migrate commissions page to the client-side router"
```

---

### Task 7: Fix redirect-shadow test coverage for dynamically-imported modules

**Context:** `tests/redirects-module-paths.test.js` scans every `.html` file for `<script type="module" src="...">` tags to find entry-point modules, then follows their *static* `import ... from '...'` statements to build the full set of browser-reachable modules, checking none of them are shadowed by a `_redirects` rule. It already has one manual exception for this exact reason — `functions/i/[id].js` server-renders a page that isn't a static `.html` file, so the scanner adds `/gallery/permalink.js` to the entry list by hand with an explanatory comment.

After Tasks 3-6, every page's `<script type="module">` tag points at `/router.js`, and `router.js` reaches `/script.js`, `/gallery/gallery-index.js`, `/gallery/character.js`, and `/commissions/commissions.js` only via *dynamic* `import(route.module)` calls with a variable argument — which the static-import regex in this test cannot and will never see. Without this fix, those 4 files would silently drop out of the test's coverage.

**Files:**
- Modify: `tests/redirects-module-paths.test.js`

- [ ] **Step 1: Add the 4 dynamically-imported modules to `findEntryModules()`**

In `tests/redirects-module-paths.test.js`, find:

```js
    // functions/i/[id].js server-renders a page (not a static .html file, so the
    // scan above can't see it) that loads this module — add it explicitly.
    entries.add('/gallery/permalink.js');
    return [...entries];
```

Replace with:

```js
    // functions/i/[id].js server-renders a page (not a static .html file, so the
    // scan above can't see it) that loads this module — add it explicitly.
    entries.add('/gallery/permalink.js');
    // router.js reaches these via dynamic import(route.module) with a variable
    // argument, which this regex-based static scan can't follow — add them explicitly.
    entries.add('/script.js');
    entries.add('/gallery/gallery-index.js');
    entries.add('/gallery/character.js');
    entries.add('/commissions/commissions.js');
    return [...entries];
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including `no browser-loaded module path is shadowed by a _redirects rule`

- [ ] **Step 3: Commit**

```bash
git add tests/redirects-module-paths.test.js
git commit -m "test: cover dynamically-imported router modules in the redirect-shadow check"
```

---

### Task 8: Cross-browser verification

**Context:** This is the acceptance pass for the whole feature. Nothing here is unit-testable in the Node suite (per the spec) — it's verified visually and behaviorally with Playwright against a local static server, in both Chromium and Firefox, the same way the hover-effect fixes earlier in this project were verified.

**Files:** none (verification only — no production code changes expected; if something fails, go fix the relevant task above and re-run this one)

- [ ] **Step 1: Serve the site locally**

Run (from the project root, in the background):

```bash
python3 -m http.server 8991
```

- [ ] **Step 2: Verify client-side navigation flips and re-populates dynamic content in Chromium**

Write and run a Playwright script (Chromium) that:
1. Navigates to `http://localhost:8991/`.
2. Confirms `document.querySelector('#character-gallery').children.length > 0` (home page's dynamic character carousel populated).
3. Clicks the "View All Characters" link (`.commissions-cta[href="/gallery/"]` — or whichever selector matches; inspect the rendered DOM first), waits, and confirms the URL is now `/gallery/` via `page.url()` **without a full page reload** (e.g., set `window.__markerHome = true` before navigating and confirm it's still `true` after — a real navigation would reset it, a router-driven swap wouldn't since it never reloads the document).
4. Confirms the gallery index grid populated: `document.querySelector('#gallery-index').children.length > 0`.
5. Clicks a character card, confirms the URL matches `/gallery/<slug>/` and the character's name/bio rendered.
6. Clicks "Back to directory", confirms it lands back on `/`.
7. Repeats step 2's carousel check — confirms the carousel repopulated on this *second* visit to `/` (this is the specific regression the `init`/module-caching refactor exists to prevent).

Expected: every check passes; no console errors logged during any of the navigations.

- [ ] **Step 3: Repeat Step 2 in Firefox**

Same script, `firefox.launch()` instead of `chromium.launch()` (both already installed locally under `~/.cache/ms-playwright/` from earlier work this session).

Expected: identical results to Chromium. Additionally, capture a short video (`recordVideo` context option) of one navigation and extract frames to confirm the panel visibly flips edge-on — Firefox previously did a flat instant jump with no animation; this is the actual fix this whole plan exists to deliver.

- [ ] **Step 4: Verify back/forward**

In either browser: navigate `/` → `/gallery/` → `/gallery/<slug>/`, then call `page.goBack()` twice. Confirm each `goBack()` lands on the expected prior URL with the expected content re-rendered (not a blank or stale panel).

- [ ] **Step 5: Verify the fetch-failure fallback**

Using Playwright's `page.route()`, intercept and fail (`route.abort()`) the fetch to `/gallery/` specifically, then click a link to `/gallery/`. Confirm the page falls back to a real navigation (URL still ends up at `/gallery/`, content still renders) rather than showing a broken/blank panel.

- [ ] **Step 6: Verify `prefers-reduced-motion`**

Launch a context with `reducedMotion: 'reduce'` (Playwright context option), perform a router-driven navigation, and confirm it completes (content swaps) without erroring — the existing CSS media query already strips the animation, so this just confirms the JS path doesn't assume the animation runs.

- [ ] **Step 7: Full regression pass**

Run: `npm test`
Expected: all tests pass (unchanged from Task 7, just confirming nothing else broke).

Manually re-check the hover states from the previous page-flip spec (buttons, cards) still look correct in both browsers — this plan didn't touch `styles.css`, but worth a quick visual confirmation given how much has changed underneath them.

- [ ] **Step 8: Clean up and report**

Kill the local server (`kill %1` or equivalent). No commit needed for this task unless verification surfaced a bug that was fixed in an earlier task — in that case, that fix's commit already happened as part of re-running that task.
