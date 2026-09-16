# Inner Page Layouts and Site Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the centred `Panel` on every inner page with full-width, mobile-first layouts under a persistent bead-ribbon site bar that stays still while navigating between inner pages.

**Architecture:** A React Router layout route (`SiteLayout`) wraps Gallery, Commissions, Queue, Terms of Service and the character pages, rendering `SiteBar` above a `main.site-page`. The gravity-drop transition picks its starting element from a pure `transitionScope(from, to)`, so only page content falls between inner pages. Each page is rewritten as a presentational component (tested with SSR fixtures) behind its existing fetch wrapper, with new pure helpers for the queue, the Terms split, cover-image selection and strip scrolling.

**Tech Stack:** React 19, React Router 7 (`StaticRouter` on the server, `BrowserRouter` on the client), Vite SSG, plain CSS in `public/styles.css`, Node's built-in test runner with `renderToStaticMarkup` and `react-test-renderer`.

**Spec:** `docs/superpowers/specs/2026-09-15-page-layouts-design.md`

## Global Constraints

- No `style={…}` props, no `style="…"` in markup, no `setAttribute('style', …)`. The CSP drops inline style attributes silently. Dynamic state reaches the DOM only as class names or ARIA attributes.
- No new npm dependencies.
- Do not change the hub's appearance (`src/pages/Landing.jsx` markup and `.hub*` CSS), Admin, `functions/`, `data/`, or `scripts/render-pages.js`.
- Keep these CSS rules, because `functions/i/[id].js` renders the `/i/<id>` page with them: `.back-link`, `.feed-error`, `.datapad-wrapper`, `.datapad-screen`, `.char-image-wrap` (and its `img`, `:hover`, `.nsfw-blur` variants), `.nsfw-warning`, `.enlarge-link`, `.permalink-*`.
- Breakpoints: phone `max-width: 599px`, tablet `600px–899px` (`max-width: 899px` applied before the phone block), desktop `900px` and up.
- Content column max width `1280px`, centred.
- Every text/fill pairing must reach 4.5:1 contrast (enforced by `tests/contrast-tokens.test.js` from Task 2).
- Motion: every new animation or transition is disabled under `@media (prefers-reduced-motion: reduce)`.
- Run one test file with `node --test --import ./tests/jsx-loader.mjs tests/<name>.test.js`. Run everything with `npm test` (it builds first, about a minute).
- Commit messages: lowercase conventional prefix (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `style:`), ending with the line `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Work on a branch named `page-layouts`, not on `main`.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/site/sections.js` | create | The four bar sections; `sectionForPath`, `usesSiteLayout`, `sectionByKey` |
| `src/site/photo.js` | create | The profile photo URL shared by the hub and the bar |
| `src/site/SiteBar.jsx` | create | The bead-ribbon bar |
| `src/site/SiteLayout.jsx` | create | Bar + `main.site-page` + outlet/children |
| `src/components/cx.js` | create | Class-name joiner |
| `src/components/cover-image.js` | create | Pick a character's cover image |
| `src/components/messages.js` | create | Shared load-error copy |
| `src/components/strip-index.js` | create | Pure nearest-item maths for the tier strip |
| `src/hooks/useScrollStrip.js` | create | Overflow, active dot and nudge state for the tier strip |
| `src/components/queue-entries.js` | create | Pure queue grouping and ordering |
| `src/components/split-tos.js` | create | Pure split of yes/no bullets out of Terms points |
| `src/components/first-visible.js` | create | Pure pick of the topmost visible Terms point |
| `src/hooks/useCurrentSection.js` | create | IntersectionObserver wrapper for the Terms index |
| `src/transitions/scope.js` | create | `transitionScope(from, to)` |
| `src/transitions/collect-pieces.js` | modify | `pageRoot(scope)` |
| `src/transitions/PageTransitions.jsx` | modify | Use the scope for fall and settle |
| `src/routes.js` | modify | `siteLayout: true` flags |
| `src/App.jsx` | modify | Layout route |
| `src/entry-server.jsx` | modify | `renderCharacter` inside `SiteLayout` |
| `src/pages/Landing.jsx` | modify | Import `PHOTO_URL` from `src/site/photo.js` (no markup change) |
| `src/pages/Gallery.jsx`, `GalleryCharacter.jsx`, `Commissions.jsx`, `Queue.jsx`, `Tos.jsx` | modify | New page shells |
| `src/components/GalleryIndexGrid.jsx`, `CommissionTierList.jsx`, `PastWorkGrid.jsx`, `QueueBoard.jsx`, `TosPointList.jsx` | modify | New layouts; each exports a presentational component |
| `src/components/Panel.jsx`, `src/components/LinkButton.jsx`, `tests/panel.test.js` | delete | No users left |
| `public/styles.css` | modify | Tokens, new sections, dead-rule removal |

---

### Task 1: Section table

**Files:**
- Create: `src/site/sections.js`
- Test: `tests/site-sections.test.js`

**Interfaces:**
- Consumes: `normalizePath(pathname)` from `src/transitions/paths.js` (returns the path with exactly one trailing slash).
- Produces:
  - `SECTIONS: Array<{ key: 'gallery'|'commissions'|'queue'|'tos', label: string, shortLabel: string, name: string, href: string, colour: 'teal'|'honey'|'tabby'|'lavender', blob: 1|2|3|4 }>`
  - `sectionForPath(pathname: string): string | null`
  - `usesSiteLayout(pathname: string): boolean`
  - `sectionByKey(key: string | null): Section | null`

- [ ] **Step 1: Write the failing test**

Create `tests/site-sections.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, sectionForPath, usesSiteLayout, sectionByKey } from '../src/site/sections.js';

test('lists the four sections in bar order with their colours and blobs', () => {
    assert.deepEqual(
        SECTIONS.map((s) => [s.key, s.href, s.colour, s.blob]),
        [
            ['gallery', '/gallery/', 'teal', 1],
            ['commissions', '/commissions/', 'honey', 3],
            ['queue', '/queue/', 'tabby', 2],
            ['tos', '/tos/', 'lavender', 4],
        ]
    );
});

test('carries a visible label, a phone label and an accessible name', () => {
    const commissions = sectionByKey('commissions');
    assert.equal(commissions.label, 'Commissions');
    assert.equal(commissions.shortLabel, 'Comms');
    assert.equal(sectionByKey('tos').label, 'Terms');
    assert.equal(sectionByKey('tos').name, 'Terms of Service');
});

test('maps each section path to its key, with or without a trailing slash', () => {
    assert.equal(sectionForPath('/gallery/'), 'gallery');
    assert.equal(sectionForPath('/gallery'), 'gallery');
    assert.equal(sectionForPath('/commissions/'), 'commissions');
    assert.equal(sectionForPath('/queue'), 'queue');
    assert.equal(sectionForPath('/tos/'), 'tos');
});

test('treats a character page as part of the gallery section', () => {
    assert.equal(sectionForPath('/gallery/vyphir/'), 'gallery');
    assert.equal(sectionForPath('/gallery/vyphir'), 'gallery');
});

test('returns null for paths outside the site layout', () => {
    for (const path of ['/', '/admin/', '/i/abc-123', '/gallery/a/b/', '/nope/']) {
        assert.equal(sectionForPath(path), null, path);
        assert.equal(usesSiteLayout(path), false, path);
    }
});

test('usesSiteLayout is true for every section path and character pages', () => {
    for (const path of ['/gallery/', '/commissions/', '/queue/', '/tos/', '/gallery/pharron/']) {
        assert.equal(usesSiteLayout(path), true, path);
    }
});

test('sectionByKey returns null for an unknown or null key', () => {
    assert.equal(sectionByKey('nope'), null);
    assert.equal(sectionByKey(null), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/site-sections.test.js`
Expected: FAIL with `Cannot find module` for `src/site/sections.js`.

- [ ] **Step 3: Write the implementation**

Create `src/site/sections.js`:

```js
import { normalizePath } from '../transitions/paths.js';

/*
 * The site bar's sections (page-layouts spec section 3.1). The hrefs are
 * checked against the route table's `siteLayout` flags in
 * tests/site-sections.test.js, so the two lists cannot drift apart.
 */
export const SECTIONS = [
    { key: 'gallery', label: 'Gallery', shortLabel: 'Gallery', name: 'Gallery', href: '/gallery/', colour: 'teal', blob: 1 },
    { key: 'commissions', label: 'Commissions', shortLabel: 'Comms', name: 'Commissions', href: '/commissions/', colour: 'honey', blob: 3 },
    { key: 'queue', label: 'Queue', shortLabel: 'Queue', name: 'Queue', href: '/queue/', colour: 'tabby', blob: 2 },
    { key: 'tos', label: 'Terms', shortLabel: 'Terms', name: 'Terms of Service', href: '/tos/', colour: 'lavender', blob: 4 },
];

const CHARACTER_PATH = /^\/gallery\/[^/]+\/$/;

export function sectionForPath(pathname) {
    const normalized = normalizePath(pathname);
    if (CHARACTER_PATH.test(normalized)) return 'gallery';
    const section = SECTIONS.find((s) => s.href === normalized);
    return section ? section.key : null;
}

export function usesSiteLayout(pathname) {
    return sectionForPath(pathname) !== null;
}

export function sectionByKey(key) {
    return SECTIONS.find((s) => s.key === key) || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./tests/jsx-loader.mjs tests/site-sections.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/site/sections.js tests/site-sections.test.js
git commit -m "feat: add the site bar section table

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Contrast-safe colour tokens

**Files:**
- Modify: `public/styles.css:1-35` (the `:root` block)
- Test: `tests/contrast-tokens.test.js`

**Interfaces:**
- Produces CSS custom properties used by every later task: `--slime-teal-ink`, `--slime-honey-ink`, `--slime-tabby-ink`, `--slime-lavender-ink`, `--slime-pink-ink`, `--surface-muted`, `--bead-muted`, `--bead-muted-ring`, and the changed `--text-muted`.

- [ ] **Step 1: Write the failing test**

Create `tests/contrast-tokens.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(projectRoot, 'public/styles.css'), 'utf8');
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));

const tokens = Object.fromEntries(
    [...rootBlock.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\b/g)].map(([, name, hex]) => [name, hex])
);

function luminance(hex) {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token]: every pairing the page-layouts spec uses.
const PAIRS = [
    ['slime-teal-ink', 'slime-teal'], ['slime-teal-ink', 'slime-teal-light'], ['slime-teal-ink', 'bg-cream'],
    ['slime-honey-ink', 'slime-honey'], ['slime-honey-ink', 'slime-honey-light'], ['slime-honey-ink', 'bg-cream'],
    ['slime-tabby-ink', 'slime-tabby'], ['slime-tabby-ink', 'slime-tabby-light'],
    ['slime-lavender-ink', 'slime-lavender'], ['slime-lavender-ink', 'slime-lavender-light'], ['slime-lavender-ink', 'bg-cream'],
    ['slime-pink-ink', 'slime-pink'], ['slime-pink-ink', 'slime-pink-light'],
    ['text-muted', 'bg-cream'], ['text-muted', 'slime-tabby-light'], ['text-muted', 'surface-muted'],
    ['surface', 'text-muted'],
    ['text-ink', 'bg-cream'], ['text-ink', 'slime-teal-light'], ['text-ink', 'slime-honey-light'],
    ['text-ink', 'slime-tabby-light'], ['text-ink', 'slime-lavender-light'],
];

