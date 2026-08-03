# Media Server / Shareable Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every content image (character gallery images, commission past-work images) clickable to enlarge, give each one a stable shareable URL at `/i/<id>` that produces a rich embed on Discord/WhatsApp for SFW images (and a plain link for NSFW images), and add a `/gallery` overview page listing all characters.

**Architecture:** A new Cloudflare Pages Function (`functions/i/[id].js`) serves a permalink page per image — this single page is both the "enlarge" view and the shareable/embeddable URL. A shared client-side helper (`shared/enlargeable.js`) turns gallery images into links to those permalinks. `/gallery` is a new static page following the existing client-fetch pattern (`script.js` fetching `/data/characters.json`).

**Tech Stack:** Vanilla ES modules (no framework, no bundler), Cloudflare Pages + Pages Functions, `node:test` for unit tests. No new dependencies.

## Global Constraints

- No new npm dependencies — this project has zero runtime dependencies and `node:test` is the only test tool (see `package.json`).
- Every image's permalink ID is the UUID already embedded in its Cloudinary URL (`functions/api/_shared/cloudinary.js` uses `crypto.randomUUID()` as the `public_id`) — no data migration, no new fields in `data/characters.json` or `data/commissions.json`.
- CSP on every page/response must stay at least as strict as the existing policy: `default-src 'self'; script-src 'self' https://unpkg.com 'sha256-AhZyvNDdNRAqtFnGIp3LP8YpNDaE+qnvQ7qQk+5LG08='; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self';` (copy verbatim; extend only when a page needs an extra style/font host, same as `commissions/index.html` does for `cdnjs.cloudflare.com`).
- NSFW images (`nsfw: true`) must never get an `og:image`/`twitter:image` meta tag — permalinks for NSFW images are plain-link-only embeds. This is a deliberate content-safety rule, not an oversight.
- Follow the codebase's existing test boundary: pure logic in `shared/` and `functions/` gets `node:test` coverage (see `tests/slugify.test.js`, `tests/publish-character.test.js`); browser-only DOM scripts that call `document.addEventListener` at the top level (`script.js`, `gallery/character.js`, `commissions/commissions.js`, `nsfw-reveal.js`) do not — they're verified manually in-browser. Don't add DOM/jsdom tooling to work around this; it doesn't exist in this codebase today.
- Follow existing code style: 4-space indentation, no semicolon-free style, ES modules everywhere, `export function` for testable pure functions.

---

### Task 1: Extract `escapeHtml` into a shared module

**Files:**
- Create: `shared/escape-html.js`
- Modify: `scripts/generate-characters.js` (remove local `escapeHtml`, import from shared)
- Test: `tests/escape-html.test.js`

**Interfaces:**
- Produces: `escapeHtml(value: unknown): string` — exported from `shared/escape-html.js`. Used by Task 3 (`functions/i/[id].js`).

- [ ] **Step 1: Write the failing test**

Create `tests/escape-html.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../shared/escape-html.js';

test('escapes the five HTML-sensitive characters', () => {
    assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

test('coerces null and undefined to an empty string', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
});

test('coerces non-string values to strings', () => {
    assert.equal(escapeHtml(42), '42');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/escape-html.test.js`
Expected: FAIL — `Cannot find module '../shared/escape-html.js'`

- [ ] **Step 3: Create the shared module**

Create `shared/escape-html.js`:

```js
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
```

- [ ] **Step 4: Update `scripts/generate-characters.js` to use the shared module**

In `scripts/generate-characters.js`, replace the local `escapeHtml` function (lines 5-12) and its usage:

```js
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../shared/escape-html.js';
```

