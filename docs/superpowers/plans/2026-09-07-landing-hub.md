# Landing Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing page (`/`) as a radial navigation hub — circular profile photo centre-right, chunky outlined words pinned to its edge radiating outward, with hover emphasis and blob-framed preview art.

**Architecture:** `Landing.jsx` is rewritten as a full-bleed hub with hard-coded polar geometry constants (no runtime layout maths). Preview image URLs are selected at build time by a new pure module in `shared/`, rendered into the static HTML by a new `renderLanding` server export, and embedded on `#root` as `data-previews` so client hydration reads the same data — mirroring how character pages already embed their data. Below 900px the fan is replaced by a plain vertical list.

**Tech Stack:** React 18, React Router, Vite SSG via `scripts/render-pages.js`, `node --test` with `renderToStaticMarkup`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-07-landing-hub-design.md`

## Global Constraints

- No new npm dependencies.
- Do not touch `functions/`, `src/pages/Admin.jsx`, `src/components/admin/`, `public/admin/`, routing (`src/App.jsx`, `src/routes.js` route paths), or the CMS/publish flow.
- Preview blobs may only ever use images whose `nsfw` flag is falsy. The front page is never gated — this is a correctness requirement.
- All eight nav words are real `<a>` elements inside one `<nav>`, in DOM order: Gallery, Commissions, Instagram, Twitter, Bluesky, Telegram, Toyhouse, Steam.
- The six social links keep `target="_blank"` and `rel="noopener noreferrer"`.
- Fonts: Fredoka for the hub words, `#3A2A24` for ink/stroke. Colours come from the existing Slime tokens already in `public/styles.css`.
- Emphasis behaviour applies on `:hover` **and** `:focus-visible`.
- Under `prefers-reduced-motion: reduce`, no scaling and no pulse — opacity only.
- Existing test suite (182 tests at `0b4a634`) must stay green, adjusted where it asserts on deleted Landing markup.

---

### Task 1: Build-time preview selection

**Files:**
- Create: `shared/landing-previews.js`
- Test: `tests/landing-previews.test.js`

**Interfaces:**
- Produces: `selectLandingPreviews(charactersData, commissionsData)` → `{ gallery: string[], commissions: string[] }`, each array 0–4 image URL strings, NSFW entries excluded. Consumed by Task 2 (`scripts/render-pages.js`) and Task 4 (rendering).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLandingPreviews } from '../shared/landing-previews.js';

const characters = {
    characters: [
        { name: 'A', images: [{ url: 'a1.png', nsfw: false }, { url: 'a2.png' }] },
        { name: 'B', images: [{ url: 'b-nsfw.png', nsfw: true }, { url: 'b2.png' }] },
        { name: 'C', images: [{ url: 'c-nsfw.png', nsfw: true }] },
        { name: 'D', images: [] },
        { name: 'E', images: [{ url: 'e1.png' }] },
        { name: 'F', images: [{ url: 'f1.png' }] },
        { name: 'G', images: [{ url: 'g1.png' }] },
    ],
};

const commissions = {
    pastWork: [
        { url: 'p1.png' },
        { url: 'p-nsfw.png', nsfw: true },
        { url: 'p2.png', nsfw: false },
        { url: 'p3.png' },
        { url: 'p4.png' },
        { url: 'p5.png' },
    ],
};

test('picks each character\'s first non-NSFW image, capped at four', () => {
    const { gallery } = selectLandingPreviews(characters, commissions);
    assert.deepEqual(gallery, ['a1.png', 'b2.png', 'e1.png', 'f1.png']);
});

test('picks the first four non-NSFW past-work images', () => {
    const { commissions: got } = selectLandingPreviews(characters, commissions);
    assert.deepEqual(got, ['p1.png', 'p2.png', 'p3.png', 'p4.png']);
});

test('never returns an NSFW url', () => {
    const { gallery, commissions: got } = selectLandingPreviews(characters, commissions);
    for (const url of [...gallery, ...got]) assert.doesNotMatch(url, /nsfw/);
});