for (const [text, background] of PAIRS) {
    test(`--${text} on --${background} reaches 4.5:1`, () => {
        assert.ok(tokens[text], `--${text} must be defined as a 6-digit hex in :root`);
        assert.ok(tokens[background], `--${background} must be defined as a 6-digit hex in :root`);
        const ratio = contrast(tokens[text], tokens[background]);
        assert.ok(ratio >= 4.5, `--${text} on --${background} is ${ratio.toFixed(2)}:1`);
    });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/contrast-tokens.test.js`
Expected: FAIL. The `*-ink` and `surface-muted` tokens are undefined, and `--text-muted on --bg-cream` is `4.14:1`.

- [ ] **Step 3: Edit the tokens**

In `public/styles.css`, replace:

```css
    --text-muted: #8A7368;
```

with:

```css
    --text-muted: #735E53;
    --surface-muted: #F4EDE3;
    --bead-muted: #D9CBBB;
    --bead-muted-ring: #B8A594;
```

Replace:

```css
    --slime-pink-dark: #E14C82;
```

with:

```css
    --slime-pink-dark: #E14C82;
    --slime-pink-ink: #6A1234;
```

Replace:

```css
    --slime-teal-dark: #189E90;
```

with:

```css
    --slime-teal-dark: #189E90;
    --slime-teal-ink: #0A4540;
```

Replace:

```css
    --slime-honey-dark: #E0A800;
```

with:

```css
    --slime-honey-dark: #E0A800;
    --slime-honey-ink: #5E4400;
```

Replace:

```css
    --slime-lavender-dark: #8F5FE0;
```

with:

```css
    --slime-lavender-dark: #8F5FE0;
    --slime-lavender-ink: #3E1F7A;
```

Replace:

```css
    --slime-tabby-dark: #E07A1F;
```

with:

```css
    --slime-tabby-dark: #E07A1F;
    --slime-tabby-ink: #6B3300;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./tests/jsx-loader.mjs tests/contrast-tokens.test.js`
Expected: PASS, 22 tests.

- [ ] **Step 5: Commit**

```bash
git add public/styles.css tests/contrast-tokens.test.js
git commit -m "style: add contrast-safe ink tokens and darken the muted text colour

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: SiteBar and SiteLayout components

**Files:**
- Create: `src/components/cx.js`, `src/site/photo.js`, `src/site/SiteBar.jsx`, `src/site/SiteLayout.jsx`
- Modify: `src/pages/Landing.jsx:17` (import the photo URL), `public/styles.css` (append bar CSS; extend the wave trigger list)
- Test: `tests/cx.test.js`, `tests/site-bar.test.js`

**Interfaces:**
- Consumes: `SECTIONS`, `sectionForPath`, `sectionByKey` (Task 1); `BLOB_PATHS` from `src/components/decor/blob-paths.js`; `WaveText` (`{ text, as = 'span', className }`); `usePopClick(durationMs?)` returning `{ className: '' | 'pop-active', onPointerUp }`.
- Produces:
  - `cx(...parts): string` joins truthy parts with single spaces.
  - `PHOTO_URL: string`.
  - `<SiteBar />`, which must render inside a router.
  - `<SiteLayout>{children?}</SiteLayout>` renders `div.site > SiteBar + main.site-page > (children ?? <Outlet/>)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/cx.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { cx } from '../src/components/cx.js';

test('joins truthy class names with single spaces', () => {
    assert.equal(cx('a', false, 'b', '', null, undefined, 'c'), 'a b c');
});

test('returns an empty string when nothing is truthy', () => {
    assert.equal(cx(false, '', null), '');
});
```

Create `tests/site-bar.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import SiteBar from '../src/site/SiteBar.jsx';
import SiteLayout from '../src/site/SiteLayout.jsx';
import { PHOTO_URL } from '../src/site/photo.js';

function renderBarAt(path) {
    return renderToStaticMarkup(
        <StaticRouter location={path}>
            <SiteBar />
        </StaticRouter>
    );
}

test('renders one bead link per section', () => {
    const html = renderBarAt('/gallery/');
    assert.equal((html.match(/<a class="site-bead site-bead--/g) || []).length, 4);
    for (const href of ['/gallery/', '/commissions/', '/queue/', '/tos/']) {
        assert.match(html, new RegExp(`href="${href}"`));
    }
});

test('marks exactly the current section with aria-current and is-active', () => {
    const html = renderBarAt('/queue/');
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /<a class="site-bead site-bead--tabby pop-clickable is-active" href="\/queue\/" aria-label="Queue" aria-current="page">/);
});

test('highlights Gallery on a character page', () => {
    const html = renderBarAt('/gallery/vyphir/');
    assert.match(html, /href="\/gallery\/" aria-label="Gallery" aria-current="page"/);
});

test('tints the ribbon with the current section colour', () => {
    assert.match(renderBarAt('/commissions/'), /<header class="site-bar site-bar--honey">/);
    assert.match(renderBarAt('/tos/'), /<header class="site-bar site-bar--lavender">/);
});

test('falls back to teal with nothing active outside the sections', () => {
    const html = renderBarAt('/');
    assert.match(html, /<header class="site-bar site-bar--teal">/);
    assert.doesNotMatch(html, /aria-current/);
});

test('gives Terms its full accessible name and both visible labels', () => {
    const html = renderBarAt('/gallery/');
    assert.match(html, /href="\/tos\/" aria-label="Terms of Service"/);
    assert.match(html, /site-bead__label--short" aria-hidden="true">Comms<\/span>/);
});

test('links the photo home', () => {
    const html = renderBarAt('/gallery/');
    assert.match(html, /<a class="site-bar__photo" href="\/" aria-label="Home"><img src="[^"]+" alt=""\/?><\/a>/);
    assert.ok(html.includes(PHOTO_URL.replace(/&/g, '&amp;')));
});

test('names the nav landmark', () => {
    assert.match(renderBarAt('/gallery/'), /<nav class="site-bar__nav" aria-label="Site">/);
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(renderBarAt('/gallery/vyphir/'), /style=/);
});

test('SiteLayout renders the bar and wraps children in main.site-page', () => {
    const html = renderToStaticMarkup(
        <StaticRouter location="/queue/">
            <SiteLayout><p>child</p></SiteLayout>
        </StaticRouter>
    );
    assert.match(html, /<div class="site">.*<header class="site-bar site-bar--tabby">.*<main class="site-page"><p>child<\/p><\/main><\/div>/s);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --import ./tests/jsx-loader.mjs tests/cx.test.js tests/site-bar.test.js`
Expected: FAIL with `Cannot find module` for `src/components/cx.js` and `src/site/SiteBar.jsx`.

- [ ] **Step 3: Write the helpers**

Create `src/components/cx.js`:

```js
export function cx(...parts) {
    return parts.filter(Boolean).join(' ');
}
```

Create `src/site/photo.js`:

```js
export const PHOTO_URL = 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401';
```

In `src/pages/Landing.jsx`, replace:

```js
const PHOTO_URL = 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401';
```

with:

```js
import { PHOTO_URL } from '../site/photo.js';
```

and move that import line up to sit with the other imports at the top of the file.

- [ ] **Step 4: Write the components**

Create `src/site/SiteBar.jsx`:

```jsx
import { useLocation } from 'react-router-dom';
import { BLOB_PATHS } from '../components/decor/blob-paths.js';
import WaveText from '../components/WaveText.jsx';
import { cx } from '../components/cx.js';
import { usePopClick } from '../hooks/usePopClick.js';
import { PHOTO_URL } from './photo.js';
import { SECTIONS, sectionByKey, sectionForPath } from './sections.js';

const RIBBON_PATH = 'M0,22 C150,2 300,42 450,22 C600,2 750,42 900,22 C1050,2 1150,32 1200,20 L1200,78 C1050,98 900,58 750,78 C600,98 450,58 300,78 C150,98 50,70 0,82 Z';

/*
 * Fills and strokes come from CSS classes, never SVG attributes, so the
 * colour change between sections can transition (page-layouts spec 3.3).
 * The link carries the accessible name; both visible labels are hidden from
 * assistive technology and CSS shows one per breakpoint.
 */
function Bead({ section, active }) {
    const pop = usePopClick();
    return (
        <a
            className={cx('site-bead', `site-bead--${section.colour}`, 'pop-clickable', active && 'is-active', pop.className)}
            href={section.href}
            aria-label={section.name}
            aria-current={active ? 'page' : undefined}
            onPointerUp={pop.onPointerUp}
        >
            <svg className="site-bead__blob" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d={BLOB_PATHS[section.blob]} />
            </svg>
            <span className="site-bead__label site-bead__label--long" aria-hidden="true">
                <WaveText text={section.label} />
            </span>
            <span className="site-bead__label site-bead__label--short" aria-hidden="true">{section.shortLabel}</span>
        </a>
    );
}

export default function SiteBar() {
    const { pathname } = useLocation();
    const activeKey = sectionForPath(pathname);
    const colour = sectionByKey(activeKey)?.colour ?? 'teal';
    return (
        <header className={`site-bar site-bar--${colour}`}>
            <svg className="site-bar__ribbon" viewBox="0 0 1200 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d={RIBBON_PATH} />
            </svg>
            <div className="site-bar__inner">
                <a className="site-bar__photo" href="/" aria-label="Home">
                    <img src={PHOTO_URL} alt="" />
                </a>
                <nav className="site-bar__nav" aria-label="Site">
                    {SECTIONS.map((section) => (
                        <Bead key={section.key} section={section} active={section.key === activeKey} />
                    ))}
                </nav>
            </div>
        </header>
    );
}
```

Create `src/site/SiteLayout.jsx`:

```jsx
import { Outlet } from 'react-router-dom';
import SiteBar from './SiteBar.jsx';

/*
 * The layout route's element (page-layouts spec section 4). React Router keeps
 * it mounted while child routes change, which is what keeps the bar still
 * between inner pages. `children` lets renderCharacter build the identical tree
 * without an outlet (spec section 5).
 */
export default function SiteLayout({ children }) {
    return (
        <div className="site">
            <SiteBar />
            <main className="site-page">{children ?? <Outlet />}</main>
        </div>
    );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test --import ./tests/jsx-loader.mjs tests/cx.test.js tests/site-bar.test.js tests/landing-page.test.js`
Expected: PASS for all three files (the landing tests confirm the photo import changed nothing).

- [ ] **Step 6: Add the bar CSS**

In `public/styles.css`, replace:

```css
:where(.wave-text:hover, .hub-item:hover, .hub-item:focus-visible) .wave-text-letter {
```

with:

```css
:where(.wave-text:hover, .hub-item:hover, .hub-item:focus-visible, .site-bead:hover, .site-bead:focus-visible) .wave-text-letter {
```

Append to the end of `public/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Site layout and bar (page-layouts spec sections 2-4).
 *
 * The bar sits outside each page's .page-* colour wrapper, so it carries its
 * own colour modifier. Blob fills and strokes are CSS, not SVG attributes, so
 * a change of section transitions instead of snapping.
 * ------------------------------------------------------------------------ */
.site-bar {
    --bar-base: var(--slime-teal);
    --bar-light: var(--slime-teal-light);
    --bar-dark: var(--slime-teal-dark);
    position: relative;
}
.site-bar--teal { --bar-base: var(--slime-teal); --bar-light: var(--slime-teal-light); --bar-dark: var(--slime-teal-dark); }
.site-bar--honey { --bar-base: var(--slime-honey); --bar-light: var(--slime-honey-light); --bar-dark: var(--slime-honey-dark); }
.site-bar--tabby { --bar-base: var(--slime-tabby); --bar-light: var(--slime-tabby-light); --bar-dark: var(--slime-tabby-dark); }
.site-bar--lavender { --bar-base: var(--slime-lavender); --bar-light: var(--slime-lavender-light); --bar-dark: var(--slime-lavender-dark); }

.site-bar__ribbon {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}
.site-bar__ribbon path {
    fill: var(--bar-light);
    transition: fill .2s ease;
}

.site-bar__inner {
    position: relative;
    max-width: 1280px;
    height: 96px;
    margin: 0 auto;
    padding: 0 18px;
    display: flex;
    align-items: center;
    gap: 4px;
}

.site-bar__photo {
    flex: 0 0 auto;
    display: block;
    width: 70px;
    height: 70px;
    margin-right: 10px;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid var(--bar-base);
    background: var(--slime-pink-light);
    transition: border-color .2s ease;
}
.site-bar__photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.site-bar__photo:focus-visible { outline: 3px solid var(--bar-dark); outline-offset: 3px; }

.site-bar__nav {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
}

.site-bead {
    --bead-base: var(--slime-teal);
    --bead-light: var(--slime-teal-light);
    --bead-dark: var(--slime-teal-dark);
    --bead-ink: var(--slime-teal-ink);
    position: relative;
    display: grid;
    place-items: center;
    width: 128px;
    height: 64px;
    color: var(--text-ink);
    text-decoration: none;
    font-family: 'Fredoka', sans-serif;
    font-weight: 700;
    font-size: 17px;
    letter-spacing: .02em;
}
.site-bead--teal { --bead-base: var(--slime-teal); --bead-light: var(--slime-teal-light); --bead-dark: var(--slime-teal-dark); --bead-ink: var(--slime-teal-ink); }
.site-bead--honey { --bead-base: var(--slime-honey); --bead-light: var(--slime-honey-light); --bead-dark: var(--slime-honey-dark); --bead-ink: var(--slime-honey-ink); }
.site-bead--tabby { --bead-base: var(--slime-tabby); --bead-light: var(--slime-tabby-light); --bead-dark: var(--slime-tabby-dark); --bead-ink: var(--slime-tabby-ink); }
.site-bead--lavender { --bead-base: var(--slime-lavender); --bead-light: var(--slime-lavender-light); --bead-dark: var(--slime-lavender-dark); --bead-ink: var(--slime-lavender-ink); }

.site-bead__blob {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
}
.site-bead__blob path {
    fill: var(--bead-light);
    stroke: transparent;
    stroke-width: 5px;
    vector-effect: non-scaling-stroke;
    transition: fill .2s ease, stroke .2s ease;
}
.site-bead.is-active .site-bead__blob path {
    fill: var(--bead-base);
    stroke: var(--bead-dark);
}
.site-bead__label { position: relative; }
.site-bead.is-active .site-bead__label { color: var(--bead-ink); }
.site-bead__label--short { display: none; }
.site-bead:focus-visible {
    outline: 3px solid var(--bead-dark);
    outline-offset: 2px;
    border-radius: 24px;
}

@media (max-width: 599px) {
    .site-bar__inner { height: 72px; padding: 0 8px; gap: 0; }
    .site-bar__photo { width: 50px; height: 50px; margin-right: 2px; border-width: 3px; }
    .site-bar__nav { flex: 1 1 auto; gap: 0; justify-content: space-between; }
    .site-bead { flex: 1 1 0; width: auto; min-width: 0; max-width: 78px; height: 46px; font-size: 12.5px; }
    .site-bead__blob path { stroke-width: 4px; }
    .site-bead__label--long { display: none; }
    .site-bead__label--short { display: inline; }
}

@media (prefers-reduced-motion: reduce) {
    .site-bar__ribbon path,
    .site-bar__photo,
    .site-bead__blob path { transition: none; }
}
```

- [ ] **Step 7: Run the tests again**

Run: `node --test --import ./tests/jsx-loader.mjs tests/cx.test.js tests/site-bar.test.js tests/wave-text.test.js tests/contrast-tokens.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/cx.js src/site/photo.js src/site/SiteBar.jsx src/site/SiteLayout.jsx src/pages/Landing.jsx public/styles.css tests/cx.test.js tests/site-bar.test.js
git commit -m "feat: add the bead-ribbon site bar and site layout

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Layout route and character build path

**Files:**
- Modify: `src/routes.js:16-19`, `src/App.jsx`, `src/entry-server.jsx:18-21`
- Modify tests: `tests/site-sections.test.js` (append), `tests/page-transitions.test.js:29-37`, `tests/render-pages.test.js`
- Create test: `tests/character-hydration-parity.test.js`

**Interfaces:**
- Consumes: `SiteLayout` (Task 3), `SECTIONS` (Task 1).
- Produces: route entries with `siteLayout: true` for `/gallery/`, `/commissions/`, `/tos/`, `/queue/`. `render(url)` output for those paths and for `renderCharacter(character)` now begins with `div.site`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/site-sections.test.js`:

```js
import { routes } from '../src/routes.js';

test('the route table flags exactly the section paths for the site layout', () => {
    const flagged = routes.filter((route) => route.siteLayout).map((route) => route.path).sort();
    assert.deepEqual(flagged, SECTIONS.map((section) => section.href).sort());
});
```

(Move the new `import` line to the top of the file with the other imports.)

In `tests/page-transitions.test.js`, replace the whole test:

```js
test('the gallery page still server-renders its panel with PageTransitions mounted', () => {
    const html = renderToStaticMarkup(
        <StaticRouter location="/gallery/">
            <App />
        </StaticRouter>
    );
    assert.match(html, /<div class="page-teal">/);
    assert.match(html, /<div class="panel-wrapper panel--wide"><div class="panel">/);
});
```

with:

```js
test('inner pages render inside the site layout under the bar', () => {
    for (const [path, colour] of [['/gallery/', 'teal'], ['/commissions/', 'honey'], ['/queue/', 'tabby'], ['/tos/', 'lavender']]) {
        const html = renderToStaticMarkup(
            <StaticRouter location={path}>
                <App />
            </StaticRouter>
        );
        assert.match(html, new RegExp(`<div class="site">.*<header class="site-bar site-bar--${colour}">`, 's'), path);
        assert.match(html, /<main class="site-page"><div class="page-/, path);
    }
});

test('the hub and admin render without the site bar', () => {
    for (const path of ['/', '/admin/']) {
        const html = renderToStaticMarkup(
            <StaticRouter location={path}>
                <App />
            </StaticRouter>
        );
        assert.doesNotMatch(html, /site-bar/, path);
    }
});
```

Create `tests/character-hydration-parity.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import { renderCharacter } from '../src/entry-server.jsx';

const CHARACTER = {
    slug: 'vyphir',
    name: 'Vyphir',
    species: 'Mainecoon Cat',
    bio: '20yo | She/Her\nLoves art',
    images: [
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/aaa-111.png', nsfw: false },
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/bbb-222.png', nsfw: false, thumbnail: true },
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/ccc-333.png', nsfw: true },
    ],
};

/*
 * The build renders character pages through renderCharacter, but the browser
 * hydrates them through App -> SiteLayout -> GalleryCharacterRoute. Hydration
 * needs the two to produce identical HTML (page-layouts spec section 5). The
 * route reads the embedded character from #root at first render, so a stub
 * document standing in for the built page makes App render the same data.
 */
test('renderCharacter produces exactly what the client renders for the same character', () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
        getElementById: (id) => (id === 'root' ? { dataset: { character: JSON.stringify(CHARACTER) } } : null),
    };
    try {
        const client = renderToString(
            <StaticRouter location="/gallery/vyphir/">
                <App />
            </StaticRouter>
        );
        assert.equal(renderCharacter(CHARACTER).html, client);
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
});
```

In `tests/render-pages.test.js`, inside `test('build renders a static page per character with escaped bio/species/name', …)`, add after the line `assert.match(html, /<div class="page-teal">/);`:

```js
    assert.match(html, /<header class="site-bar site-bar--teal">/);
    assert.match(html, /href="\/gallery\/" aria-label="Gallery" aria-current="page"/);
```

and inside `test('build produces a static index.html that contains the hydrated root markup', …)`, add after the `hub-photo` assertion:

```js
    assert.doesNotMatch(html, /site-bar/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --import ./tests/jsx-loader.mjs tests/site-sections.test.js tests/page-transitions.test.js tests/character-hydration-parity.test.js`
Expected: FAIL. The routes carry no `siteLayout` flag, no page renders `site-bar`, and the parity strings differ.

- [ ] **Step 3: Flag the routes**

In `src/routes.js`, replace:

```js
    { path: '/gallery/', Page: Gallery, title: 'Gallery | Vyphir' },
    { path: '/commissions/', Page: Commissions, title: 'Commissions | Vyphir' },
    { path: '/tos/', Page: Tos, title: 'Terms of Service | Vyphir' },
    { path: '/queue/', Page: Queue, title: 'Queue | Vyphir' },
```

with:

```js
    { path: '/gallery/', Page: Gallery, title: 'Gallery | Vyphir', siteLayout: true },
    { path: '/commissions/', Page: Commissions, title: 'Commissions | Vyphir', siteLayout: true },
    { path: '/tos/', Page: Tos, title: 'Terms of Service | Vyphir', siteLayout: true },
    { path: '/queue/', Page: Queue, title: 'Queue | Vyphir', siteLayout: true },
```

- [ ] **Step 4: Add the layout route**

Replace the whole of `src/App.jsx` with:

```jsx
import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';
import GalleryCharacterRoute from './pages/GalleryCharacterRoute.jsx';
import SiteLayout from './site/SiteLayout.jsx';
import PageTransitions from './transitions/PageTransitions.jsx';

const standaloneRoutes = routes.filter((route) => !route.siteLayout);
const layoutRoutes = routes.filter((route) => route.siteLayout);

export default function App() {
    return (
        <>
            <PageTransitions />
            <Routes>
                {standaloneRoutes.map(({ path, Page }) => (
                    <Route key={path} path={path} element={<Page />} />
                ))}
                <Route element={<SiteLayout />}>
                    {layoutRoutes.map(({ path, Page }) => (
                        <Route key={path} path={path} element={<Page />} />
                    ))}
                    <Route path="/gallery/:slug/" element={<GalleryCharacterRoute />} />
                </Route>
            </Routes>
        </>
    );
}
```

- [ ] **Step 5: Render characters inside the layout**

In `src/entry-server.jsx`, add after the existing imports:

```jsx
import SiteLayout from './site/SiteLayout.jsx';
```

and replace:

```jsx
export function renderCharacter(character) {
    const html = renderToString(<GalleryCharacter character={character} />);
    return { html };
}
```

with:

```jsx
export function renderCharacter(character) {
    const html = renderToString(
        <StaticRouter location={`/gallery/${character.slug}/`}>
            <SiteLayout>
                <GalleryCharacter character={character} />
            </SiteLayout>
        </StaticRouter>
    );
    return { html };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test --import ./tests/jsx-loader.mjs tests/site-sections.test.js tests/page-transitions.test.js tests/character-hydration-parity.test.js tests/gallery-character-route.test.js`
Expected: PASS.

Run: `node --test --import ./tests/jsx-loader.mjs tests/render-pages.test.js`
Expected: PASS (this file runs the build itself).

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS, with no failures. The old page tests still pass because each page still renders its panel inside `main.site-page`.

- [ ] **Step 8: Commit**

```bash
git add src/routes.js src/App.jsx src/entry-server.jsx tests/site-sections.test.js tests/page-transitions.test.js tests/render-pages.test.js tests/character-hydration-parity.test.js
git commit -m "feat: render inner pages and character pages inside the site layout

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Transition scope

**Files:**
- Create: `src/transitions/scope.js`
- Modify: `src/transitions/collect-pieces.js:111-115`, `src/transitions/PageTransitions.jsx`
- Test: `tests/transitions-scope.test.js`

**Interfaces:**
- Consumes: `usesSiteLayout` (Task 1); `firstRenderedChild(parent)` (existing).
- Produces:
  - `transitionScope(fromPath: string, toPath: string): 'page' | 'document'`
  - `pageRoot(scope: 'page' | 'document' = 'document'): Element | null`

- [ ] **Step 1: Write the failing test**

Create `tests/transitions-scope.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionScope } from '../src/transitions/scope.js';
import { pageRoot } from '../src/transitions/collect-pieces.js';

test('navigation between two inner pages is page-scoped', () => {
    assert.equal(transitionScope('/gallery/', '/queue/'), 'page');
    assert.equal(transitionScope('/tos/', '/commissions/'), 'page');
});

test('gallery to character and back is page-scoped', () => {
    assert.equal(transitionScope('/gallery/', '/gallery/vyphir/'), 'page');
    assert.equal(transitionScope('/gallery/vyphir/', '/gallery/'), 'page');
    assert.equal(transitionScope('/gallery/vyphir/', '/gallery/pharron/'), 'page');
});

test('to or from the hub is document-scoped', () => {
    assert.equal(transitionScope('/gallery/', '/'), 'document');
    assert.equal(transitionScope('/', '/commissions/'), 'document');
});

test('anything involving admin is document-scoped', () => {
    assert.equal(transitionScope('/admin/', '/gallery/'), 'document');
    assert.equal(transitionScope('/queue/', '/admin/'), 'document');
});

const node = (tagName, children = []) => ({ tagName, children });

function withDocument(doc, run) {
    const original = globalThis.document;
    globalThis.document = doc;
    try {
        run();
    } finally {
        if (original === undefined) delete globalThis.document;
        else globalThis.document = original;
    }
}

test('document scope starts at the first rendered child of #root', () => {
    const layout = node('DIV');
    const root = node('DIV', [node('LINK'), layout]);
    withDocument({ getElementById: (id) => (id === 'root' ? root : null), querySelector: () => null }, () => {
        assert.equal(pageRoot('document'), layout);
        assert.equal(pageRoot(), layout);
    });
});

test('page scope starts at the first rendered child of main.site-page', () => {
    const page = node('DIV');
    const main = node('MAIN', [page]);
    const root = node('DIV', [node('DIV', [node('HEADER'), main])]);
    withDocument({
        getElementById: (id) => (id === 'root' ? root : null),
        querySelector: (selector) => (selector === 'main.site-page' ? main : null),
    }, () => {
        assert.equal(pageRoot('page'), page);
    });
});

test('page scope falls back to the document root when there is no site page', () => {
    const hub = node('DIV');
    const root = node('DIV', [hub]);
    withDocument({ getElementById: (id) => (id === 'root' ? root : null), querySelector: () => null }, () => {
        assert.equal(pageRoot('page'), hub);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-scope.test.js`
Expected: FAIL with `Cannot find module` for `src/transitions/scope.js`.

- [ ] **Step 3: Write `scope.js`**

Create `src/transitions/scope.js`:

```js
import { usesSiteLayout } from '../site/sections.js';

/*
 * Where the fall and the settle start (page-layouts spec section 7). Between
 * two inner pages the site bar is shared and stays mounted, so only the page
 * below it may fall. Any navigation involving a page outside the layout (in
 * practice the hub) takes the whole tree, bar included.
 */
export function transitionScope(fromPath, toPath) {
    return usesSiteLayout(fromPath) && usesSiteLayout(toPath) ? 'page' : 'document';
}
```

- [ ] **Step 4: Scope `pageRoot`**

In `src/transitions/collect-pieces.js`, replace:

```js
export function pageRoot() {
    if (typeof document === 'undefined') return null;
    const root = document.getElementById('root');
    return root ? firstRenderedChild(root) : null;
}
```

with:

```js
export function pageRoot(scope = 'document') {
    if (typeof document === 'undefined') return null;
    if (scope === 'page') {
        const main = document.querySelector('main.site-page');
        if (main) return firstRenderedChild(main);
    }
    const root = document.getElementById('root');
    return root ? firstRenderedChild(root) : null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-scope.test.js tests/transitions-collect-pieces.test.js`
Expected: PASS.

- [ ] **Step 6: Wire the scope into `PageTransitions`**

In `src/transitions/PageTransitions.jsx`:

Add to the imports:

```jsx
import { transitionScope } from './scope.js';
```

Replace:

```jsx
    const pendingScroll = useRef(false);
```

with:

```jsx
    const pendingScroll = useRef(false);
    // Which part of the tree the next arrival settles: the same scope the
    // fall used, so a bar that stayed put is not animated in again.
    const pendingSettleScope = useRef('document');
```

Replace:

```jsx
            event.preventDefault();
```

with:

```jsx
            event.preventDefault();

            const scope = transitionScope(described.currentPathname, targetPath);
```

Replace:

```jsx
                    const root = pageRoot();
                    if (root) {
                        const pieces = collectPieces(root, domContext());
                        if (pieces.length > 0) runFall(pieces);
                    }
```

with:

```jsx
                    const root = pageRoot(scope);
                    if (root) {
                        const pieces = collectPieces(root, domContext());
                        if (pieces.length > 0) runFall(pieces);
                    }
```

Replace:

```jsx
            pendingSettleFor.current = reduced ? null : targetPath;
```

with:

```jsx
            pendingSettleFor.current = reduced ? null : targetPath;
            pendingSettleScope.current = scope;
```

Replace:

```jsx
            const root = pageRoot();
            if (root) settle(collectPieces(root, domContext()));
```

with:

```jsx
            const root = pageRoot(pendingSettleScope.current);
            if (root) settle(collectPieces(root, domContext()));
```

- [ ] **Step 7: Run the transition tests**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-scope.test.js tests/page-transitions.test.js tests/transitions-should-intercept.test.js tests/transitions-settle.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/transitions/scope.js src/transitions/collect-pieces.js src/transitions/PageTransitions.jsx tests/transitions-scope.test.js
git commit -m "feat: keep the site bar still when moving between inner pages

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Gallery page

**Files:**
- Create: `src/components/cover-image.js`, `src/components/messages.js`
- Modify: `src/components/GalleryIndexGrid.jsx` (rewrite), `src/pages/Gallery.jsx` (rewrite), `public/styles.css`
- Test: `tests/cover-image.test.js`, `tests/gallery-index-grid.test.js`, `tests/gallery-index-page.test.js` (rewrite)

**Interfaces:**
- Consumes: `cx` (Task 3), `usePopClick`, `WaveText`.
- Produces:
  - `selectCoverImage(images?: Array<{ url, nsfw?, thumbnail? }>): Image | null`. Used again in Task 7.
  - `LOAD_ERROR: string`. Used again in Tasks 8, 10 and 11.
  - `GalleryTiles({ characters })`, a named export from `GalleryIndexGrid.jsx`.
  - CSS classes `.page-frame` and `.page-message`, used by every later page.

- [ ] **Step 1: Write the failing tests**

Create `tests/cover-image.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCoverImage } from '../src/components/cover-image.js';

test('prefers a safe image flagged as the thumbnail', () => {
    const images = [{ url: 'a' }, { url: 'b', thumbnail: true }];
    assert.equal(selectCoverImage(images).url, 'b');
});

test('skips an NSFW thumbnail and falls back to the first safe image', () => {
    const images = [{ url: 'a', nsfw: true }, { url: 'b', thumbnail: true, nsfw: true }, { url: 'c' }];
    assert.equal(selectCoverImage(images).url, 'c');
});

test('returns null when every image is NSFW or there are none', () => {
    assert.equal(selectCoverImage([{ url: 'a', nsfw: true }]), null);
    assert.equal(selectCoverImage([]), null);
    assert.equal(selectCoverImage(undefined), null);
});
```

Create `tests/gallery-index-grid.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { GalleryTiles } from '../src/components/GalleryIndexGrid.jsx';

const CHARACTERS = [
    {
        slug: 'vyphir',
        name: 'Vyphir',
        bio: '20yo | She/Her | Female\nSecond line',
        images: [{ url: 'https://example.com/a.png' }, { url: 'https://example.com/cover.png', thumbnail: true }],
    },
    { slug: 'blair', name: 'Blair', bio: '19 | she/her', images: [{ url: 'https://example.com/n.png', nsfw: true }] },
];

const html = renderToStaticMarkup(<GalleryTiles characters={CHARACTERS} />);

test('renders one tile per character in a list', () => {
    assert.match(html, /^<ul class="gallery-grid">/);
    assert.equal((html.match(/<a class="gallery-tile /g) || []).length, 2);
});

test('links each tile to its character page and names it', () => {
    assert.match(html, /<a class="gallery-tile pop-clickable" href="\/gallery\/vyphir\/" aria-label="Vyphir">/);
    assert.match(html, /href="\/gallery\/blair\/" aria-label="Blair"/);
});

test('uses the cover image and only the first bio line', () => {
    assert.match(html, /<img class="gallery-tile__image" src="https:\/\/example.com\/cover.png" alt="" loading="lazy"\/?>/);
    assert.match(html, /<span class="gallery-tile__bio">20yo \| She\/Her \| Female<\/span>/);
    assert.doesNotMatch(html, /Second line/);
});

test('renders a tile without an image when a character has no safe image', () => {
    const blair = html.slice(html.indexOf('href="/gallery/blair/"'));
    assert.doesNotMatch(blair, /<img/);
});

test('renders the name with wave markup', () => {
    assert.match(html, /<span class="wave-text gallery-tile__name" aria-label="Vyphir">/);
});

test('shows a plain message when there are no characters', () => {
    assert.equal(renderToStaticMarkup(<GalleryTiles characters={[]} />), '<p class="page-message">No characters here yet.</p>');
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
```

Replace the whole of `tests/gallery-index-page.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Gallery from '../src/pages/Gallery.jsx';

const html = renderToStaticMarkup(<Gallery />);

test('wraps the page in the teal page frame', () => {
    assert.match(html, /^<div class="page-teal page-frame">/);
});

test('keeps a visually hidden page heading', () => {
    assert.match(html, /<h1 class="sr-only">Character Gallery<\/h1>/);
});

test('renders no panel, back link or visible title', () => {
    assert.doesNotMatch(html, /panel-wrapper|back-link|wave-text/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --import ./tests/jsx-loader.mjs tests/cover-image.test.js tests/gallery-index-grid.test.js tests/gallery-index-page.test.js`
Expected: FAIL. `cover-image.js` is missing, `GalleryTiles` is not exported, and the page still renders a panel.

- [ ] **Step 3: Write the helpers**

Create `src/components/cover-image.js`:

```js
/*
 * The one image that represents a character: the gallery tile and the top of
 * the character page (page-layouts spec 6.1, 6.2). Never NSFW.
 */
export function selectCoverImage(images) {
    const list = images || [];
    return list.find((img) => img.thumbnail && !img.nsfw) || list.find((img) => !img.nsfw) || null;
}
```

Create `src/components/messages.js`:

```js
export const LOAD_ERROR = "Couldn't load this right now. Try refreshing the page.";
```

- [ ] **Step 4: Rewrite the grid**

Replace the whole of `src/components/GalleryIndexGrid.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { cx } from './cx.js';
import { selectCoverImage } from './cover-image.js';
import { LOAD_ERROR } from './messages.js';
import WaveText from './WaveText.jsx';
import { usePopClick } from '../hooks/usePopClick.js';

function firstBioLine(bio) {
    return (bio || '').split('\n')[0].trim();
}

function GalleryTile({ character }) {
    const pop = usePopClick();
    const cover = selectCoverImage(character.images);
    return (
        <a
            className={cx('gallery-tile', 'pop-clickable', pop.className)}
            href={`/gallery/${character.slug}/`}
            aria-label={character.name}
            onPointerUp={pop.onPointerUp}
        >
            {cover && <img className="gallery-tile__image" src={cover.url} alt="" loading="lazy" />}
            <span className="gallery-tile__label">
                <WaveText className="gallery-tile__name" text={character.name} />
                <span className="gallery-tile__bio">{firstBioLine(character.bio)}</span>
            </span>
        </a>
    );
}

export function GalleryTiles({ characters }) {
    if (characters.length === 0) return <p className="page-message">No characters here yet.</p>;
    return (
        <ul className="gallery-grid">
            {characters.map((character) => (
                <li key={character.slug}><GalleryTile character={character} /></li>
            ))}
        </ul>
    );
}

export default function GalleryIndexGrid() {
    const [characters, setCharacters] = useState(null);

    useEffect(() => {
        fetch('/data/characters.json')
            .then((r) => r.json())
            .then((d) => setCharacters(d.characters || []))
            .catch((error) => {
                console.error(error);
                setCharacters('error');
            });
    }, []);

    if (characters === null) return null;
    if (characters === 'error') return <p className="page-message">{LOAD_ERROR}</p>;
    return <GalleryTiles characters={characters} />;
}
```

- [ ] **Step 5: Rewrite the page shell**

Replace the whole of `src/pages/Gallery.jsx` with:

```jsx
import GalleryIndexGrid from '../components/GalleryIndexGrid.jsx';

export default function Gallery() {
    return (
        <div className="page-teal page-frame">
            <h1 className="sr-only">Character Gallery</h1>
            <GalleryIndexGrid />
        </div>
    );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test --import ./tests/jsx-loader.mjs tests/cover-image.test.js tests/gallery-index-grid.test.js tests/gallery-index-page.test.js tests/page-transitions.test.js`
Expected: PASS.

- [ ] **Step 7: Replace the gallery CSS**

In `public/styles.css`, delete these rule blocks entirely (they are between `a.enlarge-link { … }` and `.hub { … }`):

- `.gallery-index-grid { … }`
- `.gallery-index-card { … }`
- `.gallery-index-card:hover { … }`
- `.gallery-index-card-main { … }`
- `.gallery-index-icon { … }`
- `.gallery-index-card-main h3 { … }`
- `.gallery-index-bio { … }`
- `.gallery-index-art-row { … }`
- `.gallery-index-thumb img { … }`

Extend the wave trigger list. Replace:

```css
:where(.wave-text:hover, .hub-item:hover, .hub-item:focus-visible, .site-bead:hover, .site-bead:focus-visible) .wave-text-letter {
```

with:

```css
:where(.wave-text:hover, .hub-item:hover, .hub-item:focus-visible, .site-bead:hover, .site-bead:focus-visible, .gallery-tile:hover, .gallery-tile:focus-visible) .wave-text-letter {
```

Append to the end of `public/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Page frame and shared page pieces (page-layouts spec sections 2 and 6.6).
 * ------------------------------------------------------------------------ */
.page-frame {
    max-width: 1280px;
    margin: 0 auto;
    padding: 8px 8px 40px;
}

.page-message {
    padding: 32px 14px;
    text-align: center;
    font-weight: 700;
    color: var(--text-muted);
}

@media (max-width: 599px) {
    .page-frame { padding: 4px 0 32px; }
}

/* ---------------------------------------------------------------------------
 * Gallery cover tiles (page-layouts spec section 6.1).
 * ------------------------------------------------------------------------ */
.gallery-grid {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
}

.gallery-tile {
    position: relative;
    display: block;
    aspect-ratio: 1;
    border-radius: 22px;
    overflow: hidden;
    background: var(--slime-teal-light);
    color: inherit;
    text-decoration: none;
}
.gallery-tile:focus-visible { outline: 3px solid var(--slime-teal-dark); outline-offset: 3px; }

.gallery-tile__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.gallery-tile__label {
    position: absolute;
    left: 10px;
    bottom: 10px;
    max-width: calc(100% - 20px);
    padding: 7px 16px 8px 14px;
    background: var(--bg-cream);
    border-radius: 26px 34px 30px 20px / 28px 20px 32px 24px;
}

.gallery-tile__name {
    display: block;
    font-family: 'Fredoka', sans-serif;
    font-weight: 700;
    font-size: 20px;
    line-height: 1.1;
    color: var(--slime-teal-ink);
}

.gallery-tile__bio {
    display: block;
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

@media (max-width: 899px) {
    .gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 599px) {
    .gallery-grid { grid-template-columns: 1fr; gap: 6px; }
    .gallery-tile { border-radius: 0; }
    .gallery-tile:focus-visible { outline-offset: -4px; }
}
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/cover-image.js src/components/messages.js src/components/GalleryIndexGrid.jsx src/pages/Gallery.jsx public/styles.css tests/cover-image.test.js tests/gallery-index-grid.test.js tests/gallery-index-page.test.js
git commit -m "feat: lay the gallery out as full-width cover tiles

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Character page

**Files:**
- Modify: `src/pages/GalleryCharacter.jsx` (rewrite), `public/styles.css`
- Modify test: `tests/render-pages.test.js`
- Create test: `tests/gallery-character-page.test.js`

**Interfaces:**
- Consumes: `selectCoverImage` (Task 6), `EnlargeableImage({ src, alt, className, wrap })`, `NsfwBlurImage({ src, alt, nsfw })`, `WaveText`.
- Produces: CSS class `.square-grid`, reused by `PastWorkGrid` in Task 8.

- [ ] **Step 1: Write the failing tests**

Create `tests/gallery-character-page.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import GalleryCharacter from '../src/pages/GalleryCharacter.jsx';

const CHARACTER = {
    slug: 'vyphir',
    name: 'Vyphir',
    species: 'Mainecoon Cat',
    bio: '20yo | She/Her\nLoves art',
    images: [
        { url: 'https://example.com/first.png' },
        { url: 'https://example.com/cover.png', thumbnail: true },
        { url: 'https://example.com/spicy.png', nsfw: true },
    ],
};

const html = renderToStaticMarkup(<GalleryCharacter character={CHARACTER} />);

test('wraps the page in the teal page frame with no panel', () => {
    assert.match(html, /^<div class="page-teal page-frame">/);
    assert.doesNotMatch(html, /panel-wrapper/);
});

test('renders the name as the visible wave-text h1', () => {
    assert.match(html, /<h1 class="wave-text character-name" aria-label="Vyphir">/);
});

test('links back to all characters', () => {
    assert.match(html, /<a class="character-back" href="\/gallery\/">← All characters<\/a>/);
});

test('shows species and the full bio', () => {
    assert.match(html, /<p class="character-species">Mainecoon Cat<\/p>/);
    assert.match(html, /<p class="character-bio">20yo \| She\/Her\nLoves art<\/p>/);
});

test('leads with the cover image and leaves it out of the grid', () => {
    const top = html.slice(0, html.indexOf('character-grid'));
    const grid = html.slice(html.indexOf('character-grid'));
    assert.match(top, /class="char-image-wrap character-hero"/);
    assert.ok(top.includes('cover.png'));
    assert.ok(!grid.includes('cover.png'));
});

test('puts every other image, NSFW included, in the square grid', () => {
    assert.match(html, /<ul class="square-grid character-grid">/);
    const grid = html.slice(html.indexOf('character-grid'));
    assert.equal((grid.match(/<li>/g) || []).length, 2);
    assert.match(grid, /data-nsfw="true"/);
});

test('drops the feature image when there is no safe image', () => {
    const noSafe = renderToStaticMarkup(
        <GalleryCharacter character={{ ...CHARACTER, images: [{ url: 'https://example.com/n.png', nsfw: true }] }} />
    );
    assert.match(noSafe, /<section class="character-top character-top--no-image">/);
    assert.doesNotMatch(noSafe, /character-hero/);
});

test('renders no grid when the only image is the cover', () => {
    const one = renderToStaticMarkup(
        <GalleryCharacter character={{ ...CHARACTER, images: [{ url: 'https://example.com/only.png' }] }} />
    );
    assert.doesNotMatch(one, /character-grid/);
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
```

In `tests/render-pages.test.js`, in `test('build renders a static page per character with escaped bio/species/name', …)`, replace:

```js
    assert.match(html, /<div class="page-teal">/);
```

with:

```js
    assert.match(html, /<div class="page-teal page-frame">/);
```

delete the line:

```js
    assert.match(html, /<div class="panel-wrapper"><div class="panel">/);
```

replace:

```js
    assert.match(html, /<h1 class="wave-text" aria-label="[^"]*">.*<span class="wave-text-letter"/s);
```

with:

```js
    assert.match(html, /<h1 class="wave-text character-name" aria-label="[^"]*">.*<span class="wave-text-letter"/s);
```

and replace:

```js
    assert.match(html, /<a href="\/gallery\/" class="back-link">/);
```

with:

```js
    assert.match(html, /<a class="character-back" href="\/gallery\/">/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --import ./tests/jsx-loader.mjs tests/gallery-character-page.test.js`
Expected: FAIL, because the page still renders a `Panel`.

- [ ] **Step 3: Rewrite the page**

Replace the whole of `src/pages/GalleryCharacter.jsx` with:

```jsx
import EnlargeableImage from '../components/EnlargeableImage.jsx';
import NsfwBlurImage from '../components/NsfwBlurImage.jsx';
import WaveText from '../components/WaveText.jsx';
import { cx } from '../components/cx.js';
import { selectCoverImage } from '../components/cover-image.js';

export default function GalleryCharacter({ character }) {
    const images = character.images || [];
    const cover = selectCoverImage(images);
    const rest = images.filter((img) => img !== cover);

    return (
        <div className="page-teal page-frame">
            <section className={cx('character-top', !cover && 'character-top--no-image')}>
                {cover && <EnlargeableImage src={cover.url} alt={character.name} className="character-hero" />}
                <div className="character-intro">
                    <a className="character-back" href="/gallery/">&larr; All characters</a>
                    <WaveText as="h1" className="character-name" text={character.name} />
                    {character.species && <p className="character-species">{character.species}</p>}
                    {character.bio && <p className="character-bio">{character.bio}</p>}
                </div>
            </section>
            {rest.length > 0 && (
                <ul className="square-grid character-grid">
                    {rest.map((img, i) => (
                        <li key={i}><NsfwBlurImage src={img.url} alt="" nsfw={Boolean(img.nsfw)} /></li>
                    ))}
                </ul>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test --import ./tests/jsx-loader.mjs tests/gallery-character-page.test.js tests/gallery-character-route.test.js tests/character-hydration-parity.test.js`
Expected: PASS.

- [ ] **Step 5: Replace the character CSS**

In `public/styles.css`, delete these rule blocks entirely:

- `.profile { … }`
- `.profile h1 { … }`
- `.profile p { … }`
- `.char-species { … }`
- `.char-bio { … }`
- `.char-image-grid { … }`

Do **not** delete `.char-image-wrap` or any of its variants; `functions/i/[id].js` uses them.

Append to the end of `public/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Square image grid, shared by character art and past work (spec 6.2, 6.3).
 * The tile fill comes from the page's --accent-light via .char-image-wrap.
 * ------------------------------------------------------------------------ */
.square-grid {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
}
.square-grid .char-image-wrap { aspect-ratio: 1; border-radius: 16px; }
.square-grid .enlarge-link { height: 100%; }
.square-grid .char-image-wrap img { height: 100%; object-fit: cover; }
.square-grid .nsfw-warning { background: var(--text-muted); }

@media (max-width: 899px) {
    .square-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 599px) {
    .square-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
    .square-grid .char-image-wrap { border-radius: 0; }
}

/* ---------------------------------------------------------------------------
 * Character page (page-layouts spec section 6.2).
 * ------------------------------------------------------------------------ */
.character-top {
    display: grid;
    grid-template-columns: 44% minmax(0, 1fr);
    gap: 22px;
    align-items: end;
    margin-bottom: 8px;
}
.character-top--no-image { grid-template-columns: 1fr; }

.character-top .character-hero { border-radius: 22px; }
.character-top .character-hero:hover { transform: none; }
.character-top .character-hero img { aspect-ratio: 1; object-fit: cover; }

.character-intro { padding: 0 6px 12px; }

.character-back {
    font-weight: 700;
    font-size: 14px;
    color: var(--slime-teal-ink);
    text-decoration: none;
}
.character-back:hover { text-decoration: underline; }
.character-back:focus-visible { outline: 3px solid var(--slime-teal-dark); outline-offset: 2px; border-radius: 6px; }

.character-name {
    font-size: 40px;
    line-height: 1.05;
    color: var(--slime-teal-ink);
    margin: 6px 0 2px;
}

.character-species {
    font-size: 15px;
    color: var(--text-muted);
    margin-bottom: 12px;
}

.character-bio {
    font-size: 15px;
    line-height: 1.6;
    white-space: pre-line;
    max-width: 60ch;
}

@media (max-width: 899px) {
    .character-top { grid-template-columns: 1fr; gap: 10px; }
}

@media (max-width: 599px) {
    .character-top .character-hero { border-radius: 0; }
    .character-intro { padding: 0 14px 6px; }
    .character-name { font-size: 32px; }
}
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS, including `tests/render-pages.test.js` with its updated character assertions.

- [ ] **Step 7: Commit**

```bash
git add src/pages/GalleryCharacter.jsx public/styles.css tests/gallery-character-page.test.js tests/render-pages.test.js
git commit -m "feat: lead character pages with a feature image and a square art grid

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Commissions page and past work

**Files:**
- Modify: `src/pages/Commissions.jsx` (rewrite), `src/components/PastWorkGrid.jsx` (rewrite), `public/styles.css`
- Delete: `src/components/LinkButton.jsx`
- Test: `tests/commissions-page.test.js` (rewrite), `tests/past-work-grid.test.js` (rewrite)

**Interfaces:**
- Consumes: `LOAD_ERROR` (Task 6), `.square-grid` (Task 7), `BLOB_PATHS`, existing `CommissionTierList({ tiers })` (rewritten in Task 9 with the same props).
- Produces: `CommissionsContent({ data })`, a named export of `Commissions.jsx`, where `data` is `{ status, intro, specialOffer, tiers, pastWork }`.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `tests/commissions-page.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Commissions, { CommissionsContent } from '../src/pages/Commissions.jsx';

const page = renderToStaticMarkup(<Commissions />);

const DATA = {
    status: true,
    intro: 'Reach out on discord\nor Insta <3',
    specialOffer: '',
    tiers: [{ name: 'Lined Headshots', price: '€10+', description: 'Simple line art', example: 'https://example.com/t.png' }],
    pastWork: [{ url: 'https://example.com/p.png', caption: 'Comm for Owen' }],
};

test('wraps the page in the honey page frame with a hidden heading', () => {
    assert.match(page, /^<div class="page-honey page-frame"><h1 class="sr-only">Commissions<\/h1>/);
});

test('renders no panel, back link or queue and terms buttons', () => {
    assert.doesNotMatch(page, /panel-wrapper|back-link|link-btn/);
});

test('renders nothing data-dependent before the fetch lands', () => {
    assert.doesNotMatch(page, /status-sticker/);
});

test('shows an open sticker when commissions are open', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={DATA} />);
    assert.match(html, /<p class="status-sticker status-sticker--open">.*<span class="status-sticker__text">Commissions open!<\/span><\/p>/s);
});

test('shows a closed sticker when commissions are closed', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={{ ...DATA, status: false }} />);
    assert.match(html, /status-sticker--closed/);
    assert.match(html, /Commissions closed/);
});

test('renders the intro and only renders the special offer when there is one', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={DATA} />);
    assert.match(html, /<p class="commissions-intro__text">Reach out on discord\nor Insta &lt;3<\/p>/);
    assert.doesNotMatch(html, /commissions-offer/);
    const offer = renderToStaticMarkup(<CommissionsContent data={{ ...DATA, specialOffer: 'Half price icons' }} />);
    assert.match(offer, /<p class="commissions-offer">Half price icons<\/p>/);
});

test('renders the tiers and a past work heading when there is past work', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={DATA} />);
    assert.match(html, /Lined Headshots/);
    assert.match(html, /<h2 class="past-work-title">Past work<\/h2>/);
});

test('omits the past work heading when there is none', () => {
    const html = renderToStaticMarkup(<CommissionsContent data={{ ...DATA, pastWork: [] }} />);
    assert.doesNotMatch(html, /past-work/);
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(renderToStaticMarkup(<CommissionsContent data={DATA} />), /style=/);
});
```

Replace the whole of `tests/past-work-grid.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import PastWorkGrid from '../src/components/PastWorkGrid.jsx';

const items = [
    { url: 'https://example.com/a.jpg', caption: 'A caption', nsfw: false },
    { url: 'https://example.com/b.jpg', caption: '', nsfw: false, giftArt: true },
    { url: 'https://example.com/c.jpg', caption: '', nsfw: true },
];

const html = renderToStaticMarkup(<PastWorkGrid items={items} />);

test('renders a square grid list with one item per piece', () => {
    assert.match(html, /^<ul class="square-grid past-work-grid">/);
    assert.equal((html.match(/<li>/g) || []).length, 3);
});

test('no longer displays captions', () => {
    assert.doesNotMatch(html, /<p>/);
});

test('keeps the caption as alt text, with the existing fallbacks', () => {
    assert.match(html, /alt="A caption"/);
    assert.match(html, /alt="Past gift art"/);
    assert.match(html, /alt="Past commission work"/);
});

test('keeps tap to reveal for NSFW pieces', () => {
    assert.match(html, /data-nsfw="true"/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --import ./tests/jsx-loader.mjs tests/commissions-page.test.js tests/past-work-grid.test.js`
Expected: FAIL, because `CommissionsContent` is not exported and the grid still renders captions.

- [ ] **Step 3: Rewrite past work**

Replace the whole of `src/components/PastWorkGrid.jsx` with:

```jsx
import NsfwBlurImage from './NsfwBlurImage.jsx';

export default function PastWorkGrid({ items }) {
    return (
        <ul className="square-grid past-work-grid">
            {items.map((item, i) => (
                <li key={i}>
                    <NsfwBlurImage
                        src={item.url}
                        nsfw={Boolean(item.nsfw)}
                        alt={item.caption || (item.giftArt ? 'Past gift art' : 'Past commission work')}
                    />
                </li>
            ))}
        </ul>
    );
}
```

- [ ] **Step 4: Rewrite the page**

Replace the whole of `src/pages/Commissions.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import CommissionTierList from '../components/CommissionTierList.jsx';
import PastWorkGrid from '../components/PastWorkGrid.jsx';
import { BLOB_PATHS } from '../components/decor/blob-paths.js';
import { LOAD_ERROR } from '../components/messages.js';

export function CommissionsContent({ data }) {
    const open = Boolean(data.status);
    const pastWork = data.pastWork || [];
    return (
        <>
            <section className="commissions-top">
                <p className={`status-sticker status-sticker--${open ? 'open' : 'closed'}`}>
                    <svg className="status-sticker__blob" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                        <path d={BLOB_PATHS[2]} />
                    </svg>
                    <span className="status-sticker__text">{open ? 'Commissions open!' : 'Commissions closed'}</span>
                </p>
                <div className="commissions-intro">
                    {data.intro && <p className="commissions-intro__text">{data.intro}</p>}
                    {data.specialOffer && <p className="commissions-offer">{data.specialOffer}</p>}
                </div>
            </section>
            <CommissionTierList tiers={data.tiers || []} />
            {pastWork.length > 0 && (
                <>
                    <h2 className="past-work-title">Past work</h2>
                    <PastWorkGrid items={pastWork} />
                </>
            )}
        </>
    );
}

export default function Commissions() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch('/data/commissions.json')
            .then((r) => r.json())
            .then(setData)
            .catch((err) => {
                console.error(err);
                setError(true);
            });
    }, []);

    return (
        <div className="page-honey page-frame">
            <h1 className="sr-only">Commissions</h1>
            {error && <p className="page-message">{LOAD_ERROR}</p>}
            {data && <CommissionsContent data={data} />}
        </div>
    );
}
```

Delete `src/components/LinkButton.jsx`:

```bash
git rm src/components/LinkButton.jsx
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test --import ./tests/jsx-loader.mjs tests/commissions-page.test.js tests/past-work-grid.test.js tests/page-transitions.test.js`
Expected: PASS.

Run: `grep -rn "LinkButton\|commission-past-work" src tests scripts`
Expected: no output.

- [ ] **Step 6: Replace the commissions CSS**

In `public/styles.css`, delete these rule blocks entirely:

- `.links-grid { … }`
- `.link-btn { … }`, `.link-btn:hover { … }`, `.link-btn i { … }`
- `.section-title { … }`, `.section-title i { … }`
- `.commission-status { … }`, `.commission-status.open { … }`, `.commission-status.closed { … }`
- `.commission-special-offer { … }`
- `.past-work-card { transition: … }` and `.past-work-card:hover { … }` (the two standalone rules only; leave the combined `.tier-card, .past-work-card` rules for Task 12)
- `#commission-past-work { … }` and `#commission-past-work .past-work-card p { … }`

Append to the end of `public/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Commissions top row and past work (page-layouts spec section 6.3).
 * ------------------------------------------------------------------------ */
.commissions-top {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 6px 14px 18px;
}

.status-sticker {
    position: relative;
    flex: 0 0 auto;
    width: 150px;
    height: 84px;
    display: grid;
    place-items: center;
    text-align: center;
}
.status-sticker__blob {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
}
.status-sticker__blob path { stroke-width: 4px; vector-effect: non-scaling-stroke; }
.status-sticker--open .status-sticker__blob path { fill: var(--slime-teal-light); stroke: var(--slime-teal-dark); }
.status-sticker--closed .status-sticker__blob path { fill: var(--slime-pink-light); stroke: var(--slime-pink-dark); }
.status-sticker__text {
    position: relative;
    padding: 0 14px;
    font-family: 'Fredoka', sans-serif;
    font-weight: 700;
    font-size: 17px;
    line-height: 1.05;
}
.status-sticker--open .status-sticker__text { color: var(--slime-teal-ink); }
.status-sticker--closed .status-sticker__text { color: var(--slime-pink-ink); }

.commissions-intro {
    font-size: 15px;
    line-height: 1.55;
    max-width: 62ch;
}
.commissions-intro__text { white-space: pre-line; }

.commissions-offer {
    margin-top: 10px;
    padding: 10px 16px;
    background: var(--slime-honey-light);
    color: var(--slime-honey-ink);
    font-weight: 700;
    white-space: pre-line;
    border-radius: 22px 28px 20px 26px;
}

.past-work-title {
    font-size: 22px;
    color: var(--slime-honey-ink);
    padding: 18px 14px 8px;
}

@media (max-width: 599px) {
    .commissions-top { flex-direction: column; align-items: flex-start; gap: 8px; }
    .status-sticker { width: 132px; height: 70px; }
    .status-sticker__text { font-size: 15px; }
    .commissions-intro { font-size: 14px; }
    .past-work-title { font-size: 19px; }
}
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Commissions.jsx src/components/PastWorkGrid.jsx public/styles.css tests/commissions-page.test.js tests/past-work-grid.test.js
git commit -m "feat: add the commissions status sticker and caption-free past work grid

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Commission tier strip

**Files:**
- Create: `src/components/strip-index.js`, `src/hooks/useScrollStrip.js`
- Modify: `src/components/CommissionTierList.jsx` (rewrite), `public/styles.css`
- Test: `tests/strip-index.test.js`, `tests/commission-tier-list.test.js`

**Interfaces:**
- Consumes: `cx` (Task 3).
- Produces:
  - `nearestIndex(scrollLeft: number, offsets: number[], maxScroll = Infinity): number`
  - `useScrollStrip(ref, count): { overflowing: boolean, activeIndex: number, nudge: boolean }`
  - `CommissionTierList({ tiers })` keeps its props.

- [ ] **Step 1: Write the failing tests**

Create `tests/strip-index.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestIndex } from '../src/components/strip-index.js';

test('returns 0 when there are no items', () => {
    assert.equal(nearestIndex(120, []), 0);
});

test('picks the item whose left edge is closest to the scroll position', () => {
    assert.equal(nearestIndex(0, [0, 300, 600], 900), 0);
    assert.equal(nearestIndex(280, [0, 300, 600], 900), 1);
    assert.equal(nearestIndex(590, [0, 300, 600], 900), 2);
});

test('keeps the earlier item on an exact tie', () => {
    assert.equal(nearestIndex(150, [0, 300, 600], 900), 0);
});

test('reports the last item once the strip is scrolled to its end', () => {
    // Four thirds-width tiers: the last one can never reach the left edge.
    assert.equal(nearestIndex(345, [0, 345, 690, 1035], 345), 3);
});

test('does not jump to the last item when the strip cannot scroll at all', () => {
    assert.equal(nearestIndex(0, [0, 300], 0), 0);
});
```

Create `tests/commission-tier-list.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import CommissionTierList from '../src/components/CommissionTierList.jsx';

const TIERS = [
    { name: 'Lined Headshots', price: '€10+', description: 'Line one\nLine two', example: 'https://example.com/a.png' },
    { name: 'Flat Colour Headshots', price: '€15+', description: 'Flat colour', example: '' },
];

const html = renderToStaticMarkup(<CommissionTierList tiers={TIERS} />);

test('renders a keyboard-scrollable, labelled strip', () => {
    assert.match(html, /<div class="tiers__strip" role="region" aria-label="Commission tiers" tabindex="0">/);
});

test('renders one article per tier with an h2 name', () => {
    assert.equal((html.match(/<article class="tier">/g) || []).length, 2);
    assert.match(html, /<h2 class="tier__name">Lined Headshots<\/h2>/);
});

test('renders the price blob, the description and the example image', () => {
    assert.match(html, /<p class="tier__price">€10\+<\/p>/);
    assert.match(html, /<p class="tier__description">Line one\nLine two<\/p>/);
    assert.match(html, /<img class="tier__image" src="https:\/\/example.com\/a.png" alt="Lined Headshots" loading="lazy"\/?>/);
    assert.equal((html.match(/tier__image/g) || []).length, 1);
});

test('renders the swipe hint and dots only once overflow is measured in the browser', () => {
    assert.doesNotMatch(html, /tiers__hint|tiers--overflowing|tiers__strip--nudge/);
});

test('renders nothing for an empty tier list', () => {
    assert.equal(renderToStaticMarkup(<CommissionTierList tiers={[]} />), '');
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --import ./tests/jsx-loader.mjs tests/strip-index.test.js tests/commission-tier-list.test.js`
Expected: FAIL, because `strip-index.js` is missing and the old tier markup has no strip.

- [ ] **Step 3: Write the pure helper**

Create `src/components/strip-index.js`:

```js
/*
 * Which item of a horizontal snap strip is "current" for the dots
 * (page-layouts spec 6.3). Offsets are each item's left edge relative to the
 * first item. Once the strip is scrolled to its end, the last item is current
 * even if its edge never reaches the scroll position, which happens whenever
 * the final items fit on screen together.
 */
export function nearestIndex(scrollLeft, offsets, maxScroll = Infinity) {
    if (offsets.length === 0) return 0;
    if (maxScroll > 0 && scrollLeft >= maxScroll - 1) return offsets.length - 1;
    let best = 0;
    for (let i = 1; i < offsets.length; i += 1) {
        if (Math.abs(offsets[i] - scrollLeft) < Math.abs(offsets[best] - scrollLeft)) best = i;
    }
    return best;
}
```

- [ ] **Step 4: Write the hook**

Create `src/hooks/useScrollStrip.js`:

```js
import { useEffect, useState } from 'react';
import { nearestIndex } from '../components/strip-index.js';

/*
 * Overflow, the current dot and the one-time nudge for a horizontal strip
 * (page-layouts spec 6.3). All three reach the DOM as class names only: the
 * CSP silently drops inline styles. The nudge itself is a CSS animation, which
 * the stylesheet switches off under prefers-reduced-motion.
 */
export function useScrollStrip(ref, count) {
    const [overflowing, setOverflowing] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [nudge, setNudge] = useState(false);

    useEffect(() => {
        const strip = ref.current;
        if (!strip) return undefined;
        let frame = 0;
        let nudged = false;

        const measure = () => {
            const over = strip.scrollWidth > strip.clientWidth + 1;
            setOverflowing(over);
            if (over && !nudged) {
                nudged = true;
                setNudge(true);
            }
        };

        const update = () => {
            frame = 0;
            const first = strip.firstElementChild;
            if (!first) return;
            const offsets = Array.from(strip.children, (child) => child.offsetLeft - first.offsetLeft);
            setActiveIndex(nearestIndex(strip.scrollLeft, offsets, strip.scrollWidth - strip.clientWidth));
        };

        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        measure();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        observer?.observe(strip);
        strip.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            observer?.disconnect();
            strip.removeEventListener('scroll', onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [ref, count]);

    return { overflowing, activeIndex, nudge };
}
```

- [ ] **Step 5: Rewrite the tier list**

Replace the whole of `src/components/CommissionTierList.jsx` with:

```jsx
import { useRef } from 'react';
import { cx } from './cx.js';
import { useScrollStrip } from '../hooks/useScrollStrip.js';

export default function CommissionTierList({ tiers }) {
    const stripRef = useRef(null);
    const { overflowing, activeIndex, nudge } = useScrollStrip(stripRef, tiers.length);

    if (tiers.length === 0) return null;

    return (
        <div className={cx('tiers', overflowing && 'tiers--overflowing')}>
            {overflowing && (
                <div className="tiers__hint">
                    <span>{tiers.length} tiers · swipe &rarr;</span>
                    <span className="tiers__dots" aria-hidden="true">
                        {tiers.map((_, i) => (
                            <span key={i} className={cx('tiers__dot', i === activeIndex && 'is-active')} />
                        ))}
                    </span>
                </div>
            )}
            <div
                ref={stripRef}
                className={cx('tiers__strip', nudge && 'tiers__strip--nudge')}
                role="region"
                aria-label="Commission tiers"
                tabIndex={0}
            >
                {tiers.map((tier, i) => (
                    <article className="tier" key={i}>
                        {tier.example && <img className="tier__image" src={tier.example} alt={tier.name} loading="lazy" />}
                        <h2 className="tier__name">{tier.name}</h2>
                        {tier.price && <p className="tier__price">{tier.price}</p>}
                        {tier.description && <p className="tier__description">{tier.description}</p>}
                    </article>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test --import ./tests/jsx-loader.mjs tests/strip-index.test.js tests/commission-tier-list.test.js tests/commissions-page.test.js`
Expected: PASS.

- [ ] **Step 7: Replace the tier CSS**

In `public/styles.css`, delete the rule block `.tier-price { … }`.

Append to the end of `public/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Commission tier strip (page-layouts spec section 6.3).
 * Desktop shows at most three tiers side by side, tablet two, phone one with
 * the next peeking in. A fourth tier on desktop scrolls exactly like phones.
 * ------------------------------------------------------------------------ */
.tiers { margin-top: 4px; }

.tiers__hint {
    display: none;
    justify-content: space-between;
    align-items: center;
    padding: 2px 14px 8px;
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    font-size: 14px;
    color: var(--slime-honey-ink);
}
.tiers--overflowing .tiers__hint { display: flex; }

.tiers__dots { display: flex; gap: 6px; }
.tiers__dot {
    display: block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--slime-honey-light);
    transition: width .2s ease, background-color .2s ease;
}
.tiers__dot.is-active { width: 22px; border-radius: 6px; background: var(--slime-honey-dark); }

.tiers__strip {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 0 0 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--slime-honey-dark) var(--slime-honey-light);
}
.tiers__strip::-webkit-scrollbar { height: 8px; }
.tiers__strip::-webkit-scrollbar-track { background: var(--slime-honey-light); border-radius: 8px; }
.tiers__strip::-webkit-scrollbar-thumb { background: var(--slime-honey-dark); border-radius: 8px; }
.tiers__strip:focus-visible { outline: 3px solid var(--slime-honey-dark); outline-offset: 3px; border-radius: 12px; }

.tier {
    flex: 0 0 calc((100% - 28px) / 3);
    min-width: 0;
    scroll-snap-align: start;
}

.tier__image {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    display: block;
    border-radius: 22px;
    background: var(--surface);
}

.tier__name {
    margin-top: 10px;
    font-size: 21px;
    line-height: 1.15;
    color: var(--slime-honey-ink);
}

.tier__price {
    display: inline-block;
    margin: 6px 0 8px;
    padding: 2px 12px 3px;
    font-family: 'Fredoka', sans-serif;
    font-weight: 700;
    font-size: 15px;
    color: var(--slime-honey-ink);
    background: var(--slime-honey);
    border-radius: 16px 22px 18px 14px / 18px 14px 20px 16px;
}

.tier__description {
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-line;
}

.tiers__strip--nudge .tier { animation: tiers-nudge 1.1s ease-in-out .9s 2; }

@keyframes tiers-nudge {
    0%, 100% { transform: translateX(0); }
    45% { transform: translateX(-46px); }
}

@media (max-width: 899px) {
    .tier { flex-basis: calc((100% - 14px) / 2); }
}

@media (max-width: 599px) {
    .tiers__strip { gap: 10px; padding: 0 14px 12px; scroll-padding-inline: 14px; }
    .tier { flex-basis: 78%; }
    .tier__image { border-radius: 20px; }
    .tier__name { font-size: 19px; }
    .tier__description { font-size: 13.5px; }
}

@media (prefers-reduced-motion: reduce) {
    .tiers__strip--nudge .tier { animation: none; }
    .tiers__dot { transition: none; }
}
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/strip-index.js src/hooks/useScrollStrip.js src/components/CommissionTierList.jsx public/styles.css tests/strip-index.test.js tests/commission-tier-list.test.js
git commit -m "feat: show commission tiers in a swipeable strip with overflow hints

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Queue progress beads

**Files:**
- Create: `src/components/queue-entries.js`
- Modify: `src/components/QueueBoard.jsx` (rewrite), `src/pages/Queue.jsx` (rewrite), `public/styles.css`
- Test: `tests/queue-entries.test.js`, `tests/queue-board.test.js`, `tests/queue-page.test.js` (rewrite)

**Interfaces:**
- Consumes: `cx` (Task 3), `LOAD_ERROR` (Task 6), `formatDate` from `shared/format-date.js` (returns `dd/mm/yyyy`).
- Produces:
  - `queueEntries(data?: { columns?, cards? }): { stages, active, finished }`. Each entry is `{ ...card, stageIndex, stageCount, stageName }`.
  - `QueueCards({ data })`, a named export of `QueueBoard.jsx`.

- [ ] **Step 1: Write the failing tests**

Create `tests/queue-entries.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { queueEntries } from '../src/components/queue-entries.js';

const COLUMNS = [
    { id: 'c1', name: 'In Queue', enabled: true },
    { id: 'c2', name: 'Sketch Provided', enabled: true },
    { id: 'c3', name: 'Paid', enabled: false },
    { id: 'c4', name: 'WIP', enabled: true },
    { id: 'c5', name: 'Complete', enabled: true },
];

test('uses the enabled columns, in data order, as the stages', () => {
    const { stages } = queueEntries({ columns: COLUMNS, cards: [] });
    assert.deepEqual(stages.map((s) => s.name), ['In Queue', 'Sketch Provided', 'WIP', 'Complete']);
});

test('drops cards sitting in a disabled or unknown stage', () => {
    const { active, finished } = queueEntries({
        columns: COLUMNS,
        cards: [{ id: 'x', columnId: 'c3' }, { id: 'y', columnId: 'nope' }],
    });
    assert.deepEqual(active, []);
    assert.deepEqual(finished, []);
});

test('annotates each entry with its stage', () => {
    const { active } = queueEntries({ columns: COLUMNS, cards: [{ id: 'a', columnId: 'c4', title: 'Train art!' }] });
    assert.deepEqual(
        { stageIndex: active[0].stageIndex, stageCount: active[0].stageCount, stageName: active[0].stageName, title: active[0].title },
        { stageIndex: 2, stageCount: 4, stageName: 'WIP', title: 'Train art!' }
    );
});

test('orders active entries furthest along first, keeping data order within a stage', () => {
    const { active } = queueEntries({
        columns: COLUMNS,
        cards: [
            { id: 'q1', columnId: 'c1' },
            { id: 'w', columnId: 'c4' },
            { id: 'q2', columnId: 'c1' },
            { id: 's', columnId: 'c2' },
        ],
    });
    assert.deepEqual(active.map((e) => e.id), ['w', 's', 'q1', 'q2']);
});

test('treats the last stage as finished, keeping data order', () => {
    const { active, finished } = queueEntries({
        columns: COLUMNS,
        cards: [{ id: 'f1', columnId: 'c5' }, { id: 'a', columnId: 'c1' }, { id: 'f2', columnId: 'c5' }],
    });
    assert.deepEqual(finished.map((e) => e.id), ['f1', 'f2']);
    assert.deepEqual(active.map((e) => e.id), ['a']);
});

test('treats nothing as finished when there is only one stage', () => {
    const { active, finished } = queueEntries({
        columns: [{ id: 'only', name: 'Queue', enabled: true }],
        cards: [{ id: 'a', columnId: 'only' }],
    });
    assert.equal(finished.length, 0);
    assert.deepEqual(active.map((e) => e.id), ['a']);
});

test('handles missing data', () => {
    assert.deepEqual(queueEntries(undefined), { stages: [], active: [], finished: [] });
    assert.deepEqual(queueEntries({}), { stages: [], active: [], finished: [] });
});
```

Create `tests/queue-board.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueueCards } from '../src/components/QueueBoard.jsx';

const DATA = {
    columns: [
        { id: 'c1', name: 'In Queue', enabled: true },
        { id: 'c2', name: 'Sketch Provided', enabled: true },
        { id: 'c4', name: 'WIP', enabled: true },
        { id: 'c5', name: 'Complete', enabled: true },
    ],
    cards: [
        { id: 'a', columnId: 'c1', title: 'Rusko gift art', for: 'personal', targetDate: '', createdAt: '' },
        { id: 'b', columnId: 'c4', title: 'Train art!', for: 'evby', targetDate: '2026-08-27', createdAt: '' },
        { id: 'd', columnId: 'c5', title: 'Icon', for: '@owenmcn', targetDate: '', createdAt: '' },
    ],
};

const html = renderToStaticMarkup(<QueueCards data={DATA} />);

test('lists active commissions furthest along first', () => {
    assert.ok(html.indexOf('Train art!') < html.indexOf('Rusko gift art'));
});

test('renders each title as an h2 with a joined meta line', () => {
    assert.match(html, /<h2 class="queue-card__title">Train art!<\/h2><p class="queue-card__meta">For: evby · target 27\/08\/2026<\/p>/);
    assert.match(html, /<p class="queue-card__meta">For: personal<\/p>/);
});

test('states the stage in text for active cards', () => {
    assert.match(html, /<p class="queue-card__stage">WIP · stage 3 of 4<\/p>/);
    assert.match(html, /<p class="queue-card__stage">In Queue · stage 1 of 4<\/p>/);
});

test('draws one bead per stage with exactly one current bead per card', () => {
    const cards = html.split('<li class="queue-card').slice(1);
    assert.equal(cards.length, 3);
    for (const card of cards) {
        assert.equal((card.match(/queue-track__bead/g) || []).length, 4);
        assert.equal((card.match(/is-current/g) || []).length, 1);
    }
    assert.match(html, /<span class="queue-track" aria-hidden="true">/);
});

test('groups finished commissions under a count label', () => {
    assert.match(html, /<p class="queue-finished-label">Finished · 1<\/p>/);
    assert.match(html, /<li class="queue-card queue-card--finished">.*<p class="queue-card__stage">Complete<\/p>/s);
});

test('omits the finished label when nothing is finished', () => {
    const none = renderToStaticMarkup(<QueueCards data={{ ...DATA, cards: DATA.cards.slice(0, 2) }} />);
    assert.doesNotMatch(none, /queue-finished-label/);
});

test('shows a plain message when the queue is empty', () => {
    assert.equal(
        renderToStaticMarkup(<QueueCards data={{ ...DATA, cards: [] }} />),
        '<p class="page-message">The queue is empty right now.</p>'
    );
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
```

Replace the whole of `tests/queue-page.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Queue from '../src/pages/Queue.jsx';

const html = renderToStaticMarkup(<Queue />);

test('wraps the page in the tabby page frame with a hidden heading', () => {
    assert.match(html, /^<div class="page-tabby page-frame"><h1 class="sr-only">Commission Queue<\/h1>/);
});

test('renders no panel, back link or visible title', () => {
    assert.doesNotMatch(html, /panel-wrapper|back-link|wave-text/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --import ./tests/jsx-loader.mjs tests/queue-entries.test.js tests/queue-board.test.js tests/queue-page.test.js`
Expected: FAIL, because `queue-entries.js` is missing, `QueueCards` is not exported and the page still renders a panel.

- [ ] **Step 3: Write `queue-entries.js`**

Create `src/components/queue-entries.js`:

```js
/*
 * Queue grouping (page-layouts spec 6.4). The admin panel's enabled columns
 * are the stages, in their order. The queue data has no "done" flag, so the
 * last stage stands in for it, but only when there is more than one stage.
 */
export function queueEntries(data) {
    const stages = ((data && data.columns) || []).filter((column) => column.enabled);
    const indexById = new Map(stages.map((stage, i) => [stage.id, i]));
    const hasFinishedStage = stages.length >= 2;
    const active = [];
    const finished = [];

    for (const card of (data && data.cards) || []) {
        if (!indexById.has(card.columnId)) continue;
        const stageIndex = indexById.get(card.columnId);
        const entry = { ...card, stageIndex, stageCount: stages.length, stageName: stages[stageIndex].name };
        if (hasFinishedStage && stageIndex === stages.length - 1) finished.push(entry);
        else active.push(entry);
    }

    // Array.prototype.sort is stable, so cards in the same stage keep data order.
    active.sort((a, b) => b.stageIndex - a.stageIndex);
    return { stages, active, finished };
}
```

- [ ] **Step 4: Rewrite the board**

Replace the whole of `src/components/QueueBoard.jsx` with:

```jsx
import { Fragment, useEffect, useState } from 'react';
import { formatDate } from '../../shared/format-date.js';
import { cx } from './cx.js';
import { LOAD_ERROR } from './messages.js';
import { queueEntries } from './queue-entries.js';

function formatTargetDate(dateStr) {
    if (!dateStr) return '';
    return formatDate(`${dateStr}T00:00:00`);
}

function formatRelativeAge(isoString) {
    if (!isoString) return '';
    const created = new Date(isoString);
    if (Number.isNaN(created.getTime())) return '';
    const days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'added today';
    if (days === 1) return 'added 1 day ago';
    if (days < 14) return `added ${days} days ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 8) return `added ${weeks} week${weeks === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `added ${months} month${months === 1 ? '' : 's'} ago`;
}

function metaLine(entry) {
    const target = formatTargetDate(entry.targetDate);
    return [entry.for && `For: ${entry.for}`, target && `target ${target}`, formatRelativeAge(entry.createdAt)]
        .filter(Boolean)
        .join(' · ');
}

function QueueCard({ entry, finished }) {
    const meta = metaLine(entry);
    return (
        <li className={cx('queue-card', finished && 'queue-card--finished')}>
            <h2 className="queue-card__title">{entry.title || ''}</h2>
            {meta && <p className="queue-card__meta">{meta}</p>}
            <span className="queue-track" aria-hidden="true">
                {Array.from({ length: entry.stageCount }, (_, i) => (
                    <Fragment key={i}>
                        {i > 0 && <span className={cx('queue-track__bar', i <= entry.stageIndex && 'is-past')} />}
                        <span className={cx('queue-track__bead', i < entry.stageIndex && 'is-past', i === entry.stageIndex && 'is-current')} />
                    </Fragment>
                ))}
            </span>
            <p className="queue-card__stage">
                {finished ? entry.stageName : `${entry.stageName} · stage ${entry.stageIndex + 1} of ${entry.stageCount}`}
            </p>
        </li>
    );
}

export function QueueCards({ data }) {
    const { active, finished } = queueEntries(data);
    if (active.length === 0 && finished.length === 0) {
        return <p className="page-message">The queue is empty right now.</p>;
    }
    return (
        <div className="queue">
            {active.length > 0 && (
                <ul className="queue-list">
                    {active.map((entry) => <QueueCard entry={entry} key={entry.id} />)}
                </ul>
            )}
            {finished.length > 0 && (
                <>
                    <p className="queue-finished-label">Finished · {finished.length}</p>
                    <ul className="queue-list">
                        {finished.map((entry) => <QueueCard entry={entry} finished key={entry.id} />)}
                    </ul>
                </>
            )}
        </div>
    );
}

export default function QueueBoard() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch('/data/queue.json')
            .then((r) => r.json())
            .then(setData)
            .catch((err) => {
                console.error(err);
                setError(true);
            });
    }, []);

    if (error) return <p className="page-message">{LOAD_ERROR}</p>;
    if (data === null) return null;
    return <QueueCards data={data} />;
}
```

Replace the whole of `src/pages/Queue.jsx` with:

```jsx
import QueueBoard from '../components/QueueBoard.jsx';

export default function Queue() {
    return (
        <div className="page-tabby page-frame">
            <h1 className="sr-only">Commission Queue</h1>
            <QueueBoard />
        </div>
    );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test --import ./tests/jsx-loader.mjs tests/queue-entries.test.js tests/queue-board.test.js tests/queue-page.test.js tests/page-transitions.test.js`
Expected: PASS. If the "Finished · 1" regex fails because React split the text and the number, check the raw output: JSX `Finished · {finished.length}` renders as `Finished · <!-- -->1` only under `renderToString`, not `renderToStaticMarkup`, so this test file (which uses `renderToStaticMarkup`) should match as written.

- [ ] **Step 6: Replace the queue CSS**

In `public/styles.css`, delete these rule blocks entirely, and do it before appending the new rules, since the old `.queue-card p` would otherwise restyle the new paragraphs:

- `.queue-board-columns { … }`
- the whole `@media (max-width: 720px) { .queue-board-columns { … } .queue-column { … } }` block
- `.queue-column h3 { … }`
- `.queue-column-cards { … }`
- `.queue-card { margin-bottom: 0; }`
- `.queue-card h4 { … }`
- `.queue-card p { … }`
- `.queue-card-for { … }`, `.queue-card-target { … }`, `.queue-card-age { … }`

Append to the end of `public/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Queue progress beads (page-layouts spec section 6.4).
 * ------------------------------------------------------------------------ */
.queue { padding: 6px 6px 0; }

.queue-list {
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

.queue-finished-label {
    margin: 22px 4px 8px;
    font-family: 'Fredoka', sans-serif;
    font-weight: 700;
    font-size: 16px;
    color: var(--text-muted);
}

.queue-card {
    padding: 12px 14px;
    background: var(--slime-tabby-light);
    border-radius: 22px 26px 20px 24px;
}

.queue-card__title {
    font-size: 17px;
    line-height: 1.2;
    color: var(--text-ink);
}

.queue-card__meta {
    margin-top: 2px;
    font-size: 13px;
    color: var(--slime-tabby-ink);
}

.queue-track {
    display: flex;
    align-items: center;
    margin-top: 12px;
}
.queue-track__bead {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    background: var(--bg-cream);
    border-radius: 48% 52% 45% 55% / 55% 45% 52% 48%;
}
.queue-track__bead.is-past { background: var(--slime-tabby); }
.queue-track__bead.is-current {
    width: 24px;
    height: 22px;
    background: var(--slime-tabby);
    box-shadow: 0 0 0 3px var(--slime-tabby-dark);
}
.queue-track__bar {
    flex: 1 1 auto;
    height: 4px;
    margin: 0 3px;
    border-radius: 2px;
    background: var(--bg-cream);
}
.queue-track__bar.is-past { background: var(--slime-tabby); }

.queue-card__stage {
    margin-top: 6px;
    font-family: 'Fredoka', sans-serif;
    font-weight: 700;
    font-size: 13px;
    color: var(--slime-tabby-ink);
}

.queue-card--finished { background: var(--surface-muted); }
.queue-card--finished .queue-card__title,
.queue-card--finished .queue-card__meta,
.queue-card--finished .queue-card__stage { color: var(--text-muted); }
.queue-card--finished .queue-track__bead,
.queue-card--finished .queue-track__bar { background: var(--bead-muted); }
.queue-card--finished .queue-track__bead.is-current { box-shadow: 0 0 0 3px var(--bead-muted-ring); }

@media (max-width: 899px) {
    .queue-list { grid-template-columns: 1fr; }
}

@media (max-width: 599px) {
    .queue { padding: 4px 12px 0; }
    .queue-list { gap: 8px; }
}
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/queue-entries.js src/components/QueueBoard.jsx src/pages/Queue.jsx public/styles.css tests/queue-entries.test.js tests/queue-board.test.js tests/queue-page.test.js
git commit -m "feat: show the commission queue as cards with progress beads

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Terms of Service index and draw panels

**Files:**
- Create: `src/components/split-tos.js`, `src/components/first-visible.js`, `src/hooks/useCurrentSection.js`
- Modify: `src/components/TosPointList.jsx` (rewrite), `src/pages/Tos.jsx` (rewrite), `public/styles.css`
- Test: `tests/split-tos.test.js`, `tests/first-visible.test.js`, `tests/tos-point-list.test.js`, `tests/tos-page.test.js` (rewrite)

**Interfaces:**
- Consumes: `cx` (Task 3), `LOAD_ERROR` (Task 6).
- Produces:
  - `splitTos(points?): { will: string[], wont: string[], points: Point[] }`
  - `firstVisible(ids: string[], visible: Set<string>): string | null`
  - `useCurrentSection(ids: string[]): string | null`
  - `TosContent({ points })`, a named export of `TosPointList.jsx`.

- [ ] **Step 1: Write the failing tests**

Create `tests/split-tos.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTos } from '../src/components/split-tos.js';

const POINTS = [
    { title: 'Payments', body: 'Pay first', bullets: [{ type: 'plain', text: 'Up front' }] },
    {
        title: 'What I draw',
        body: 'Backgrounds extra',
        bullets: [
            { type: 'yesno', text: 'Feral', value: true },
            { type: 'plain', text: 'Ask first' },
            { type: 'yesno', text: 'Humans', value: false },
        ],
    },
    { title: 'Extras', bullets: [{ type: 'yesno', text: 'Anthro', value: true }] },
    { title: 'Refunds', body: 'Maybe' },
];

test('collects yes/no bullets from every point, in order', () => {
    const { will, wont } = splitTos(POINTS);
    assert.deepEqual(will, ['Feral', 'Anthro']);
    assert.deepEqual(wont, ['Humans']);
});

test('removes yes/no bullets but keeps plain bullets, bodies and titles', () => {
    const { points } = splitTos(POINTS);
    assert.deepEqual(points[1], { title: 'What I draw', body: 'Backgrounds extra', bullets: [{ type: 'plain', text: 'Ask first' }] });
    assert.deepEqual(points[0].bullets, [{ type: 'plain', text: 'Up front' }]);
});

test('gives points left without bullets an empty array', () => {
    const { points } = splitTos(POINTS);
    assert.deepEqual(points[2].bullets, []);
    assert.deepEqual(points[3].bullets, []);
});

test('returns empty lists when there are no yes/no bullets or no points', () => {
    assert.deepEqual(splitTos([{ title: 'A', bullets: [] }]).will, []);
    assert.deepEqual(splitTos(undefined), { will: [], wont: [], points: [] });
});
```

Create `tests/first-visible.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { firstVisible } from '../src/components/first-visible.js';

test('returns the first id, in document order, that is visible', () => {
    assert.equal(firstVisible(['tos-1', 'tos-2', 'tos-3'], new Set(['tos-3', 'tos-2'])), 'tos-2');
});

test('returns null when nothing is visible', () => {
    assert.equal(firstVisible(['tos-1'], new Set()), null);
});
```

Create `tests/tos-point-list.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TosContent } from '../src/components/TosPointList.jsx';

const POINTS = [
    { title: 'Payments', body: 'Pay first\nThen wait', bullets: [{ type: 'plain', text: 'Up front' }] },
    {
        title: 'What I draw',
        body: 'Backgrounds extra',
        bullets: [{ type: 'yesno', text: 'Feral', value: true }, { type: 'yesno', text: 'Humans', value: false }],
    },
    { title: 'Refunds', body: 'Maybe' },
];

const html = renderToStaticMarkup(<TosContent points={POINTS} />);

test('renders a labelled index linking to every point', () => {
    assert.match(html, /<nav class="tos-index" aria-label="Terms">/);
    for (const [i, title] of [[1, 'Payments'], [2, 'What I draw'], [3, 'Refunds']]) {
        assert.match(html, new RegExp(`<a class="tos-index__link[^"]*" href="#tos-${i}"[^>]*><span class="tos-num" aria-hidden="true">${i}</span>${title}</a>`));
    }
});

test('marks the first point as current before any scrolling', () => {
    assert.match(html, /<a class="tos-index__link is-current" href="#tos-1" aria-current="true">/);
    assert.equal((html.match(/aria-current/g) || []).length, 1);
});

test('renders every point as a section with a matching id and h2', () => {
    for (const i of [1, 2, 3]) assert.match(html, new RegExp(`<section class="tos-point" id="tos-${i}">`));
    assert.match(html, /<h2 class="tos-point__title"><span class="tos-num" aria-hidden="true">1<\/span>Payments<\/h2>/);
    assert.match(html, /<p class="tos-point__body">Pay first\nThen wait<\/p>/);
});

test('pulls yes/no items into the draw panels and out of the points', () => {
    assert.match(html, /<section class="tos-draw__panel tos-draw__panel--will"><h2>Will draw<\/h2><ul><li>Feral<\/li><\/ul><\/section>/);
    assert.match(html, /<section class="tos-draw__panel tos-draw__panel--wont"><h2>Won&#x27;t draw<\/h2><ul><li>Humans<\/li><\/ul><\/section>/);
    assert.equal((html.match(/class="tos-point__bullets"/g) || []).length, 1);
});

test('omits the draw panels when there are no yes/no items', () => {
    const plain = renderToStaticMarkup(<TosContent points={[POINTS[0], POINTS[2]]} />);
    assert.doesNotMatch(plain, /tos-draw/);
});

test('omits a single empty draw panel', () => {
    const onlyYes = renderToStaticMarkup(
        <TosContent points={[{ title: 'Draw', bullets: [{ type: 'yesno', text: 'Feral', value: true }] }]} />
    );
    assert.match(onlyYes, /tos-draw__panel--will/);
    assert.doesNotMatch(onlyYes, /tos-draw__panel--wont/);
});

test('shows a plain message when there are no points', () => {
    assert.equal(renderToStaticMarkup(<TosContent points={[]} />), '<p class="page-message">No terms published yet.</p>');
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
```

Replace the whole of `tests/tos-page.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Tos from '../src/pages/Tos.jsx';

const html = renderToStaticMarkup(<Tos />);

test('wraps the page in the lavender page frame with a hidden heading', () => {
    assert.match(html, /^<div class="page-lavender page-frame"><h1 class="sr-only">Terms of Service<\/h1>/);
});

test('renders no panel, back link or visible title', () => {
    assert.doesNotMatch(html, /panel-wrapper|back-link|wave-text/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test --import ./tests/jsx-loader.mjs tests/split-tos.test.js tests/first-visible.test.js tests/tos-point-list.test.js tests/tos-page.test.js`
Expected: FAIL, because the helpers are missing, `TosContent` is not exported and the page still renders a panel.

- [ ] **Step 3: Write the pure helpers**

Create `src/components/split-tos.js`:

```js
/*
 * Page-layouts spec 6.5: every yes/no bullet, from any point, moves into the
 * Will draw / Won't draw panels, so adding one to another point keeps working.
 */
export function splitTos(points) {
    const will = [];
    const wont = [];
    const rest = (points || []).map((point) => {
        const bullets = [];
        for (const bullet of point.bullets || []) {
            if (bullet.type === 'yesno') (bullet.value ? will : wont).push(bullet.text || '');
            else bullets.push(bullet);
        }
        return { ...point, bullets };
    });
    return { will, wont, points: rest };
}
```

Create `src/components/first-visible.js`:

```js
export function firstVisible(ids, visible) {
    return ids.find((id) => visible.has(id)) ?? null;
}
```

- [ ] **Step 4: Write the hook**

Create `src/hooks/useCurrentSection.js`:

```js
import { useEffect, useState } from 'react';
import { firstVisible } from '../components/first-visible.js';

/*
 * The Terms index highlight (page-layouts spec 6.5). The observer's bottom
 * margin trims the lower 40% of the viewport, so a point counts as current
 * once it reaches the upper part of the screen rather than the moment its top
 * edge peeks in at the bottom.
 */
export function useCurrentSection(ids) {
    const [current, setCurrent] = useState(ids[0] ?? null);
    const key = ids.join('|');

    useEffect(() => {
        if (typeof IntersectionObserver !== 'function') return undefined;
        const list = key ? key.split('|') : [];
        const visible = new Set();
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) visible.add(entry.target.id);
                else visible.delete(entry.target.id);
            }
            const next = firstVisible(list, visible);
            if (next) setCurrent(next);
        }, { rootMargin: '0px 0px -40% 0px' });

        for (const id of list) {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, [key]);

    return current;
}
```

- [ ] **Step 5: Rewrite the Terms list and page**

Replace the whole of `src/components/TosPointList.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { cx } from './cx.js';
import { LOAD_ERROR } from './messages.js';
import { splitTos } from './split-tos.js';
import { useCurrentSection } from '../hooks/useCurrentSection.js';

function DrawPanel({ variant, title, items }) {
    if (items.length === 0) return null;
    return (
        <section className={`tos-draw__panel tos-draw__panel--${variant}`}>
            <h2>{title}</h2>
            <ul>{items.map((text, i) => <li key={i}>{text}</li>)}</ul>
        </section>
    );
}

export function TosContent({ points: source }) {
    const { will, wont, points } = splitTos(source);
    const ids = points.map((_, i) => `tos-${i + 1}`);
    const current = useCurrentSection(ids);

    if (points.length === 0) return <p className="page-message">No terms published yet.</p>;

    return (
        <div className="tos">
            <nav className="tos-index" aria-label="Terms">
                <ol className="tos-index__list">
                    {points.map((point, i) => (
                        <li key={ids[i]}>
                            <a
                                className={cx('tos-index__link', current === ids[i] && 'is-current')}
                                href={`#${ids[i]}`}
                                aria-current={current === ids[i] ? 'true' : undefined}
                            >
                                <span className="tos-num" aria-hidden="true">{i + 1}</span>{point.title || ''}
                            </a>
                        </li>
                    ))}
                </ol>
            </nav>
            <div className="tos-body">
                {(will.length > 0 || wont.length > 0) && (
                    <div className="tos-draw">
                        <DrawPanel variant="will" title="Will draw" items={will} />
                        <DrawPanel variant="wont" title="Won't draw" items={wont} />
                    </div>
                )}
                {points.map((point, i) => (
                    <section className="tos-point" id={ids[i]} key={ids[i]}>
                        <h2 className="tos-point__title">
                            <span className="tos-num" aria-hidden="true">{i + 1}</span>{point.title || ''}
                        </h2>
                        {point.body && <p className="tos-point__body">{point.body}</p>}
                        {point.bullets.length > 0 && (
                            <ul className="tos-point__bullets">
                                {point.bullets.map((bullet, j) => <li key={j}>{bullet.text || ''}</li>)}
                            </ul>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
}

export default function TosPointList() {
    const [points, setPoints] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch('/data/tos.json')
            .then((r) => r.json())
            .then((d) => setPoints(d.points || []))
            .catch((err) => {
                console.error(err);
                setError(true);
            });
    }, []);

    if (error) return <p className="page-message">{LOAD_ERROR}</p>;
    if (points === null) return null;
    return <TosContent points={points} />;
}
```

Replace the whole of `src/pages/Tos.jsx` with:

```jsx
import TosPointList from '../components/TosPointList.jsx';

export default function Tos() {
    return (
        <div className="page-lavender page-frame">
            <h1 className="sr-only">Terms of Service</h1>
            <TosPointList />
        </div>
    );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test --import ./tests/jsx-loader.mjs tests/split-tos.test.js tests/first-visible.test.js tests/tos-point-list.test.js tests/tos-page.test.js tests/page-transitions.test.js`
Expected: PASS. If the "Won't draw" assertion fails, print the output: React escapes `'` as `&#x27;`, which is what the test expects. Adjust only the test regex if the installed React emits a different entity; do not change the copy.

- [ ] **Step 7: Replace the Terms CSS**

In `public/styles.css`, delete these rule blocks entirely, before appending the new rules, because the old `.tos-point` would otherwise add a margin to the new sections:

- `.tos-point { … }`, `.tos-point h3 { … }`, `.tos-point-number { … }`
- `.tos-bullets { … }`, `.tos-bullets li { … }`
- `.tos-bullet-plain::before { … }`
- `.tos-bullet-yesno i { … }`, `.tos-bullet-yes i { … }`, `.tos-bullet-no i { … }`

Append to the end of `public/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Terms of Service (page-layouts spec section 6.5).
 * The index is one element: a sticky vertical list on desktop, a scrolling
 * chip row below 900px.
 * ------------------------------------------------------------------------ */
.tos {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 26px;
    align-items: start;
    padding: 8px 18px 0 10px;
}

.tos-index {
    position: sticky;
    top: 16px;
}
.tos-index__list {
    list-style: none;
    display: grid;
    gap: 2px;
}
.tos-index__link {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 5px 8px;
    border-radius: 14px;
    font-weight: 700;
    font-size: 14px;
    color: var(--slime-lavender-ink);
    text-decoration: none;
}
.tos-index__link:hover { background: var(--slime-lavender-light); }
.tos-index__link.is-current {
    background: var(--slime-lavender-light);
    box-shadow: inset 0 0 0 2px var(--slime-lavender-dark);
}
.tos-index__link:focus-visible { outline: 3px solid var(--slime-lavender-dark); outline-offset: 2px; }

.tos-num {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 24px;
    height: 22px;
    background: var(--slime-lavender);
    color: var(--slime-lavender-ink);
    font-family: 'Fredoka', sans-serif;
    font-weight: 700;
    font-size: 12px;
    border-radius: 48% 52% 45% 55% / 55% 45% 52% 48%;
}

.tos-body {
    display: grid;
    gap: 24px;
    min-width: 0;
}

.tos-draw {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}
.tos-draw__panel {
    padding: 12px 16px;
    border-radius: 24px 30px 22px 28px;
}
.tos-draw__panel h2 { font-size: 17px; margin-bottom: 6px; }
.tos-draw__panel ul { list-style: none; font-size: 14px; line-height: 1.7; }
.tos-draw__panel--will { background: var(--slime-teal-light); color: var(--slime-teal-ink); }
.tos-draw__panel--wont { background: var(--slime-pink-light); color: var(--slime-pink-ink); }
.tos-draw__panel--will li::before { content: '\2713\00a0\00a0'; font-weight: 700; }
.tos-draw__panel--wont li::before { content: '\2715\00a0\00a0'; font-weight: 700; }

.tos-point { scroll-margin-top: 16px; }
.tos-point__title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
    font-size: 21px;
    color: var(--slime-lavender-ink);
}
.tos-point__title .tos-num { width: 32px; height: 30px; font-size: 15px; }
.tos-point__body {
    max-width: 68ch;
    margin-bottom: 8px;
    font-size: 15px;
    line-height: 1.6;
    white-space: pre-line;
}
.tos-point__bullets {
    max-width: 66ch;
    margin-left: 20px;
    font-size: 15px;
    line-height: 1.6;
}
.tos-point__bullets li::marker { color: var(--slime-lavender-dark); }

@media (max-width: 899px) {
    .tos { grid-template-columns: 1fr; gap: 14px; padding: 6px 14px 0; }
    .tos-index { position: static; margin: 0 -14px; }
    .tos-index__list {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 0 14px 6px;
        scrollbar-width: none;
    }
    .tos-index__list li { flex: 0 0 auto; }
    .tos-index__link {
        padding: 5px 12px;
        font-size: 13px;
        white-space: nowrap;
        background: var(--slime-lavender-light);
        border-radius: 16px 20px 14px 18px;
    }
    .tos-index__link .tos-num { width: 20px; height: 19px; font-size: 11px; }
}

@media (max-width: 599px) {
    .tos-draw__panel { padding: 10px; }
    .tos-draw__panel h2 { font-size: 15px; }
    .tos-draw__panel ul { font-size: 12.5px; line-height: 1.55; }
    .tos-point__title { font-size: 18px; }
    .tos-point__body, .tos-point__bullets { font-size: 14px; }
}
```

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/split-tos.js src/components/first-visible.js src/hooks/useCurrentSection.js src/components/TosPointList.jsx src/pages/Tos.jsx public/styles.css tests/split-tos.test.js tests/first-visible.test.js tests/tos-point-list.test.js tests/tos-page.test.js
git commit -m "feat: add the terms index and will/won't draw panels

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Remove the panel and dead styles, guard the CSP

**Files:**
- Delete: `src/components/Panel.jsx`, `tests/panel.test.js`
- Modify: `public/styles.css`
- Create test: `tests/page-layouts-no-inline-style.test.js`

**Interfaces:**
- Consumes: `SiteBar`/`SiteLayout` (Task 3), `GalleryTiles` (Task 6), `GalleryCharacter` (Task 7), `CommissionsContent` (Task 8), `QueueCards` (Task 10), `TosContent` (Task 11).
- Produces: nothing new; this task only removes code.

- [ ] **Step 1: Write the guard test**

Create `tests/page-layouts-no-inline-style.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import SiteLayout from '../src/site/SiteLayout.jsx';
import { GalleryTiles } from '../src/components/GalleryIndexGrid.jsx';
import GalleryCharacter from '../src/pages/GalleryCharacter.jsx';
import { CommissionsContent } from '../src/pages/Commissions.jsx';
import { QueueCards } from '../src/components/QueueBoard.jsx';
import { TosContent } from '../src/components/TosPointList.jsx';

/*
 * The built-page test in render-pages.test.js only sees what the server
 * renders, and these pages fetch their content after hydration, so the
 * content itself never reaches that test. This renders every data-driven
 * layout with fixture data instead. The CSP drops inline style attributes
 * silently, so this is the only place such a regression would show up.
 */
const IMAGES = [{ url: 'https://example.com/a.png', thumbnail: true }, { url: 'https://example.com/b.png', nsfw: true }];

const FIXTURES = {
    layout: (
        <StaticRouter location="/gallery/">
            <SiteLayout><p>child</p></SiteLayout>
        </StaticRouter>
    ),
    gallery: <GalleryTiles characters={[{ slug: 'v', name: 'V', bio: 'b', images: IMAGES }]} />,
    character: <GalleryCharacter character={{ slug: 'v', name: 'V', species: 's', bio: 'b', images: IMAGES }} />,
    commissions: (
        <CommissionsContent
            data={{
                status: true,
                intro: 'i',
                specialOffer: 'o',
                tiers: [{ name: 't', price: '€1', description: 'd', example: 'https://example.com/t.png' }],
                pastWork: [{ url: 'https://example.com/p.png', nsfw: true }],
            }}
        />
    ),
    queue: (
        <QueueCards
            data={{
                columns: [{ id: 'a', name: 'A', enabled: true }, { id: 'b', name: 'B', enabled: true }],
                cards: [{ id: '1', columnId: 'a', title: 'x' }, { id: '2', columnId: 'b', title: 'y' }],
            }}
        />
    ),
    tos: <TosContent points={[{ title: 't', body: 'b', bullets: [{ type: 'yesno', text: 'y', value: true }] }]} />,
};

for (const [name, element] of Object.entries(FIXTURES)) {
    test(`${name} renders no inline style attribute`, () => {
        assert.doesNotMatch(renderToStaticMarkup(element), /\sstyle=/);
    });
}
```

- [ ] **Step 2: Run it**

Run: `node --test --import ./tests/jsx-loader.mjs tests/page-layouts-no-inline-style.test.js`
Expected: PASS, 6 tests. (This guard is written after the code on purpose. If it fails, a previous task introduced an inline style: fix that component, not the test.)

- [ ] **Step 3: Delete the panel**

```bash
git rm src/components/Panel.jsx tests/panel.test.js
```

Run: `grep -rn "Panel.jsx\|import Panel\|panel-wrapper\|panel--wide\|panel--xwide" src tests scripts`
Expected: no output. (`admin-panel` class names in Admin are unrelated and are not matched by this pattern.)

- [ ] **Step 4: Remove the dead CSS**

In `public/styles.css`:

Replace:

```css
.panel-wrapper, .datapad-wrapper {
```

with:

```css
.datapad-wrapper {
```

Delete these two blocks entirely:

```css
.panel-wrapper.panel--wide {
    max-width: 700px;
}

.panel-wrapper.panel--xwide {
    max-width: 1100px;
}
```

Replace:

```css
.panel, .datapad-screen {
```

with:

```css
.datapad-screen {
```

Delete these rule blocks entirely:

- `.gallery-empty { … }`
- `.tier-card, .past-work-card { … }`
- `.tier-card { margin-bottom: 14px; }`
- `.tier-card img, .past-work-card img { … }`

Keep `.back-link`, `.back-link:hover`, `.feed-error`, `.datapad-wrapper`, `.datapad-screen`, every `.char-image-wrap*` rule, `.nsfw-warning` and `.permalink-*`.

Run:

```bash
grep -nE "\.(panel|profile|links-grid|link-btn|section-title|gallery-empty|gallery-index|tier-card|tier-price|past-work-card|commission-status|commission-special-offer|queue-board-columns|queue-column|tos-bullet|char-species|char-bio|char-image-grid)\b|#commission-past-work" public/styles.css
```

Expected: no output.

Run:

```bash
grep -rn "tier-card\|gallery-empty\|feed-error\|back-link" src
```

Expected: no output. `feed-error` and `back-link` remain only in `functions/i/[id].js` and `public/styles.css`.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. `tests/panel.test.js` no longer exists, and `tests/render-pages.test.js`'s "no built page carries an inline style attribute" test still passes.

- [ ] **Step 6: Commit**

```bash
git add public/styles.css tests/page-layouts-no-inline-style.test.js
git commit -m "refactor: remove the shared panel and styles the new layouts replaced

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Manual browser pass

This repo has no browser test tooling, by decision of sub-projects 2 to 5. This task verifies layout, motion and hydration in a real browser, using the local Chromium harnesses in `.superpowers/sdd/` (gitignored). Write every finding to `.superpowers/sdd/2026-09-15-page-layouts/manual-pass.md` with the screenshot file names. Fix defects in their owning component in a separate `fix:` commit per defect, re-run `npm test`, and re-shoot the affected page.

**Files:**
- Create: `.superpowers/sdd/2026-09-15-page-layouts/console.mjs` (local harness, not committed)
- Create: `.superpowers/sdd/2026-09-15-page-layouts/manual-pass.md` (local notes, not committed)

- [ ] **Step 1: Build and serve**

```bash
npm run build
node .superpowers/sdd/2026-09-07-landing-hub/serve.mjs dist/client 8099
```

Run the server in the background. Confirm `curl -sf -o /dev/null http://localhost:8099/gallery/ && echo up` prints `up`.

- [ ] **Step 2: Capture every inner page at four widths**

The shell is fish, so write the page arguments out literally and don't pass them through a variable:

```bash
cd .superpowers/sdd/2026-09-15-page-layouts
node still.mjs http://localhost:8099 320 700 gallery=/gallery/ character=/gallery/vyphir/ commissions=/commissions/ queue=/queue/ tos=/tos/
node still.mjs http://localhost:8099 375 800 gallery=/gallery/ character=/gallery/vyphir/ commissions=/commissions/ queue=/queue/ tos=/tos/
node still.mjs http://localhost:8099 768 1000 gallery=/gallery/ character=/gallery/vyphir/ commissions=/commissions/ queue=/queue/ tos=/tos/
node still.mjs http://localhost:8099 1440 900 gallery=/gallery/ character=/gallery/vyphir/ commissions=/commissions/ queue=/queue/ tos=/tos/
```

Open each file in `shots/`. Check and record:

- **Bar:** fits at 320px with no horizontal scroll, shows "Comms" on phones, has exactly one filled blob with a dark rim, and its ribbon colour matches the page.
- **Gallery:** 1, 2 and 3 columns at 375, 768 and 1440; phone tiles edge to edge; the label never covers more than the bottom-left corner.
- **Character:** image beside the bio at 1440, stacked below 900; a grid of 2, 3 and 4 columns; square NSFW covers with readable white text.
- **Commissions:** sticker beside the intro on desktop and above it on phones; three tiers side by side at 1440 with no hint or dots; the next tier peeking in at 375 with the "3 tiers · swipe →" hint and dots.
- **Queue:** WIP first, then Sketch Provided, then In Queue; Finished last and faded; beads visible on every card.
- **Terms:** index on the left at 1440, a chip row below 900; draw panels above point 1.

Images that are still blank in a screenshot are usually still downloading. Re-shoot before recording them as a defect.

- [ ] **Step 3: Check transitions**

```bash
node .superpowers/sdd/2026-09-12-page-transitions/drive.mjs http://localhost:8099/gallery/ 'a.site-bead[href="/queue/"]' inner-to-inner 1440 900 120 350 700
node .superpowers/sdd/2026-09-12-page-transitions/drive.mjs http://localhost:8099/gallery/ 'a.site-bar__photo' inner-to-hub 1440 900 120 350 700
node .superpowers/sdd/2026-09-12-page-transitions/drive.mjs http://localhost:8099/ '.hub-item--commissions' hub-to-inner 1440 900 120 350 700
node .superpowers/sdd/2026-09-12-page-transitions/drive.mjs http://localhost:8099/gallery/ 'a.gallery-tile' gallery-to-character 375 800 120 350 700
REDUCED=1 node .superpowers/sdd/2026-09-12-page-transitions/drive.mjs http://localhost:8099/gallery/ 'a.site-bead[href="/tos/"]' reduced 1440 900 120 350
```

Shots land in `.superpowers/sdd/2026-09-12-page-transitions/shots/`. Record:

- **inner-to-inner:** the bar is identical in every frame, only content below it falls, and the Queue blob is highlighted by 700ms.
- **inner-to-hub:** the bar falls with the page.
- **hub-to-inner:** the incoming bar and page settle in together.
- **gallery-to-character:** the character page appears under the still bar.
- **reduced:** no falling pieces at any delay (`pieces: 0`, or no `.gd-piece` elements).
- The `pieces:` count each run prints: under 150.

- [ ] **Step 4: Check the console for hydration errors**

Create `.superpowers/sdd/2026-09-15-page-layouts/console.mjs`:

```js
/*
 * Load pages in headless Chromium and print every console message and
 * uncaught exception. React reports hydration mismatches through
 * console.error, which none of the screenshot harnesses capture.
 * Usage: node console.mjs <base-url> <path>...
 */
import { spawn } from 'node:child_process';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;
const [base, ...paths] = process.argv.slice(2);
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=9335', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
    for (let i = 0; i < 50; i++) {
        try {
            const list = await fetch('http://127.0.0.1:9335/json/list').then((r) => r.json());
            const page = list.find((t) => t.type === 'page');
            if (page) return page.webSocketDebuggerUrl;
        } catch {}
        await wait(200);
    }
    throw new Error('chrome did not come up');
}

const ws = new WebSocket(await endpoint());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
let current = '';
ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled') {
        console.log(`[${current}] console.${m.params.type}:`, m.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
        console.log(`[${current}] exception:`, m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    }
});
const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
for (const path of paths) {
    current = path;
    await send('Page.navigate', { url: base + path });
    await wait(3000);
}
console.log('done');
ws.close();
chrome.kill();
```

Run:

```bash
node .superpowers/sdd/2026-09-15-page-layouts/console.mjs http://localhost:8099 / /gallery/ /gallery/vyphir/ /gallery/blair/ /commissions/ /queue/ /tos/
```

Expected: only `done`. Any `console.error` mentioning hydration, or any exception, is a defect.

- [ ] **Step 5: Interact with the tier strip and the Terms index**

Resize a real desktop browser window to 375px wide, or use device emulation, on `http://localhost:8099/commissions/`:

- On load, the tiers slide left and back twice, then stop.
- Swiping moves the elongated dot, and the last dot lights up at the end.
- The honey scrollbar is visible under the strip.
- Tab reaches the strip, and the arrow keys scroll it.

On `http://localhost:8099/tos/` at 1440px:

- Scrolling moves the highlight down the index.
- Clicking "Refunds" jumps to it without a gravity-drop transition.
- Pressing Tab shows a focus ring on every index link, bar bead and tile.

- [ ] **Step 6: Firefox**

Firefox is the site owner's primary browser, and nothing above runs in it. If `.superpowers/sdd/2026-09-12-page-transitions/ff-drive.mjs` runs on this machine, repeat Step 3's inner-to-inner capture with it. Either way, ask the site owner to open `http://localhost:8099/gallery/` in Firefox and confirm the following:

1. The bar looks the same as in Chromium.
2. Clicking Queue keeps the bar still.
3. The tier strip scrollbar is honey-coloured.
4. The Terms index highlights while scrolling.

Record their answer in `manual-pass.md`. Do not mark this task complete without it.

- [ ] **Step 7: Stop the server and report**

Stop the background server. Summarise `manual-pass.md` for the site owner, including every defect found and the commit that fixed it.

---

## Self-Review Notes

- **Spec coverage:**

  | Spec section | Task(s) |
  |---|---|
  | §1 decisions | 3, 6–11 |
  | §2 breakpoints and frame | 3, 6 |
  | §3 bar | 1, 3 |
  | §4 layout route | 4 |
  | §5 SSR parity | 4 |
  | §6.1–6.5 pages | 6–11 |
  | §6.6 messages | 6, 10, 11 |
  | §7 transitions | 5 |
  | §8 tokens and removals | 2, 6–12 |
  | §9 CSP | every component test, plus 12 |
  | §10 accessibility | 3, 6–11 (focus rings, ARIA, reduced motion), 13 |
  | §11 testing | 1–12 |
  | §12 delivery phases | tasks 1–5 are phase 1, 6–7 phase 2, 8–9 phase 3, 10 phase 4, 11 phase 5, 12–13 phase 6 |

- **Deliberate deviation from spec §6.3:** the spec gives the tier strip `scroll-padding-inline` at every width. This plan applies it only on phones, where the strip has side padding; on tablet and desktop the strip has none, so the value is 0 there.