Delete the old local `function escapeHtml(value) { ... }` block entirely (it's now imported instead).

- [ ] **Step 5: Run the new test and the existing generate-characters tests**

Run: `node --test tests/escape-html.test.js tests/generate-characters.test.js`
Expected: PASS — all tests green (the existing escaping tests in `generate-characters.test.js` still pass unchanged since `generateCharacterPages`'s behavior didn't change).

- [ ] **Step 6: Commit**

```bash
git add shared/escape-html.js scripts/generate-characters.js tests/escape-html.test.js
git commit -m "refactor: extract escapeHtml into shared/escape-html.js"
```

---

### Task 2: Image ID helper

**Files:**
- Create: `shared/image-id.js`
- Test: `tests/image-id.test.js`

**Interfaces:**
- Produces: `extractImageId(url: string): string` — pulls the filename (minus extension, minus query/hash) from a URL path. Used by Task 3 (`functions/i/[id].js`) and Task 4 (`shared/enlargeable.js`).

- [ ] **Step 1: Write the failing test**

Create `tests/image-id.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImageId } from '../shared/image-id.js';

test('extracts the filename without extension', () => {
    assert.equal(
        extractImageId('https://res.cloudinary.com/l89vlr4i/image/upload/v123/vyphir/characters/392a6c2d-d49f-45fd-9b74-351e1e5cec69.png'),
        '392a6c2d-d49f-45fd-9b74-351e1e5cec69'
    );
});

test('strips query strings and hash fragments', () => {
    assert.equal(extractImageId('https://example.com/img/abc-123.jpg?w=200'), 'abc-123');
    assert.equal(extractImageId('https://example.com/img/abc-123.jpg#frag'), 'abc-123');
});

test('handles a url with no file extension', () => {
    assert.equal(extractImageId('https://example.com/img/abc-123'), 'abc-123');
});

test('returns an empty string for an empty or nullish url', () => {
    assert.equal(extractImageId(''), '');
    assert.equal(extractImageId(undefined), '');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/image-id.test.js`
Expected: FAIL — `Cannot find module '../shared/image-id.js'`

- [ ] **Step 3: Implement**

Create `shared/image-id.js`:

```js
export function extractImageId(url) {
    const path = String(url ?? '').split(/[?#]/)[0];
    const filename = path.split('/').pop() || '';
    return filename.replace(/\.[^./]+$/, '');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/image-id.test.js`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add shared/image-id.js tests/image-id.test.js
git commit -m "feat: add extractImageId helper for permalink IDs"
```

---

### Task 3: `/i/[id]` permalink Pages Function

**Files:**
- Create: `functions/i/[id].js`
- Test: `tests/permalink.test.js`

**Interfaces:**
- Consumes: `escapeHtml` from `../../shared/escape-html.js` (Task 1), `extractImageId` from `../../shared/image-id.js` (Task 2).
- Produces: `findImageById(charactersData, commissionsData, id): { kind: 'character'|'commission', url: string, nsfw: boolean, title: string, description: string, backHref: string } | null` and `onRequestGet(context): Promise<Response>` — both exported for testing. Cloudflare Pages auto-routes `GET /i/:id` to `onRequestGet`.

- [ ] **Step 1: Write the failing tests for `findImageById`**

Create `tests/permalink.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { findImageById, onRequestGet } from '../functions/i/[id].js';

const characters = {
    characters: [
        {
            name: 'Vyphir',
            species: 'Mainecoon Cat',
            bio: 'A cat.\nSecond line.',
            slug: 'vyphir',
            images: [
                { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/aaa-111.png', nsfw: false },
                { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/bbb-222.png', nsfw: true },
            ],
        },
    ],
};

const commissions = {
    pastWork: [
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/commissions/ccc-333.png', caption: 'Fanart' },
    ],
};

test('finds a character image by id', () => {
    const result = findImageById(characters, commissions, 'aaa-111');
    assert.equal(result.kind, 'character');
    assert.equal(result.title, 'Vyphir');
    assert.equal(result.nsfw, false);
    assert.equal(result.backHref, '/gallery/vyphir/');
});

test('finds an nsfw character image and marks it nsfw', () => {
    const result = findImageById(characters, commissions, 'bbb-222');
    assert.equal(result.nsfw, true);
});

test('finds a commission past-work image by id', () => {
    const result = findImageById(characters, commissions, 'ccc-333');
    assert.equal(result.kind, 'commission');
    assert.equal(result.description, 'Fanart');
    assert.equal(result.backHref, '/commissions/');
});

test('returns null when no image matches', () => {
    assert.equal(findImageById(characters, commissions, 'does-not-exist'), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/permalink.test.js`
Expected: FAIL — `Cannot find module '../functions/i/[id].js'`

- [ ] **Step 3: Implement `functions/i/[id].js`**

Create `functions/i/[id].js`:

```js
import { escapeHtml } from '../../shared/escape-html.js';
import { extractImageId } from '../../shared/image-id.js';

const CSP = "default-src 'self'; script-src 'self' https://unpkg.com 'sha256-AhZyvNDdNRAqtFnGIp3LP8YpNDaE+qnvQ7qQk+5LG08='; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self';";

export function findImageById(charactersData, commissionsData, id) {
    for (const character of (charactersData?.characters || [])) {
        for (const image of (character.images || [])) {
            if (extractImageId(image.url) === id) {
                return {
                    kind: 'character',
                    url: image.url,
                    nsfw: Boolean(image.nsfw),
                    title: character.name,
                    description: character.bio || '',
                    backHref: `/gallery/${character.slug}/`,
                };
            }
        }
    }

    for (const item of (commissionsData?.pastWork || [])) {
        if (extractImageId(item.url) === id) {
            return {
                kind: 'commission',
                url: item.url,
                nsfw: Boolean(item.nsfw),
                title: 'Commission — Vyphir',
                description: item.caption || 'Past commission work',
                backHref: '/commissions/',
            };
        }
    }

    return null;
}

function renderErrorPage(message) {
    const safeMessage = escapeHtml(message);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeMessage} | Vyphir</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="datapad-wrapper">
        <div class="datapad-screen">
            <p class="feed-error">${safeMessage}</p>
            <a href="/" class="back-link">&larr; Back to directory</a>
        </div>
    </div>
</body>
</html>`;
}

function renderPermalinkPage({ title, description, url, nsfw, backHref }, requestUrl) {
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml((description || '').split('\n')[0].slice(0, 200));
    const safeUrl = escapeHtml(url);
    const safeBackHref = escapeHtml(backHref);
    const safePageUrl = escapeHtml(requestUrl);
    const wrapClass = nsfw ? 'char-image-wrap nsfw-blur' : 'char-image-wrap';
    const nsfwAttr = nsfw ? ' data-nsfw="true"' : '';
    const shareTags = nsfw
        ? `<meta name="twitter:card" content="summary">`
        : `<meta property="og:image" content="${safeUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${safeUrl}">`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safePageUrl}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    ${shareTags}
    <title>${safeTitle} | Vyphir</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    <script type="importmap">
    { "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }
    </script>
    <script type="module" src="/background.js"></script>
</head>
<body>
    <canvas id="webgl-canvas"></canvas>

    <div class="datapad-wrapper">
        <div class="datapad-screen">
            <a href="${safeBackHref}" class="back-link">&larr; Back</a>
            <h1>${safeTitle}</h1>
            <div class="${wrapClass}"${nsfwAttr}>
                <img src="${safeUrl}" alt="${safeTitle}">
            </div>
            <button type="button" id="copy-link-btn" class="permalink-copy-btn">Copy Link</button>
            <a href="/" class="permalink-explore-link">Explore more &rarr;</a>
        </div>
    </div>
    <script type="module" src="/gallery/permalink.js"></script>
</body>
</html>`;
}

export async function onRequestGet(context) {
    const { request, params } = context;
    const id = params.id;
    const origin = new URL(request.url).origin;

    let charactersData;
    let commissionsData;
    try {
        const [charactersRes, commissionsRes] = await Promise.all([
            fetch(`${origin}/data/characters.json`),
            fetch(`${origin}/data/commissions.json`),
        ]);
        charactersData = await charactersRes.json();
        commissionsData = await commissionsRes.json();
    } catch (error) {
        return new Response(renderErrorPage('Image data unavailable'), {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
        });
    }

    const info = findImageById(charactersData, commissionsData, id);
    if (!info) {
        return new Response(renderErrorPage('Image not found'), {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
        });
    }

    return new Response(renderPermalinkPage(info, request.url), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
    });
}
```

- [ ] **Step 4: Run the `findImageById` tests to verify they pass**

Run: `node --test tests/permalink.test.js`
Expected: 4 tests PASS (the `onRequestGet` tests haven't been written yet).

- [ ] **Step 5: Write the failing tests for `onRequestGet`**

Append to `tests/permalink.test.js`:

```js
function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

function jsonResponse(data) {
    return new Response(JSON.stringify(data), { status: 200 });
}

function mockDataFetch(url) {
    const u = String(url);
    if (u.includes('characters.json')) return jsonResponse(characters);
    if (u.includes('commissions.json')) return jsonResponse(commissions);
    throw new Error(`unexpected fetch ${u}`);
}

test('onRequestGet returns a 200 page with og:image for an sfw character image', async () => {
    await withMockedFetch(mockDataFetch, async () => {
        const request = new Request('https://vyphir.com/i/aaa-111');
        const response = await onRequestGet({ request, params: { id: 'aaa-111' } });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /og:image/);
        assert.match(html, /Vyphir/);
    });
});

test('onRequestGet omits og:image for an nsfw image', async () => {
    await withMockedFetch(mockDataFetch, async () => {
        const request = new Request('https://vyphir.com/i/bbb-222');
        const response = await onRequestGet({ request, params: { id: 'bbb-222' } });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.doesNotMatch(html, /og:image/);
    });
});

test('onRequestGet returns 404 for an unknown id', async () => {
    await withMockedFetch(mockDataFetch, async () => {
        const request = new Request('https://vyphir.com/i/nope');
        const response = await onRequestGet({ request, params: { id: 'nope' } });
        assert.equal(response.status, 404);
    });
});

test('onRequestGet returns 500 when the data fetch fails', async () => {
    await withMockedFetch(async () => { throw new Error('network down'); }, async () => {
        const request = new Request('https://vyphir.com/i/aaa-111');
        const response = await onRequestGet({ request, params: { id: 'aaa-111' } });
        assert.equal(response.status, 500);
    });
});
```

- [ ] **Step 6: Run the full test file to verify it passes**

Run: `node --test tests/permalink.test.js`
Expected: PASS — 8 tests green.

- [ ] **Step 7: Create the client-side copy-link/nsfw-reveal script for the permalink page**

Create `gallery/permalink.js`:

```js
import { setupNsfwReveal } from '../nsfw-reveal.js';

function setupCopyLink() {
    const button = document.getElementById('copy-link-btn');
    if (!button) return;

    button.addEventListener('click', async () => {
        await navigator.clipboard.writeText(window.location.href);
        const original = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = original;
        }, 1500);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupNsfwReveal();
    setupCopyLink();
});
```

- [ ] **Step 8: Add CSS for the permalink page's copy button and explore link**

In `styles.css`, append at the end of the file:

```css
.permalink-copy-btn {
    background: var(--hot-pink);
    color: var(--bg-dark);
    font-family: 'Space Mono', monospace;
    font-weight: bold;
    padding: 10px 16px;
    border-radius: 8px;
    cursor: pointer;
}

.permalink-copy-btn:hover {
    background: var(--pink);
}

.permalink-explore-link {
    display: inline-block;
    margin-top: 12px;
    margin-left: 12px;
    color: var(--hot-pink);
    text-decoration: none;
    font-family: 'Space Mono', monospace;
    font-size: 0.85rem;
}
```

- [ ] **Step 9: Run the full test suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS — all existing tests plus the new ones green.

- [ ] **Step 10: Commit**

```bash
git add functions/i/\[id\].js tests/permalink.test.js gallery/permalink.js styles.css
git commit -m "feat: add /i/[id] shareable image permalink pages"
```

---

### Task 4: Click-to-enlarge wiring

**Files:**
- Create: `shared/enlargeable.js`
- Modify: `gallery/character.js`
- Modify: `commissions/commissions.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `extractImageId` from `./image-id.js` (Task 2).
- Produces: `setupEnlargeableImages(root?: Document | Element): void` — exported from `shared/enlargeable.js`. Used by Task 5 (`gallery/gallery-index.js`).

This task has no automated test (see Global Constraints — DOM-manipulating browser scripts follow the codebase's existing untested pattern, same as `nsfw-reveal.js`). It's verified manually in Task 6.

- [ ] **Step 1: Implement `shared/enlargeable.js`**

Create `shared/enlargeable.js`:

```js
import { extractImageId } from './image-id.js';

export function setupEnlargeableImages(root = document) {
    root.querySelectorAll('.char-image-wrap img').forEach((img) => {
        if (img.closest('a.enlarge-link')) return;

        const id = extractImageId(img.src);
        if (!id) return;

        const link = document.createElement('a');
        link.className = 'enlarge-link';
        link.href = `/i/${id}`;
        link.target = '_blank';
        link.rel = 'noopener';

        img.replaceWith(link);
        link.appendChild(img);
    });
}
```

- [ ] **Step 2: Wire it into the character gallery page**

In `gallery/character.js`, replace the full file contents:

```js
import { setupNsfwReveal } from '../nsfw-reveal.js';
import { setupEnlargeableImages } from '../shared/enlargeable.js';

document.addEventListener('DOMContentLoaded', () => {
    setupEnlargeableImages();
    setupNsfwReveal();
});
```

- [ ] **Step 3: Wire it into the commissions past-work grid**

In `commissions/commissions.js`, add the import at the top:

```js
import { setupNsfwReveal } from '../nsfw-reveal.js';
import { setupEnlargeableImages } from '../shared/enlargeable.js';
```

Then in `loadCommissions()`, right before the existing `setupNsfwReveal();` call (after the `pastWorkEl` rendering loop), add:

```js
        setupEnlargeableImages();
        setupNsfwReveal();
```

(replacing the existing standalone `setupNsfwReveal();` line with these two lines, in that order).

- [ ] **Step 4: Add CSS so the new anchor doesn't break image layout**

In `styles.css`, append:

```css
a.enlarge-link {
    display: block;
}
```

- [ ] **Step 5: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — no test touches these files directly, but this confirms the suite is still green before moving on.

- [ ] **Step 6: Commit**

```bash
git add shared/enlargeable.js gallery/character.js commissions/commissions.js styles.css
git commit -m "feat: make character and commission images clickable to enlarge"
```

---

### Task 5: `/gallery` overview page

**Files:**
- Create: `gallery/index.html`
- Create: `gallery/gallery-index.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `setupEnlargeableImages` from `../shared/enlargeable.js` (Task 4).

This task has no automated test — `gallery/gallery-index.js` is a browser-only DOM script following the same untested pattern as `script.js`/`commissions/commissions.js` (see Global Constraints). It's verified manually in Task 6.

- [ ] **Step 1: Create the static page shell**

Create `gallery/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://unpkg.com 'sha256-AhZyvNDdNRAqtFnGIp3LP8YpNDaE+qnvQ7qQk+5LG08='; style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self';">
    <title>Gallery | Vyphir</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">
    <link rel="stylesheet" href="/styles.css">
    <script type="importmap">
    { "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }
    </script>
    <script type="module" src="/background.js"></script>
</head>
<body>
    <canvas id="webgl-canvas"></canvas>

    <div class="datapad-wrapper datapad-wrapper--wide">
        <div class="datapad-screen">
            <a href="/" class="back-link">&larr; Back to directory</a>
            <h1><i class="fa-solid fa-image"></i> Character Gallery</h1>
            <div id="gallery-index"></div>
        </div>
    </div>
    <script type="module" src="/gallery/gallery-index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create the client script**

Create `gallery/gallery-index.js`:

```js
import { setupEnlargeableImages } from '../shared/enlargeable.js';

function truncateBio(bio, maxLength = 120) {
    const firstLine = (bio || '').split('\n')[0].trim();
    if (firstLine.length <= maxLength) return firstLine;
    return `${firstLine.slice(0, maxLength - 1).trimEnd()}…`;
}

function selectPreviewImages(images, iconUrl, maxCount = 3) {
    return (images || [])
        .filter((img) => !img.nsfw && img.url !== iconUrl)
        .slice(0, maxCount);
}

function renderCharacterCard(character) {
    const images = character.images || [];
    const iconImage = images.find((img) => img.thumbnail && !img.nsfw) || images.find((img) => !img.nsfw);

    const card = document.createElement('div');
    card.className = 'gallery-index-card';

    const link = document.createElement('a');
    link.className = 'gallery-index-card-main';
    link.href = `/gallery/${character.slug}/`;

    if (iconImage) {
        const icon = document.createElement('img');
        icon.className = 'gallery-index-icon';
        icon.src = iconImage.url;
        icon.alt = character.name;
        icon.loading = 'lazy';
        link.appendChild(icon);
    }

    const name = document.createElement('h3');
    name.textContent = character.name;
    link.appendChild(name);

    const bio = document.createElement('p');
    bio.className = 'gallery-index-bio';
    bio.textContent = truncateBio(character.bio);
    link.appendChild(bio);

    card.appendChild(link);

    const previewImages = selectPreviewImages(images, iconImage && iconImage.url);
    if (previewImages.length > 0) {
        const artRow = document.createElement('div');
        artRow.className = 'gallery-index-art-row';
        previewImages.forEach((img) => {
            const wrap = document.createElement('div');
            wrap.className = 'char-image-wrap gallery-index-thumb';
            const thumbImg = document.createElement('img');
            thumbImg.src = img.url;
            thumbImg.alt = character.name;
            thumbImg.loading = 'lazy';
            wrap.appendChild(thumbImg);
            artRow.appendChild(wrap);
        });
        card.appendChild(artRow);
    }

    return card;
}

async function loadGalleryIndex() {
    const container = document.getElementById('gallery-index');
    if (!container) return;

    try {
        const response = await fetch('/data/characters.json');
        const data = await response.json();
        const characters = data.characters || [];

        if (characters.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'gallery-empty';
            empty.textContent = '> NO CHARACTERS ARCHIVED YET';
            container.appendChild(empty);
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'gallery-index-grid';
        characters.forEach((character) => grid.appendChild(renderCharacterCard(character)));
        container.appendChild(grid);

        setupEnlargeableImages(container);
    } catch (error) {
        console.error(error);
        const errorMsg = document.createElement('p');
        errorMsg.className = 'feed-error';
        errorMsg.textContent = '> DATA UNAVAILABLE.';
        container.appendChild(errorMsg);
    }
}

document.addEventListener('DOMContentLoaded', loadGalleryIndex);
```

- [ ] **Step 3: Add CSS for the gallery grid**

In `styles.css`, append:

```css
.gallery-index-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 18px;
}

.gallery-index-card {
    background: var(--bg-element);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    overflow: hidden;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    transition: border-color 0.2s;
}

.gallery-index-card:hover {
    border-color: rgba(255, 105, 180, 0.5);
}

.gallery-index-card-main {
    display: block;
    text-decoration: none;
    color: inherit;
    padding: 14px;
}

.gallery-index-icon {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 10px;
    margin-bottom: 10px;
    display: block;
}

.gallery-index-card-main h3 {
    color: var(--hot-pink);
    font-family: 'Space Mono', monospace;
    font-size: 1rem;
    margin-bottom: 6px;
    text-shadow: 0 0 5px rgba(255, 105, 180, 0.3);
}

.gallery-index-bio {
    font-size: 0.85rem;
    line-height: 1.4;
    color: var(--text-muted);
}

.gallery-index-art-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    padding: 0 14px 14px 14px;
}

.gallery-index-thumb img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — no test touches these new files, this just confirms nothing else regressed.

- [ ] **Step 5: Commit**

```bash
git add gallery/index.html gallery/gallery-index.js styles.css
git commit -m "feat: add /gallery overview page listing all characters"
```

---

### Task 6: End-to-end manual verification

**Files:** none (verification only).

**Interfaces:** none — this task exercises Tasks 1-5 together in a browser.

- [ ] **Step 1: Run the full automated test suite one more time**

Run: `npm test`
Expected: PASS — every test from Tasks 1-5 green.

- [ ] **Step 2: Start a local Cloudflare Pages dev server**

Run: `npx wrangler pages dev . --port 8788`

This serves the static files and the `functions/i/[id].js` Function together, exactly as Cloudflare Pages does in production. No environment variables are needed — this feature only reads `/data/characters.json` and `/data/commissions.json`, it doesn't touch the GitHub or Cloudinary Functions.

- [ ] **Step 3: Verify `/gallery` renders all characters**

Open `http://localhost:8788/gallery` in a browser. Confirm:
- All 7 characters from `data/characters.json` (Vyphir, Pharron, Gritchin, Faeyren, Drasil, Blair, Zephyr) appear as cards with an icon, name, and bio preview.
- Characters with more than one non-NSFW image (e.g. Vyphir, Pharron) show a row of extra artwork thumbnails; single-image characters (Blair, Zephyr) show no extra row.
- Clicking a character's name/icon navigates to `/gallery/<slug>/`.

- [ ] **Step 4: Verify enlarge + permalink flow on a character page**

Open `http://localhost:8788/gallery/vyphir/`. Click a non-NSFW image. Confirm:
- It opens `http://localhost:8788/i/<uuid>` in a new tab.
- The new tab shows the full-size image, an "Explore more →" link, and a "Copy Link" button.
- Clicking "Copy Link" changes the button text to "Copied!" briefly and the clipboard contains the current URL (paste it somewhere to confirm).
- View page source on that tab and confirm `<meta property="og:image" ...>` is present.

- [ ] **Step 5: Verify the NSFW gate still works, both in the gallery and on the permalink page**

On `http://localhost:8788/gallery/vyphir/`, confirm NSFW images are still blurred with the "NSFW — click to reveal" overlay, and clicking the overlay reveals them (without navigating away). Then click a revealed NSFW image and confirm it opens its `/i/<uuid>` permalink in a new tab, where the image is blurred again behind the same reveal-click overlay. View page source on that NSFW permalink tab and confirm there is **no** `<meta property="og:image">` tag.

- [ ] **Step 6: Verify the commissions past-work grid**

Open `http://localhost:8788/commissions/`. Confirm past-work images are clickable and open their `/i/<uuid>` permalink in a new tab with the correct caption as the title/description, and that NSFW-flagged past-work entries behave the same as NSFW character images (blurred, no og:image on the permalink).

- [ ] **Step 7: Verify error handling**

Visit `http://localhost:8788/i/this-id-does-not-exist` directly. Confirm a 404 page renders with "Image not found" and a link back to `/`.

- [ ] **Step 8: Stop the dev server**

Stop the `wrangler pages dev` process (Ctrl+C).

- [ ] **Step 9: Final review**

Run: `git log --oneline -6` and `git status`
Expected: 5 feature/refactor commits from Tasks 1-5 (plus this plan's own commit history), clean working tree, nothing left uncommitted.