test('returns empty arrays for missing or empty data', () => {
    assert.deepEqual(selectLandingPreviews(null, null), { gallery: [], commissions: [] });
    assert.deepEqual(selectLandingPreviews({}, {}), { gallery: [], commissions: [] });
    assert.deepEqual(
        selectLandingPreviews({ characters: [{ name: 'X', images: [{ url: 'x.png', nsfw: true }] }] }, { pastWork: [] }),
        { gallery: [], commissions: [] }
    );
});

test('returns fewer than four when that is all that is eligible', () => {
    const { gallery } = selectLandingPreviews(
        { characters: [{ name: 'A', images: [{ url: 'only.png' }] }] },
        { pastWork: [] }
    );
    assert.deepEqual(gallery, ['only.png']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/landing-previews.test.js`
Expected: FAIL — cannot find module `../shared/landing-previews.js`

- [ ] **Step 3: Write minimal implementation**

```js
const MAX_PREVIEWS = 4;

function firstSafeImageUrl(character) {
    const image = (character?.images || []).find((img) => !img?.nsfw && img?.url);
    return image ? image.url : null;
}

export function selectLandingPreviews(charactersData, commissionsData) {
    const gallery = [];
    for (const character of charactersData?.characters || []) {
        if (gallery.length >= MAX_PREVIEWS) break;
        const url = firstSafeImageUrl(character);
        if (url) gallery.push(url);
    }

    const commissions = [];
    for (const item of commissionsData?.pastWork || []) {
        if (commissions.length >= MAX_PREVIEWS) break;
        if (!item?.nsfw && item?.url) commissions.push(item.url);
    }

    return { gallery, commissions };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/landing-previews.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add shared/landing-previews.js tests/landing-previews.test.js
git commit -m "feat: add build-time landing preview selection with NSFW filtering"
```

---

### Task 2: Bake previews into the static build

**Files:**
- Modify: `src/entry-server.jsx` (add a `renderLanding` export)
- Modify: `scripts/render-pages.js` (`renderShell` root attrs; `main()` route loop)
- Test: `tests/render-pages.test.js` (add cases)

**Interfaces:**
- Consumes: `selectLandingPreviews` from Task 1.
- Produces: `renderLanding(previews)` → `{ html }` from `src/entry-server.jsx`; `#root` on `/` carries `data-previews="<json>"`. Task 3 reads that attribute client-side; Task 4 consumes the `previews` prop shape `{ gallery: string[], commissions: string[] }`.

- [ ] **Step 1: Add the server render export**

In `src/entry-server.jsx`, add the import and export (keep the existing `render` and `renderCharacter` untouched):

```jsx
import Landing from './pages/Landing.jsx';

export function renderLanding(previews) {
    const html = renderToString(<Landing previews={previews} />);
    return { html };
}
```

- [ ] **Step 2: Emit the previews attribute in the shell**

In `scripts/render-pages.js`, `renderShell` currently builds `rootAttrs` from `embeddedData` only. Replace that single line:

```js
    const rootAttrs = embeddedData ? ` data-character="${escapeHtml(JSON.stringify(embeddedData))}"` : '';
```

with:

```js
    const characterAttr = embeddedData ? ` data-character="${escapeHtml(JSON.stringify(embeddedData))}"` : '';
    const previewsAttr = previewData ? ` data-previews="${escapeHtml(JSON.stringify(previewData))}"` : '';
    const rootAttrs = `${characterAttr}${previewsAttr}`;
```

and add `previewData` to `renderShell`'s destructured parameter list, immediately after `embeddedData`.

- [ ] **Step 3: Select previews and use them for `/` in the route loop**

In `scripts/render-pages.js`, add to the imports at the top:

```js
import { selectLandingPreviews } from '../shared/landing-previews.js';
```

In `main()`, after the `const { render, routes } = await import(...)` line, add:

```js
    const { renderLanding } = await import(join(projectRoot, 'dist-server', 'entry-server.js'));
    const charactersRaw = await readFile(join(projectRoot, 'data', 'characters.json'), 'utf8');
    const commissionsRaw = await readFile(join(projectRoot, 'data', 'commissions.json'), 'utf8');
    const landingPreviews = selectLandingPreviews(JSON.parse(charactersRaw), JSON.parse(commissionsRaw));
```

Then inside the `for (const route of routes)` loop, replace the existing `const { html } = render(route.path);` line with:

```js
        const isLanding = route.path === '/';
        const { html } = isLanding ? renderLanding(landingPreviews) : render(route.path);
```

and where `writeRoute` is called for that route, pass the previews through by extending the resolved route for `/`:

```js
        const routeWithData = isLanding ? { ...resolvedRoute, previewData: landingPreviews } : resolvedRoute;
```

then call `writeRoute({ route: routeWithData, html, script, css })`.

- [ ] **Step 4: Write the failing build tests**

Add to `tests/render-pages.test.js` (follow the file's existing helper for reading built pages; if it reads `dist/client/<path>/index.html`, use the same helper):

```js
test('the landing page embeds preview data on #root', () => {
    const html = readBuiltPage('/');
    assert.match(html, /<div id="root" data-previews="/);
});

test('the landing page bakes in preview image urls', () => {
    const html = readBuiltPage('/');
    assert.match(html, /res\.cloudinary\.com/);
});

test('no other routable page carries preview data', () => {
    for (const path of ['/gallery/', '/commissions/', '/tos/', '/queue/']) {
        assert.doesNotMatch(readBuiltPage(path), /data-previews=/);
    }
});
```

- [ ] **Step 5: Run the build and the tests**

Run: `npm test`
Expected: the three new tests PASS; the whole suite stays green. If `readBuiltPage` is not the helper name in that file, use whatever it actually defines — do not add a second helper.

- [ ] **Step 6: Commit**

```bash
git add src/entry-server.jsx scripts/render-pages.js tests/render-pages.test.js
git commit -m "feat: bake landing preview images into the static build"
```

---

### Task 3: Landing hub markup

**Files:**
- Modify: `src/pages/Landing.jsx` (full rewrite of the component body)
- Test: `tests/landing-page.test.js` (full rewrite of assertions)

**Interfaces:**
- Consumes: `previews` prop `{ gallery: string[], commissions: string[] }` from Task 2, falling back to `#root`'s `data-previews` when the prop is absent (client hydration).
- Produces: the `.hub-*` class names Task 4 styles: `.hub`, `.hub-slab`, `.hub-anchor`, `.hub-photo`, `.hub-nav`, `.hub-item`, `.hub-word`, `.hub-blob`. Per-item CSS custom properties `--rot`, `--fs`, `--c`, `--stroke`, `--blobw`, `--blobx`.

- [ ] **Step 1: Write the failing tests**

Replace the whole body of `tests/landing-page.test.js` (keep its existing imports of `test`, `assert`, `renderToStaticMarkup` and `Landing`):

```js
const PREVIEWS = { gallery: ['g1.png', 'g2.png'], commissions: ['c1.png', 'c2.png'] };

test('renders exactly eight nav links in spec order', () => {
    const html = renderToStaticMarkup(<Landing previews={PREVIEWS} />);
    const hrefs = [...html.matchAll(/<a class="hub-item"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, [
        '/gallery/',
        '/commissions/',
        'https://www.instagram.com/vyphir',
        'https://x.com/Vyphirr',
        'https://bsky.app/profile/samisaderp.bsky.social',
        'https://t.me/Samisaderp#',
        'https://toyhou.se/samisaderp/characters',
        'https://steamcommunity.com/profiles/76561199191219060/',
    ]);
});

test('wraps the nav links in a nav element', () => {
    const html = renderToStaticMarkup(<Landing previews={PREVIEWS} />);
    assert.match(html, /<nav class="hub-nav">/);
});

test('external links open in a new tab with a safe rel', () => {
    const html = renderToStaticMarkup(<Landing previews={PREVIEWS} />);
    const externals = html.match(/<a class="hub-item"[^>]*href="https:\/\/[^"]+"[^>]*>/g) || [];
    assert.equal(externals.length, 6);
    for (const tag of externals) {
        assert.match(tag, /target="_blank"/);
        assert.match(tag, /rel="noopener noreferrer"/);
    }
});

test('the photo is a link home labelled Home', () => {
    const html = renderToStaticMarkup(<Landing previews={PREVIEWS} />);
    assert.match(html, /<a class="hub-photo" href="\/" aria-label="Home">/);
});

test('renders the preview images inside the gallery and commissions blobs', () => {
    const html = renderToStaticMarkup(<Landing previews={PREVIEWS} />);
    for (const url of ['g1.png', 'g2.png', 'c1.png', 'c2.png']) {
        assert.match(html, new RegExp(`href="${url}"`));
    }
});

test('falls back to a flat blob when a preview set is empty', () => {
    const html = renderToStaticMarkup(<Landing previews={{ gallery: [], commissions: [] }} />);
    assert.doesNotMatch(html, /<image /);
});

test('decorative slabs and blobs are hidden from assistive tech', () => {
    const html = renderToStaticMarkup(<Landing previews={PREVIEWS} />);
    const slabs = html.match(/<div class="hub-slab[^"]*"[^>]*>/g) || [];
    assert.equal(slabs.length, 3);
    for (const tag of slabs) assert.match(tag, /aria-hidden="true"/);
    for (const tag of html.match(/<svg class="hub-blob"[^>]*>/g) || []) {
        assert.match(tag, /aria-hidden="true"/);
    }
});

test('no longer renders the Panel wrapper, the bluesky feed or the preview strips', () => {
    const html = renderToStaticMarkup(<Landing previews={PREVIEWS} />);
    assert.doesNotMatch(html, /panel-wrapper/);
    assert.doesNotMatch(html, /bsky/i);
    assert.doesNotMatch(html, /gallery-container/);
    assert.doesNotMatch(html, /commissions-preview-grid/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/landing-page.test.js`
Expected: FAIL — the old Landing markup has none of these classes.

- [ ] **Step 3: Rewrite `src/pages/Landing.jsx`**

Replace the entire file:

```jsx
import { useState } from 'react';

const BLOB_PATHS = {
    1: 'M45,10 C80,0 130,5 160,35 C190,65 195,115 170,150 C145,185 90,195 55,175 C20,155 5,110 15,70 C22,45 25,18 45,10 Z',
    2: 'M60,15 C100,-5 150,15 175,55 C195,90 185,140 150,170 C115,198 55,195 25,160 C0,130 5,80 25,50 C35,35 45,22 60,15 Z',
    3: 'M90,5 C130,0 175,25 185,65 C195,105 175,150 135,175 C95,198 45,190 20,155 C-5,120 5,70 35,40 C55,20 70,8 90,5 Z',
    4: 'M50,25 C85,0 140,0 170,30 C200,60 195,110 165,145 C135,180 75,190 40,165 C5,140 0,90 15,60 C25,40 35,32 50,25 Z',
};

const ITEMS = [
    { key: 'gallery', label: 'Gallery', href: '/gallery/', external: false, blob: 1, tint: '#C6F5EF', flat: '#C6F5EF', preview: 'gallery',
      style: { left: '-113px', top: '-106px', '--rot': '43deg', '--fs': '44px', '--c': '#23C9B7', '--stroke': '3px', '--blobw': '360px', '--blobx': '34%' } },
    { key: 'commissions', label: 'Commissions', href: '/commissions/', external: false, blob: 3, tint: '#FFEDB0', flat: '#FFEDB0', preview: 'commissions',
      style: { left: '-142px', top: '-62px', '--rot': '23deg', '--fs': '44px', '--c': '#FFC93C', '--stroke': '3px', '--blobw': '420px', '--blobx': '32%' } },
    { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/vyphir', external: true, blob: 2, flat: '#FFD3E4',
      style: { left: '-154px', top: '-21px', '--rot': '8deg', '--fs': '26px', '--c': '#FF6FA0', '--stroke': '2px', '--blobw': '170px' } },
    { key: 'twitter', label: 'Twitter', href: 'https://x.com/Vyphirr', external: true, blob: 4, flat: '#E7D8FF',
      style: { left: '-155px', top: '10px', '--rot': '-4deg', '--fs': '24px', '--c': '#B98CFF', '--stroke': '2px', '--blobw': '150px' } },
    { key: 'bluesky', label: 'Bluesky', href: 'https://bsky.app/profile/samisaderp.bsky.social', external: true, blob: 1, flat: '#C6F5EF',
      style: { left: '-150px', top: '39px', '--rot': '-15deg', '--fs': '23px', '--c': '#23C9B7', '--stroke': '2px', '--blobw': '145px' } },
    { key: 'telegram', label: 'Telegram', href: 'https://t.me/Samisaderp#', external: true, blob: 2, flat: '#FFE0BE',
      style: { left: '-141px', top: '64px', '--rot': '-25deg', '--fs': '21px', '--c': '#FF9A44', '--stroke': '2px', '--blobw': '135px' } },
    { key: 'toyhouse', label: 'Toyhouse', href: 'https://toyhou.se/samisaderp/characters', external: true, blob: 3, flat: '#FFD3E4',
      style: { left: '-129px', top: '87px', '--rot': '-34deg', '--fs': '20px', '--c': '#FF6FA0', '--stroke': '2px', '--blobw': '125px' } },
    { key: 'steam', label: 'Steam', href: 'https://steamcommunity.com/profiles/76561199191219060/', external: true, blob: 4, flat: '#E7D8FF',
      style: { left: '-113px', top: '106px', '--rot': '-43deg', '--fs': '19px', '--c': '#B98CFF', '--stroke': '2px', '--blobw': '115px' } },
];

const PHOTO_URL = 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401';

function readEmbeddedPreviews() {
    if (typeof document === 'undefined') return null;
    const raw = document.getElementById('root')?.dataset.previews;
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function PreviewBlob({ item, images }) {
    const path = BLOB_PATHS[item.blob];
    const clipId = `hub-clip-${item.key}`;
    const cells = [[0, 0], [100, 0], [0, 100], [100, 100]];
    return (
        <svg className="hub-blob" viewBox="0 0 200 200" aria-hidden="true">
            <defs><clipPath id={clipId}><path d={path} /></clipPath></defs>
            <g clipPath={`url(#${clipId})`}>
                {images.map((url, i) => (
                    <image
                        key={url}
                        href={url}
                        x={cells[i % 4][0]}
                        y={cells[i % 4][1]}
                        width="100"
                        height="100"
                        preserveAspectRatio="xMidYMid slice"
                    />
                ))}
                <rect x="0" y="0" width="200" height="200" fill={item.tint} opacity=".33" />
            </g>
            <path d={path} fill="none" stroke="#3A2A24" strokeWidth="4" />
        </svg>
    );
}

function FlatBlob({ item }) {
    return (
        <svg className="hub-blob" viewBox="0 0 200 200" aria-hidden="true">
            <path d={BLOB_PATHS[item.blob]} fill={item.flat} />
        </svg>
    );
}

export default function Landing({ previews }) {
    const [embedded] = useState(readEmbeddedPreviews);
    const data = previews || embedded || { gallery: [], commissions: [] };

    return (
        <div className="page-pink hub">
            <div className="hub-slab hub-slab--teal" aria-hidden="true" />
            <div className="hub-slab hub-slab--pink" aria-hidden="true" />
            <div className="hub-slab hub-slab--honey" aria-hidden="true" />

            <div className="hub-anchor">
                <a className="hub-photo" href="/" aria-label="Home">
                    <img src={PHOTO_URL} alt="" />
                </a>

                <nav className="hub-nav">
                    {ITEMS.map((item) => {
                        const images = item.preview ? (data[item.preview] || []) : [];
                        const external = item.external
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {};
                        return (
                            <a className="hub-item" key={item.key} href={item.href} style={item.style} {...external}>
                                {images.length > 0
                                    ? <PreviewBlob item={item} images={images} />
                                    : <FlatBlob item={item} />}
                                <span className="hub-word">{item.label}</span>
                            </a>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/landing-page.test.js`
Expected: PASS, 8 tests. The page will be unstyled until Task 4 — that is expected.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.jsx tests/landing-page.test.js
git commit -m "feat: rebuild landing page as radial navigation hub markup"
```

---

### Task 4: Hub styling — fan, emphasis, mobile

**Files:**
- Modify: `public/styles.css` (add the hub block; remove Landing-only rules listed in Task 5)

**Interfaces:**
- Consumes: the class names and custom properties produced by Task 3.

- [ ] **Step 1: Add the hub styles**

Append to `public/styles.css` (before the `.wave-text-letter` block, or at the end — placement is not load-bearing):

```css
.hub {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    isolation: isolate;
}

.hub-slab { position: absolute; z-index: 0; }
.hub-slab--teal {
    inset: -8% -6% auto -6%; height: 72%;
    background: var(--slime-teal-light);
    clip-path: polygon(0 0, 100% 0, 100% 58%, 0 100%);
}
.hub-slab--pink {
    left: -8%; top: 6%; width: 58%; height: 80%;
    background: var(--slime-pink-light);
    clip-path: polygon(9% 2%, 100% 0, 91% 97%, 0 86%);
    transform: rotate(-3deg);
    z-index: 1;
}
.hub-slab--honey {
    left: 4%; top: 58%; width: 30%; height: 26%;
    background: var(--slime-honey-light);
    clip-path: polygon(4% 8%, 100% 0, 92% 100%, 0 88%);
    transform: rotate(4deg);
    opacity: .85;
    z-index: 1;
}

.hub-anchor {
    position: absolute; left: 72%; top: 50%;
    width: 0; height: 0;
    z-index: 10;
}

.hub-photo {
    position: absolute; left: 0; top: 0;
    transform: translate(-50%, -50%);
    width: 290px; height: 290px;
    border-radius: 50%;
    overflow: hidden;
    border: 5px solid var(--text-ink);
    box-shadow: 12px 12px 0 rgba(58, 42, 36, .20);
    z-index: 12;
    display: block;
    transition: transform .3s cubic-bezier(.34, 1.56, .64, 1);
}
.hub-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hub-photo:hover, .hub-photo:focus-visible { transform: translate(-50%, -50%) scale(1.04) rotate(-2deg); }

.hub-item {
    position: absolute;
    transform-origin: 100% 50%;
    transform: translate(-100%, -50%) rotate(var(--rot)) scale(1);
    transition: transform .28s cubic-bezier(.34, 1.56, .64, 1), opacity .28s ease;
    z-index: 15;
    white-space: nowrap;
    text-decoration: none;
    outline: none;
}

.hub-word {
    position: relative;
    font-family: 'Fredoka', sans-serif;
    font-weight: 700;
    font-size: var(--fs);
    line-height: 1;
    color: var(--c);
    -webkit-text-stroke: var(--stroke) var(--text-ink);
    paint-order: stroke fill;
    text-transform: uppercase;
    letter-spacing: -.5px;
    filter: drop-shadow(3px 3px 0 rgba(58, 42, 36, .20));
}

.hub-blob {
    position: absolute;
    top: 50%; left: var(--blobx, 50%);
    width: var(--blobw); height: var(--blobw);
    transform: translate(-50%, -50%) scale(.5) rotate(0deg);
    opacity: 0;
    transition: transform .34s cubic-bezier(.34, 1.56, .64, 1), opacity .34s ease;
    z-index: -1;
    pointer-events: none;
}

.hub-item:hover, .hub-item:focus-visible {
    transform: translate(-100%, -50%) rotate(var(--rot)) scale(1.18);
    z-index: 24;
}
.hub-item:hover .hub-blob, .hub-item:focus-visible .hub-blob {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotate(6deg);
    animation: hub-blob-pulse 2.6s ease-in-out infinite;
}
.hub-nav:has(.hub-item:hover) .hub-item:not(:hover),
.hub-nav:has(.hub-item:focus-visible) .hub-item:not(:focus-visible) {
    transform: translate(-100%, -50%) rotate(var(--rot)) scale(.84);
    opacity: .42;
}

@keyframes hub-blob-pulse {
    0%, 100% { transform: translate(-50%, -50%) scale(1) rotate(5deg); }
    50% { transform: translate(-50%, -50%) scale(1.05) rotate(9deg); }
}

@media (max-width: 1199px) and (min-width: 1000px) {
    .hub-anchor { transform: scale(.82); }
}
@media (max-width: 999px) and (min-width: 900px) {
    .hub-anchor { transform: scale(.72); }
}

@media (prefers-reduced-motion: reduce) {
    .hub-item, .hub-blob, .hub-photo { transition: opacity .2s ease; }
    .hub-item:hover, .hub-item:focus-visible {
        transform: translate(-100%, -50%) rotate(var(--rot));
    }
    .hub-photo:hover, .hub-photo:focus-visible { transform: translate(-50%, -50%); }
    .hub-item:hover .hub-blob, .hub-item:focus-visible .hub-blob {
        animation: none;
        transform: translate(-50%, -50%) scale(1);
    }
    .hub-nav:has(.hub-item:hover) .hub-item:not(:hover),
    .hub-nav:has(.hub-item:focus-visible) .hub-item:not(:focus-visible) {
        transform: translate(-100%, -50%) rotate(var(--rot));
        opacity: .42;
    }
}

@media (max-width: 899px) {
    .hub { min-height: auto; padding: 30px 20px 50px; }
    .hub-slab--honey { display: none; }
    .hub-anchor {
        position: static;
        width: auto; height: auto;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .hub-photo {
        position: static;
        transform: none;
        width: 180px; height: 180px;
        margin-bottom: 26px;
    }
    .hub-photo:hover, .hub-photo:focus-visible { transform: none; }
    .hub-nav {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 14px;
        width: 100%;
        max-width: 320px;
    }
    .hub-item {
        position: static;
        transform: none;
    }
    .hub-item:hover, .hub-item:focus-visible { transform: none; }
    .hub-nav:has(.hub-item:hover) .hub-item:not(:hover),
    .hub-nav:has(.hub-item:focus-visible) .hub-item:not(:focus-visible) {
        transform: none;
        opacity: 1;
    }
    .hub-item .hub-blob { display: none; }
    .hub-item[href="/gallery/"] .hub-word { font-size: 34px; }
    .hub-item[href="/commissions/"] .hub-word { font-size: 34px; }
    .hub-word { font-size: 22px; }
}
```

- [ ] **Step 2: Verify the suite is still green**

Run: `npm test`
Expected: all tests pass — this task is CSS-only and asserts nothing new.

- [ ] **Step 3: Verify in a browser**

Run: `npm run build && npx wrangler pages dev dist/client` (if wrangler is unavailable, `npm run dev` is acceptable). Check at 1280px, 1100px, 950px and 375px widths:
- the fan reads as a fan, no word overlaps another, none overlap the photo;
- hovering a word grows it outward and fills Gallery's and Commissions' blobs with art;
- tabbing through the words produces the same emphasis;
- at 375px the layout is the vertical list with no rotation.

Note any problems in the task report rather than silently adjusting the spec's numbers.

- [ ] **Step 4: Commit**

```bash
git add public/styles.css
git commit -m "feat: style the landing hub fan, emphasis states and mobile list"
```

---

### Task 5: Remove the superseded landing components

**Files:**
- Delete: `src/components/BlueskyFeed.jsx`, `src/components/CharacterGalleryStrip.jsx`, `src/components/CommissionsPreviewStrip.jsx`, `tests/bluesky-feed.test.js`
- Modify: `public/styles.css` (remove dead rules)

**Interfaces:** none — this task only removes code Task 3 orphaned.

- [ ] **Step 1: Confirm the components are orphaned**

Run: `grep -rn "BlueskyFeed\|CharacterGalleryStrip\|CommissionsPreviewStrip" src/ tests/ scripts/`
Expected: matches only inside the four files being deleted. If anything else references them, stop and report it — do not delete a component that is still used.

- [ ] **Step 2: Delete the files**

```bash
git rm src/components/BlueskyFeed.jsx src/components/CharacterGalleryStrip.jsx src/components/CommissionsPreviewStrip.jsx tests/bluesky-feed.test.js
```

- [ ] **Step 3: Remove the dead CSS**

Class usage across the tree was verified while writing this plan. Delete **only** these rules from `public/styles.css` (each one, plus any `@media` variant of it):

`.sys-header`, `.status-light`, `.avatar-frame`, `.avatar`, `.commissions-cta` (and its `:hover`), `.gallery-container` and the whole `.gallery-card` family including scrollbar rules, `.commissions-preview-grid` (and its `img` / `img:hover` rules), `.feed-container`, `.feed-loading-placeholder`, `.bsky-init-heading` and every other `.bsky-*` rule.

**Do NOT delete these — they are shared and other pages still render them:**

| Rule | Still used by |
|---|---|
| `.profile`, `.profile h1`, `.profile p` | `src/pages/GalleryCharacter.jsx` |
| `.links-grid` | `src/pages/Commissions.jsx` |
| `.section-title`, `.section-title i` | `src/pages/Commissions.jsx` |
| `.link-btn` and variants | `src/components/LinkButton.jsx` (Commissions) and `functions/i/[id].js` |
| `.feed-error` | TosPointList, QueueBoard, GalleryIndexGrid, Commissions, `functions/i/[id].js` |

`functions/i/[id].js` is off-limits to edit but its class names still need their CSS. If a rule you are about to delete is not on the delete list above, leave it and note it in the task report.

- [ ] **Step 4: Verify nothing regressed**

Run: `npm test`
Expected: full suite green. The Bluesky feed tests are gone, so the count drops accordingly.

Run: `grep -rn "bsky\|BlueskyFeed" src/ public/styles.css`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove bluesky feed and preview strips superseded by the hub"
```

---

### Task 6: Final sweep

**Files:** none modified unless the sweep finds something.

- [ ] **Step 1: Sweep for orphaned references**

```bash
grep -rn "CtaButton\|WaveText" src/pages/Landing.jsx
grep -rn "gallery-container\|commissions-preview-grid\|bsky" src/ public/styles.css
```

Expected: no matches. Anything found is a leftover from Tasks 3 or 5 — fix it here.

- [ ] **Step 2: Confirm the untouched surfaces really are untouched**

```bash
git diff --name-only 0b4a634..HEAD
```

Expected: no file under `functions/`, `src/components/admin/`, `public/admin/`, and no change to `src/App.jsx` or the route paths in `src/routes.js`.

- [ ] **Step 3: Full suite and build**

Run: `npm test`
Expected: green.

- [ ] **Step 4: Manual browser checklist**

Serve the build and confirm on `/`:
- contrast of every outlined word over whichever slab sits behind it is comfortable;
- Gallery and Commissions blobs show real art, and no NSFW image appears (cross-check against `data/characters.json` and `data/commissions.json` `nsfw` flags);
- the other pages (`/gallery/`, `/commissions/`, `/tos/`, `/queue/`, a character page) still have working back-links to `/`;
- with OS reduced-motion enabled, hovering produces no scaling or pulsing.

Record the outcome in the task report. If this environment has no browser access, say so explicitly rather than claiming the checks passed.

- [ ] **Step 5: Commit any fixes**

If Step 1 or 2 required changes:

```bash
git add -A
git commit -m "fix: sweep leftovers from the landing hub migration"
```

If nothing needed fixing, no commit is required for this task.

---

## Self-Review Notes

- **Spec coverage:** §1 composition → Tasks 3 and 4; §2 hover/focus/reduced-motion → Task 4; §3 mobile → Task 4; §4 preview blobs → Tasks 1, 2, 3; §5 structure/accessibility → Task 3 (markup, aria, order) and Task 4 (focus-visible styling); §6 deletions → Task 5; §7 testing → tests in Tasks 1, 2, 3; §8 done-when → Task 6.
- **Back-links:** the spec calls for them to stay, "restyled only as much as needed". The existing `.back-link` rule already matches the Slime system, so no task changes it — Task 6 only verifies the links still work. This is deliberate, not an omission.
- **Shared CSS survives on purpose:** `.profile`, `.links-grid`, `.section-title`, `.link-btn` and `.feed-error` all look like Landing rules but are rendered by GalleryCharacter, Commissions, several shared components and the permalink function. Task 5's table keeps them explicitly. A reviewer should not read their survival as a missed deletion.
- **No new dependencies**, consistent with the global constraint; the preview blobs are plain inline SVG.
