# Gravity-Drop Page Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking an internal link breaks the outgoing page into its visible parts, which tumble off the bottom of the screen under constant acceleration, revealing the incoming page underneath.

**Architecture:** A capture-phase `click` listener on `document`, installed by a `PageTransitions` component mounted inside `App`, intercepts eligible same-origin links. It walks the outgoing page into a list of "pieces", clones them into a fixed overlay outside `#root`, hands the pathname to React Router, then integrates every clone in one `requestAnimationFrame` loop until each clears the bottom edge. All decision logic lives in pure functions with injected accessors so it can be unit-tested under `node --test`, which has no DOM.

**Tech Stack:** React 19, React Router 7, Vite 8 SSG, `node --test` with `react-test-renderer` and the esbuild JSX loader in `tests/jsx-loader.mjs`. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-page-transitions-design.md`

## Global Constraints

- **No new npm dependencies.** `package.json` must be unchanged by this plan.
- **`setAttribute('style', …)` must not appear anywhere in this feature.** The site ships `style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com` with no `'unsafe-inline'`. Write every style through the CSSOM property setter (`el.style.transform = …`, `el.style.setProperty(…)`) or `el.animate(…)`. `removeAttribute('style')` is fine; only the setter is blocked.
- **No changes to** `functions/`, `src/components/admin/`, `src/pages/Admin.jsx`, the CMS/API, or the build pipeline in `scripts/render-pages.js` beyond the one comment correction in Task 9.
- **No page layout redesign.** That is sub-project 5.
- **Tests run with** `node --test --import ./tests/jsx-loader.mjs tests/<file>` for a single file. `npm test` runs a full build first via `pretest`, so use it only at the end of a task, not during the red/green loop.
- **The existing suite (197 tests as of `84d7102`) must stay green.**
- **There is no jsdom and none is added.** Component tests use `react-test-renderer`. `MemoryRouter` and an async effect with a stubbed `globalThis.fetch` flushed by `await act(async () => {})` were both confirmed working in this setup before this plan was written. `react-test-renderer is deprecated` and `The current testing environment is not configured to support act(...)` are pre-existing warnings on every run of this suite. Ignore them; they are not failures.
- **Every commit message ends with these two lines:**

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016Xa4dw8dPXxt6fMaVWtudt
```

The commit steps below show the subject line only. Append the trailer to each.

## Deviations from the spec, and why

Three departures, all decided while reading the real code. Each is called out again at the task that implements it.

1. **§9's module table gains `src/transitions/paths.js`.** The spec has `PageTransitions` derive eligible paths from `routes` inline. Pulling path normalisation, eligibility and title lookup into their own module makes all of it unit-testable without a DOM, which is what §10 asks for.
2. **Clone preparation rewrites `id` attributes instead of stripping them.** §5 says strip. `Landing.jsx` builds its preview blobs as `<clipPath id={clipId}>` referenced by `clipPath="url(#clipId)"`; stripping the id leaves the reference dangling and the hub's preview art falls as unclipped full squares. Rewriting each clone's ids to a unique prefix and rewriting same-clone `url(#…)` references satisfies the spec's actual goal — no duplicate ids in the document — without breaking SVG.
3. **Landing's preview data needs the same fix as the character route.** §7 covers `GalleryCharacterRoute` only. `Landing.jsx` reads `data-previews` off `#root` once at hydration, and `scripts/render-pages.js` renders `/` through `renderLanding` rather than the router for that reason. Both files carry comments saying this breaks the moment client-side routing to `/` exists. This plan builds exactly that, and every page's back-link points at `/`, so Task 9 fixes it. Without Task 9 the hub silently degrades to flat blobs after any client-side navigation home.

---

### Task 1: Path helpers

**Files:**
- Create: `src/transitions/paths.js`
- Test: `tests/transitions-paths.test.js`

**Interfaces:**
- Consumes: the `routes` array exported from `src/routes.js` (each entry has `path`, `Page`, `title`, and optionally `noTransition`).
- Produces:
  - `normalizePath(pathname: string) => string` — exactly one trailing slash.
  - `buildEligiblePaths(routes: Array) => Set<string>` — normalised paths of routes without `noTransition`.
  - `isEligiblePath(pathname: string, eligible: Set<string>) => boolean` — set membership, plus the dynamic `/gallery/<slug>/` pattern.
  - `titleForPath(pathname: string, routes: Array) => string | null` — `null` when the route sets its own title.

- [ ] **Step 1: Write the failing test**

Create `tests/transitions-paths.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, buildEligiblePaths, isEligiblePath, titleForPath } from '../src/transitions/paths.js';
import { routes } from '../src/routes.js';

test('normalizePath adds exactly one trailing slash', () => {
    assert.equal(normalizePath('/queue'), '/queue/');
    assert.equal(normalizePath('/queue/'), '/queue/');
    assert.equal(normalizePath('/queue//'), '/queue/');
    assert.equal(normalizePath('/'), '/');
    assert.equal(normalizePath(''), '/');
});

test('buildEligiblePaths includes every transitioning route', () => {
    const eligible = buildEligiblePaths(routes);
    assert.ok(eligible.has('/'));
    assert.ok(eligible.has('/gallery/'));
    assert.ok(eligible.has('/commissions/'));
    assert.ok(eligible.has('/tos/'));
    assert.ok(eligible.has('/queue/'));
});

test('buildEligiblePaths excludes routes flagged noTransition', () => {
    const eligible = buildEligiblePaths([
        { path: '/', title: 'Home' },
        { path: '/admin/', title: 'Admin', noTransition: true },
    ]);
    assert.ok(eligible.has('/'));
    assert.ok(!eligible.has('/admin/'));
});

test('isEligiblePath accepts a static route with or without its trailing slash', () => {
    const eligible = buildEligiblePaths(routes);
    assert.equal(isEligiblePath('/queue', eligible), true);
    assert.equal(isEligiblePath('/tos', eligible), true);
});

test('isEligiblePath accepts a single-segment character page', () => {
    const eligible = buildEligiblePaths(routes);
    assert.equal(isEligiblePath('/gallery/vyphir/', eligible), true);
    assert.equal(isEligiblePath('/gallery/vyphir', eligible), true);
});

test('isEligiblePath rejects deeper gallery paths, unknown paths and permalinks', () => {
    const eligible = buildEligiblePaths(routes);
    assert.equal(isEligiblePath('/gallery/vyphir/extra/', eligible), false);
    assert.equal(isEligiblePath('/nope/', eligible), false);
    assert.equal(isEligiblePath('/i/abc123', eligible), false);
});

test('isEligiblePath rejects the admin route', () => {
    const eligible = buildEligiblePaths([
        { path: '/', title: 'Home' },
        { path: '/admin/', title: 'Admin', noTransition: true },
    ]);
    assert.equal(isEligiblePath('/admin/', eligible), false);
});

test('titleForPath returns the route table title for every static route', () => {
    for (const route of routes) {
        assert.equal(titleForPath(route.path, routes), route.title);
    }
});

test('titleForPath returns null for a character page, which sets its own title', () => {
    assert.equal(titleForPath('/gallery/vyphir/', routes), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-paths.test.js`
Expected: FAIL, `Cannot find module '.../src/transitions/paths.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/transitions/paths.js`:

```js
/*
 * Pure path logic for the transition seam (spec section 3). No DOM, no
 * imports: everything here is table-driven off the `routes` array so there is
 * never a second copy of the site's path list.
 */

const CHARACTER_PATH = /^\/gallery\/[^/]+\/$/;

export function normalizePath(pathname) {
    if (!pathname) return '/';
    return `${pathname.replace(/\/+$/, '')}/`;
}

export function buildEligiblePaths(routes) {
    const eligible = new Set();
    for (const route of routes) {
        if (route.noTransition) continue;
        eligible.add(normalizePath(route.path));
    }
    return eligible;
}

export function isEligiblePath(pathname, eligible) {
    const normalized = normalizePath(pathname);
    if (eligible.has(normalized)) return true;
    return CHARACTER_PATH.test(normalized);
}

/*
 * The browser used to set the title for free on every full page load. Static
 * routes take it from the route table; character pages only know their title
 * once the character data resolves, so they set it themselves and this
 * returns null for them (spec section 3).
 */
export function titleForPath(pathname, routes) {
    const normalized = normalizePath(pathname);
    const route = routes.find((r) => normalizePath(r.path) === normalized);
    return route ? route.title : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-paths.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/transitions/paths.js tests/transitions-paths.test.js
git commit -m "feat: add path normalisation and route eligibility helpers"
```

---

### Task 2: The interception predicate

**Files:**
- Create: `src/transitions/should-intercept.js`
- Test: `tests/transitions-should-intercept.test.js`

**Interfaces:**
- Consumes: `isEligiblePath` from Task 1 is *not* imported here. The predicate takes a ready-made boolean so it stays free of imports, per spec §9.
- Produces:
  - `describeClick(event, location) => Click | null` — adapts a DOM click event into the plain descriptor below. Returns `null` when there is no anchor with an `href`. Touches no globals except `URL`; `location` is passed in.
  - `shouldIntercept(click: Click | null) => boolean`.
  - `Click` shape: `{ defaultPrevented, button, metaKey, ctrlKey, shiftKey, altKey, anchor: { download, target, rel }, url: URL, currentOrigin: string, currentPathname: string, isEligible: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `tests/transitions-should-intercept.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldIntercept, describeClick } from '../src/transitions/should-intercept.js';

const ORIGIN = 'https://vyphir.example';

function click(overrides = {}) {
    const { anchor = {}, href = '/gallery/', ...rest } = overrides;
    return {
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        anchor: { download: null, target: '', rel: '', ...anchor },
        url: new URL(href, `${ORIGIN}/`),
        currentOrigin: ORIGIN,
        currentPathname: '/',
        isEligible: true,
        ...rest,
    };
}

test('intercepts a plain left click on an internal link', () => {
    assert.equal(shouldIntercept(click()), true);
});

test('does not intercept when a modifier key is held', () => {
    for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
        assert.equal(shouldIntercept(click({ [key]: true })), false, key);
    }
});

test('does not intercept middle or right click', () => {
    assert.equal(shouldIntercept(click({ button: 1 })), false);
    assert.equal(shouldIntercept(click({ button: 2 })), false);
});

test('does not intercept an already-prevented event', () => {
    assert.equal(shouldIntercept(click({ defaultPrevented: true })), false);
});

test('does not intercept a download link', () => {
    assert.equal(shouldIntercept(click({ anchor: { download: '' } })), false);
});

test('does not intercept a link targeted at another browsing context', () => {
    assert.equal(shouldIntercept(click({ anchor: { target: '_blank' } })), false);
    assert.equal(shouldIntercept(click({ anchor: { target: '_self' } })), true);
    assert.equal(shouldIntercept(click({ anchor: { target: '' } })), true);
});

test('does not intercept a link marked rel=external', () => {
    assert.equal(shouldIntercept(click({ anchor: { rel: 'noopener external' } })), false);
});

test('does not intercept any of the hub social links', () => {
    const socials = [
        'https://www.instagram.com/vyphir',
        'https://x.com/Vyphirr',
        'https://bsky.app/profile/samisaderp.bsky.social',
        'https://t.me/Samisaderp#',
        'https://toyhou.se/samisaderp/characters',
        'https://steamcommunity.com/profiles/76561199191219060/',
    ];
    for (const href of socials) {
        assert.equal(shouldIntercept(click({ href, isEligible: false })), false, href);
    }
});

test('does not intercept an ineligible path such as /admin/ or /i/<id>', () => {
    assert.equal(shouldIntercept(click({ href: '/admin/', isEligible: false })), false);
    assert.equal(shouldIntercept(click({ href: '/i/abc123', isEligible: false })), false);
});

test('does not intercept an unknown path', () => {
    assert.equal(shouldIntercept(click({ href: '/nope/', isEligible: false })), false);
});

test('does not intercept a same-page fragment', () => {
    assert.equal(shouldIntercept(click({ href: '/#section', currentPathname: '/' })), false);
});

test('intercepts a hash link that also changes the pathname', () => {
    assert.equal(shouldIntercept(click({ href: '/gallery/#top', currentPathname: '/' })), true);
});

test('does not intercept when there is no anchor', () => {
    assert.equal(shouldIntercept(null), false);
});

test('describeClick finds the anchor from a nested target', () => {
    const anchor = {
        getAttribute: (name) => (name === 'href' ? '/queue' : null),
        hasAttribute: (name) => name === 'href',
        download: null,
        target: '',
        rel: '',
    };
    const nested = { closest: (selector) => (selector === 'a[href]' ? anchor : null) };
    const described = describeClick(
        { target: nested, defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
        { origin: ORIGIN, pathname: '/', href: `${ORIGIN}/` }
    );
    assert.equal(described.url.pathname, '/queue');
    assert.equal(described.currentOrigin, ORIGIN);
});

test('describeClick returns null when the click is not inside an anchor', () => {
    const described = describeClick(
        { target: { closest: () => null }, defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
        { origin: ORIGIN, pathname: '/', href: `${ORIGIN}/` }
    );
    assert.equal(described, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-should-intercept.test.js`
Expected: FAIL, `Cannot find module '.../src/transitions/should-intercept.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/transitions/should-intercept.js`:

```js
/*
 * The interception predicate (spec section 3). Pure, imports nothing: it is
 * handed a plain descriptor so every branch is testable without a DOM.
 *
 * Every condition must hold. Any failure falls through to the browser
 * untouched, which is what keeps middle-click, ctrl-click, downloads and
 * external links behaving exactly as they do today.
 */
export function shouldIntercept(click) {
    if (!click) return false;
    if (click.defaultPrevented) return false;
    if (click.button !== 0) return false;
    if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;

    const { anchor, url } = click;
    if (!anchor || !url) return false;
    if (anchor.download !== null && anchor.download !== undefined) return false;
    if (anchor.target && anchor.target !== '_self') return false;
    if (/(^|\s)external(\s|$)/i.test(anchor.rel || '')) return false;

    if (url.origin !== click.currentOrigin) return false;
    if (url.hash && url.pathname === click.currentPathname) return false;

    return click.isEligible === true;
}

/*
 * DOM adapter. Duck-typed on purpose -- it reads `closest` off the target and
 * takes `location` as an argument, so a stub object exercises it in tests.
 */
export function describeClick(event, location) {
    const target = event.target;
    const anchor = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
    if (!anchor) return null;

    const href = anchor.getAttribute('href');
    if (href === null) return null;

    let url;
    try {
        url = new URL(href, location.href);
    } catch {
        return null;
    }

    return {
        defaultPrevented: event.defaultPrevented,
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        anchor: {
            download: anchor.hasAttribute('download') ? anchor.getAttribute('download') : null,
            target: anchor.target,
            rel: anchor.rel,
        },
        url,
        currentOrigin: location.origin,
        currentPathname: location.pathname,
        isEligible: false,
    };
}
```

Note `describeClick` leaves `isEligible: false`. The caller in Task 7 fills it in from `isEligiblePath`, which keeps this module free of imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-should-intercept.test.js`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/transitions/should-intercept.js tests/transitions-should-intercept.test.js
git commit -m "feat: add the navigation interception predicate"
```

---

### Task 3: The piece walk

**Files:**
- Create: `src/transitions/collect-pieces.js`
- Test: `tests/transitions-collect-pieces.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `paints(style, tagName) => boolean` — `style` is anything with the camelCase keys `getComputedStyle` returns.
  - `collectPieces(root, ctx) => Array<Piece>` where `Piece` is `{ el, rect, mode }` and `mode` is `'whole'` or `'shell'`.
  - `ctx` is `{ getStyle(el), getRect(el), viewportWidth, viewportHeight, maxPieces, maxDepth }`; the last two default to `150` and `12`.
  - `domContext() => ctx` — the real-DOM context, used by Tasks 5 and 6.
  - `pageRoot() => Element | null` — `#root`'s first element child.
  - `MAX_PIECES = 150`.

The walk is injected with its accessors precisely so it can be driven by fake nodes here; the real DOM version is one thin function at the bottom.

- [ ] **Step 1: Write the failing test**

Create `tests/transitions-collect-pieces.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { paints, collectPieces } from '../src/transitions/collect-pieces.js';

const BLANK = {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundImage: 'none',
    borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px',
    borderTopStyle: 'none', borderRightStyle: 'none', borderBottomStyle: 'none', borderLeftStyle: 'none',
    boxShadow: 'none',
    outlineStyle: 'none', outlineWidth: '0px',
};

function el(tagName, children = [], style = {}, rect = { left: 0, top: 0, width: 100, height: 100 }) {
    return { tagName, children, _style: { ...BLANK, ...style }, _rect: rect };
}

function ctx(overrides = {}) {
    return {
        getStyle: (node) => node._style,
        getRect: (node) => node._rect,
        viewportWidth: 1000,
        viewportHeight: 800,
        ...overrides,
    };
}

test('paints is false for a bare wrapper', () => {
    assert.equal(paints(BLANK, 'DIV'), false);
});

test('paints is true for a background colour with alpha', () => {
    assert.equal(paints({ ...BLANK, backgroundColor: 'rgb(255, 246, 233)' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, backgroundColor: 'rgba(255, 246, 233, 0.5)' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, backgroundColor: 'rgba(255, 246, 233, 0)' }, 'DIV'), false);
});

test('paints is true for a border, a shadow, an outline or a background image', () => {
    assert.equal(paints({ ...BLANK, borderTopWidth: '3px', borderTopStyle: 'solid' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, borderTopWidth: '3px', borderTopStyle: 'none' }, 'DIV'), false);
    assert.equal(paints({ ...BLANK, boxShadow: '6px 6px 0 #000' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, outlineStyle: 'solid', outlineWidth: '2px' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, backgroundImage: 'url(a.png)' }, 'DIV'), true);
});

test('paints is always true for replaced and drawn elements, in either tag case', () => {
    for (const tag of ['IMG', 'SVG', 'CANVAS', 'VIDEO', 'svg']) {
        assert.equal(paints(BLANK, tag), true, tag);
    }
});

test('a childless element is a whole piece', () => {
    const root = el('DIV', [el('SPAN')]);
    const pieces = collectPieces(root, ctx());
    assert.equal(pieces.length, 1);
    assert.equal(pieces[0].mode, 'whole');
    assert.equal(pieces[0].el.tagName, 'SPAN');
});

test('a painting container yields a shell and its children separately', () => {
    const heading = el('H1');
    const image = el('IMG');
    const panel = el('DIV', [heading, image], { backgroundColor: 'rgb(255,255,255)' });
    const pieces = collectPieces(el('DIV', [panel]), ctx());
    assert.deepEqual(pieces.map((p) => [p.el.tagName, p.mode]), [
        ['DIV', 'shell'],
        ['H1', 'whole'],
        ['IMG', 'whole'],
    ]);
});

test('a non-painting wrapper contributes nothing and lets its children fall separately', () => {
    const wrapper = el('DIV', [el('A'), el('A'), el('A')]);
    const pieces = collectPieces(el('DIV', [wrapper]), ctx());
    assert.equal(pieces.length, 3);
    assert.ok(pieces.every((p) => p.el.tagName === 'A'));
});

test('the page root itself is a piece when it paints', () => {
    const root = el('DIV', [el('SPAN')], { backgroundColor: 'rgb(1,2,3)' });
    const pieces = collectPieces(root, ctx());
    assert.equal(pieces[0].el, root);
    assert.equal(pieces[0].mode, 'shell');
});

test('zero-area elements are dropped but still descended into', () => {
    const child = el('SPAN', [], {}, { left: 0, top: 0, width: 50, height: 50 });
    const empty = el('DIV', [child], { backgroundColor: 'rgb(1,2,3)' }, { left: 0, top: 0, width: 0, height: 0 });
    const pieces = collectPieces(el('DIV', [empty]), ctx());
    assert.deepEqual(pieces.map((p) => p.el.tagName), ['SPAN']);
});

test('elements entirely outside the viewport are dropped along with their subtree', () => {
    const offscreen = el('DIV', [el('SPAN')], {}, { left: 0, top: 2000, width: 100, height: 100 });
    const onscreen = el('SPAN', [], {}, { left: 0, top: 10, width: 100, height: 100 });
    const pieces = collectPieces(el('DIV', [offscreen, onscreen]), ctx());
    assert.deepEqual(pieces.map((p) => p.el.tagName), ['SPAN']);
    assert.equal(pieces[0].el, onscreen);
});

test('exceeding the ceiling re-walks shallower until the count fits', () => {
    // 10 wrappers, each holding 10 leaves: 100 leaves at full depth, 10 at depth 1.
    const wrappers = Array.from({ length: 10 }, () =>
        el('DIV', Array.from({ length: 10 }, () => el('SPAN')))
    );
    const root = el('DIV', wrappers);
    const deep = collectPieces(root, ctx({ maxPieces: 150 }));
    assert.equal(deep.length, 100);
    const shallow = collectPieces(root, ctx({ maxPieces: 50 }));
    assert.equal(shallow.length, 10);
    assert.ok(shallow.every((p) => p.mode === 'whole'));
});

test('the shallowest walk still returns the top-level children when nothing fits', () => {
    const root = el('DIV', Array.from({ length: 20 }, () => el('SPAN')));
    const pieces = collectPieces(root, ctx({ maxPieces: 5 }));
    assert.equal(pieces.length, 20);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-collect-pieces.test.js`
Expected: FAIL, `Cannot find module '.../src/transitions/collect-pieces.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/transitions/collect-pieces.js`:

```js
/*
 * The piece walk (spec section 4). DOM-dependent, but every accessor is
 * injected through `ctx` so the walk itself is exercised by fake nodes in
 * tests -- this repo has no jsdom and deliberately adds none.
 */

export const MAX_PIECES = 150;
const MAX_DEPTH = 12;
const ALWAYS_PAINTS = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO']);
const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

function hasOpaqueBackground(color) {
    if (!color || color === 'transparent') return false;
    const match = /^rgba?\(([^)]+)\)$/.exec(color.trim());
    if (!match) return true;
    const parts = match[1].split(',').map((p) => parseFloat(p));
    return parts.length < 4 || parts[3] > 0;
}

function hasBorder(style) {
    return SIDES.some((side) => {
        const width = parseFloat(style[`border${side}Width`]) || 0;
        const lineStyle = style[`border${side}Style`];
        return width > 0 && lineStyle !== 'none' && lineStyle !== 'hidden';
    });
}

/*
 * An element paints if it puts pixels on the page by itself. A panel has a
 * background, a border and a shadow, so it paints and therefore falls as its
 * own empty shell while its contents fall separately -- that is what stops
 * the whole page sliding away as one slab.
 */
export function paints(style, tagName) {
    if (ALWAYS_PAINTS.has(String(tagName).toUpperCase())) return true;
    if (hasOpaqueBackground(style.backgroundColor)) return true;
    if (style.backgroundImage && style.backgroundImage !== 'none') return true;
    if (hasBorder(style)) return true;
    if (style.boxShadow && style.boxShadow !== 'none') return true;
    const outlineStyle = style.outlineStyle;
    if (outlineStyle && outlineStyle !== 'none' && (parseFloat(style.outlineWidth) || 0) > 0) return true;
    return false;
}

/*
 * Two different exclusions, handled differently on purpose. An element
 * entirely outside the viewport would fall unseen, and so would everything
 * inside it, so its whole subtree is dropped. A zero-area element is merely
 * not worth cloning -- a wrapper collapsed to nothing can still hold visible
 * children -- so it is skipped but descended into.
 */
function walk(el, ctx, depth, out) {
    const rect = ctx.getRect(el);
    const hasArea = rect.width > 0 && rect.height > 0;
    const onscreen = rect.top < ctx.viewportHeight && rect.left < ctx.viewportWidth
        && rect.top + rect.height > 0 && rect.left + rect.width > 0;
    if (hasArea && !onscreen) return;
    const emit = hasArea && onscreen;

    const children = Array.from(el.children || []);

    if (depth <= 0 || children.length === 0) {
        if (emit) out.push({ el, rect, mode: 'whole' });
        return;
    }

    if (emit && paints(ctx.getStyle(el), el.tagName)) {
        out.push({ el, rect, mode: 'shell' });
    }

    for (const child of children) {
        walk(child, ctx, depth - 1, out);
    }
}

/*
 * Animating several hundred cloned nodes drops frames on a phone, and a
 * stuttering transition looks worse than none. If a full-depth walk blows the
 * ceiling, re-walk one level shallower and try again; at depth 1 the page's
 * top-level children simply fall as they are.
 */
export function collectPieces(root, ctx) {
    const maxPieces = ctx.maxPieces ?? MAX_PIECES;
    const maxDepth = ctx.maxDepth ?? MAX_DEPTH;
    let pieces = [];
    for (let depth = maxDepth; depth >= 1; depth--) {
        pieces = [];
        walk(root, ctx, depth, pieces);
        if (pieces.length <= maxPieces) return pieces;
    }
    return pieces;
}

export function pageRoot() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('root')?.firstElementChild ?? null;
}

export function domContext() {
    return {
        getStyle: (el) => window.getComputedStyle(el),
        getRect: (el) => el.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-collect-pieces.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add src/transitions/collect-pieces.js tests/transitions-collect-pieces.test.js
git commit -m "feat: add the gravity-drop piece walk"
```

---

### Task 4: Physics and clone geometry, pure half

**Files:**
- Create: `src/transitions/physics.js`
- Test: `tests/transitions-physics.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MOTION` — the tunable constants object: `{ gravity, vy0Min, vy0Max, vxMin, vxMax, omegaMin, omegaMax, stagger, staggerCap, maxDt, timeout }`.
  - `motionFor(index: number) => { vy: number, vx: number, omega: number, delay: number }` — deterministic for a given index.
  - `step(state, dt) => void` — mutates `{ x, y, vy, rot }` in place.
  - `decompose(matrix: string) => { rotation: number, scaleX: number, scaleY: number }` — reads a computed `transform` string.

This module is split out of `fall.js` (spec §9) so the numbers can be tuned and tested without a browser. `fall.js` imports it.

- [ ] **Step 1: Write the failing test**

Create `tests/transitions-physics.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTION, motionFor, step, decompose } from '../src/transitions/physics.js';

test('motionFor is deterministic for a given index', () => {
    assert.deepEqual(motionFor(7), motionFor(7));
    assert.notDeepEqual(motionFor(7), motionFor(8));
});

test('motionFor stays inside the tuned ranges', () => {
    for (let i = 0; i < 200; i++) {
        const m = motionFor(i);
        assert.ok(m.vy >= MOTION.vy0Min && m.vy <= MOTION.vy0Max, `vy ${m.vy}`);
        assert.ok(m.vx >= MOTION.vxMin && m.vx <= MOTION.vxMax, `vx ${m.vx}`);
        assert.ok(m.omega >= MOTION.omegaMin && m.omega <= MOTION.omegaMax, `omega ${m.omega}`);
    }
});

test('motionFor staggers pieces and caps the total stagger', () => {
    assert.equal(motionFor(0).delay, 0);
    assert.equal(motionFor(1).delay, MOTION.stagger);
    assert.equal(motionFor(149).delay, MOTION.staggerCap);
});

test('step accelerates downward and integrates position', () => {
    const state = { x: 0, y: 0, vy: 0, vx: 100, rot: 0, omega: 90 };
    step(state, 0.5);
    assert.equal(state.vy, MOTION.gravity * 0.5);
    assert.equal(state.y, MOTION.gravity * 0.5 * 0.5);
    assert.equal(state.x, 50);
    assert.equal(state.rot, 45);
});

test('decompose reads rotation and scale out of a matrix', () => {
    const half = Math.SQRT1_2;
    const { rotation, scaleX, scaleY } = decompose(`matrix(${half}, ${half}, ${-half}, ${half}, 10, 20)`);
    assert.ok(Math.abs(rotation - 45) < 1e-6);
    assert.ok(Math.abs(scaleX - 1) < 1e-6);
    assert.ok(Math.abs(scaleY - 1) < 1e-6);
});

test('decompose treats none and unparseable values as identity', () => {
    assert.deepEqual(decompose('none'), { rotation: 0, scaleX: 1, scaleY: 1 });
    assert.deepEqual(decompose(''), { rotation: 0, scaleX: 1, scaleY: 1 });
    assert.deepEqual(decompose('matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)'), { rotation: 0, scaleX: 1, scaleY: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-physics.test.js`
Expected: FAIL, `Cannot find module '.../src/transitions/physics.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/transitions/physics.js`:

```js
/*
 * Closed-form motion for the fall (spec section 5). Pieces accelerate,
 * drift and tumble; they never collide, bounce or rest, so this is a handful
 * of numbers rather than a physics engine.
 *
 * Starting values from the spec's table. Tune here, not in fall.js.
 */
export const MOTION = {
    gravity: 2000,      // px/s^2
    vy0Min: -60,        // px/s, upward kick
    vy0Max: 0,
    vxMin: -40,         // px/s, horizontal drift
    vxMax: 40,
    omegaMin: -180,     // deg/s
    omegaMax: 180,
    stagger: 18,        // ms between pieces
    staggerCap: 250,    // ms, total
    maxDt: 0.032,       // s; a backgrounded tab must not teleport everything
    timeout: 3000,      // ms hard stop
};

/*
 * Per-piece randomness is seeded from the piece's index, so a given page
 * falls the same way every time and a visual regression is reproducible.
 * mulberry32, inlined -- no dependency for six numbers.
 */
function seeded(index) {
    let a = (index + 1) * 0x9e3779b9;
    return function next() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function between(random, min, max) {
    return min + random() * (max - min);
}

export function motionFor(index) {
    const random = seeded(index);
    return {
        vy: between(random, MOTION.vy0Min, MOTION.vy0Max),
        vx: between(random, MOTION.vxMin, MOTION.vxMax),
        omega: between(random, MOTION.omegaMin, MOTION.omegaMax),
        delay: Math.min(index * MOTION.stagger, MOTION.staggerCap),
    };
}

export function step(state, dt) {
    state.vy += MOTION.gravity * dt;
    state.y += state.vy * dt;
    state.x += state.vx * dt;
    state.rot += state.omega * dt;
}

/*
 * A clone placed at its measured bounding rect loses whatever transform the
 * stylesheet gave the original -- the hub items are rotated, so without this
 * every word snaps upright on the first frame. The rect is the axis-aligned
 * box of the rotated element, so the clone is sized from its untransformed
 * layout box, centred inside that rect, and re-rotated: exact for rotation
 * and scale about the default centre origin.
 */
export function decompose(matrix) {
    const identity = { rotation: 0, scaleX: 1, scaleY: 1 };
    const match = /^matrix\(([^)]+)\)$/.exec(String(matrix).trim());
    if (!match) return identity;
    const [a, b, c, d] = match[1].split(',').map((n) => parseFloat(n));
    if ([a, b, c, d].some((n) => !Number.isFinite(n))) return identity;
    return {
        rotation: (Math.atan2(b, a) * 180) / Math.PI,
        scaleX: Math.hypot(a, b),
        scaleY: Math.hypot(c, d),
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-physics.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/transitions/physics.js tests/transitions-physics.test.js
git commit -m "feat: add tunable fall physics and transform decomposition"
```

---

### Task 5: The overlay, clones and animation loop

**Files:**
- Create: `src/transitions/fall.js`
- Modify: `public/styles.css` (append a new section at the end, after the existing reduced-motion blocks)

**Interfaces:**
- Consumes: `MOTION`, `motionFor`, `step`, `decompose` from `src/transitions/physics.js`.
- Produces:
  - `runFall(pieces: Array<Piece>, options?) => { cancel(): void }` — builds the overlay, starts the loop, tears itself down. `options.now` and `options.raf` are injectable for future work; default to `performance.now` and `requestAnimationFrame`.
  - `cancelFall() => void` — cancels any running fall. Used for re-entrancy.

There are no unit tests for this task: it is all DOM writing, and this repo has no browser test tooling by decision of sub-projects 2 and 3. Its verification is the manual pass in Task 10. Keep the untestable surface thin by leaning on Task 4's pure functions.

- [ ] **Step 1: Write the module**

Create `src/transitions/fall.js`:

```js
import { MOTION, motionFor, step, decompose } from './physics.js';

/*
 * Clone preparation, the overlay and the animation loop (spec section 5).
 *
 * CSP: the site ships no 'unsafe-inline' for styles, and setAttribute('style')
 * is the one write the policy blocks. Everything here goes through the CSSOM
 * property setter. Do not "simplify" any of this into setAttribute.
 */

/*
 * A clone is lifted out of its ancestors, so every contextual rule that
 * styled it through a descendant selector stops matching. Copying the
 * computed value of these properties onto the clone's root element keeps it
 * looking like what it replaced. Descendants inside a whole clone still have
 * their ancestors, so they need nothing.
 */
const COPIED = [
    'color', 'background-color', 'background-image', 'background-position',
    'background-size', 'background-repeat', 'background-clip',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius',
    'box-shadow', 'opacity', 'filter', 'clip-path', 'overflow',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line',
    'text-decoration-color', 'white-space', 'word-break',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'display', 'box-sizing', 'fill', 'stroke', 'object-fit', 'object-position',
];

let active = null;

/*
 * Ids are rewritten rather than stripped. Landing's preview blobs are
 * <clipPath id> referenced by clipPath="url(#id)"; stripping the id leaves a
 * dangling reference and the art falls unclipped. Rewriting keeps the
 * reference working and still leaves no duplicate id in the document.
 */
function rekeyIds(clone, index) {
    const nodes = [clone, ...clone.querySelectorAll('[id]')];
    const mapping = new Map();
    let n = 0;
    for (const node of nodes) {
        const id = node.id;
        if (!id) continue;
        const replacement = `gd-${index}-${n++}`;
        mapping.set(id, replacement);
        node.id = replacement;
    }
    if (mapping.size === 0) return;

    const all = [clone, ...clone.querySelectorAll('*')];
    for (const node of all) {
        for (const attr of Array.from(node.attributes)) {
            if (attr.name === 'id' || attr.name === 'style') continue;
            let value = attr.value;
            let changed = false;
            for (const [from, to] of mapping) {
                const url = `url(#${from})`;
                if (value.includes(url)) {
                    value = value.split(url).join(`url(#${to})`);
                    changed = true;
                }
                if (value === `#${from}`) {
                    value = `#${to}`;
                    changed = true;
                }
            }
            if (changed) node.setAttribute(attr.name, value);
        }
    }
}

function scrub(clone) {
    const all = [clone, ...clone.querySelectorAll('*')];
    for (const node of all) {
        node.removeAttribute('style');
        if (node.hasAttribute('name')) node.removeAttribute('name');
    }
}

function prepare(piece, index) {
    const computed = window.getComputedStyle(piece.el);
    const clone = piece.el.cloneNode(true);

    if (piece.mode === 'shell') {
        while (clone.firstElementChild) clone.removeChild(clone.firstElementChild);
    }

    scrub(clone);
    rekeyIds(clone, index);
    clone.classList.add('gd-piece');

    for (const property of COPIED) {
        const value = computed.getPropertyValue(property);
        if (value) clone.style.setProperty(property, value);
    }

    const width = parseFloat(computed.width) || piece.rect.width;
    const height = parseFloat(computed.height) || piece.rect.height;
    const { rotation, scaleX, scaleY } = decompose(computed.transform);

    // Centre the untransformed box inside the measured bounding rect, then
    // put the original rotation and scale back (see physics.decompose).
    const left = piece.rect.left + (piece.rect.width - width) / 2;
    const top = piece.rect.top + (piece.rect.height - height) / 2;

    clone.style.position = 'absolute';
    clone.style.margin = '0';
    clone.style.left = `${left}px`;
    clone.style.top = `${top}px`;
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.willChange = 'transform';

    const base = `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
    clone.style.transform = base;

    return { clone, base, rect: { top, height } };
}

export function cancelFall() {
    if (active) active.cancel();
}

export function runFall(pieces, options = {}) {
    const raf = options.raf || window.requestAnimationFrame.bind(window);
    const now = options.now || (() => performance.now());

    cancelFall();

    const overlay = document.createElement('div');
    overlay.className = 'gd-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;

    const bodies = [];
    pieces.forEach((piece, index) => {
        const { clone, base, rect } = prepare(piece, index);
        const motion = motionFor(index);
        bodies.push({
            clone,
            base,
            bottom: rect.top + rect.height,
            state: { x: 0, y: 0, vy: motion.vy, vx: motion.vx, rot: 0, omega: motion.omega },
            delay: motion.delay,
            retired: false,
        });
        overlay.appendChild(clone);
    });

    document.body.appendChild(overlay);

    const started = now();
    let last = started;
    let frame = 0;
    let live = bodies.length;

    function destroy() {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        overlay.remove();
        if (active && active.overlay === overlay) active = null;
    }

    function tick() {
        const time = now();
        const dt = Math.min((time - last) / 1000, MOTION.maxDt);
        last = time;
        const elapsed = time - started;

        for (const body of bodies) {
            if (body.retired || elapsed < body.delay) continue;
            step(body.state, dt);
            body.clone.style.transform =
                `translate(${body.state.x}px, ${body.state.y}px) rotate(${body.state.rot}deg) ${body.base}`;
            if (body.bottom + body.state.y > window.innerHeight + 200) {
                body.retired = true;
                body.clone.remove();
                live -= 1;
            }
        }

        // The timeout is a safety net: a stuck loop must never leave an inert
        // overlay sitting on top of a live page.
        if (live <= 0 || elapsed > MOTION.timeout) {
            destroy();
            return;
        }
        frame = raf(tick);
    }

    frame = raf(tick);
    active = { overlay, cancel: destroy };
    return active;
}
```

- [ ] **Step 2: Add the stylesheet rules**

Append to the end of `public/styles.css`:

```css
/* ---------------------------------------------------------------------------
 * Gravity-drop page transitions (spec sections 5, 6, 8).
 *
 * The overlay lives outside #root so React never reconciles it, and it is
 * inert, aria-hidden and pointer-events:none -- nothing falling is
 * focusable, clickable or reachable by a screen reader. The real content is
 * underneath and readable from the moment the router commits.
 *
 * Every selector here is two classes deep so it beats the single-class rules
 * a clone still carries (.hub-item, .panel, .decor-blob) without !important.
 * ------------------------------------------------------------------------ */
.gd-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    pointer-events: none;
    overflow: hidden;
    contain: layout paint;
}

.gd-overlay .gd-piece {
    position: absolute;
    margin: 0;
    pointer-events: none;
    transform-origin: 50% 50%;
}

.gd-overlay .gd-piece,
.gd-overlay .gd-piece * {
    animation: none;
    transition: none;
}

.gd-settle {
    animation: gd-settle-in 320ms cubic-bezier(.2, .7, .3, 1) both;
}

@keyframes gd-settle-in {
    from { opacity: 0; transform: translateY(-24px); }
    to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
    .gd-settle { animation: none; }
}
```

- [ ] **Step 3: Verify nothing regressed**

Run: `npm test`
Expected: PASS, still 197 tests plus the 42 added in Tasks 1 to 4. No test touches this module yet; this step is confirming the CSS edit and the new file break nothing and the build still succeeds.

- [ ] **Step 4: Verify no forbidden style write crept in**

Run: `grep -rn "setAttribute('style'\|setAttribute(\"style\"" src/`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/transitions/fall.js public/styles.css
git commit -m "feat: add the falling-clone overlay and animation loop"
```

---

### Task 6: The incoming settle

**Files:**
- Create: `src/transitions/settle.js`
- Test: `tests/transitions-settle.test.js`

**Interfaces:**
- Consumes: `MOTION` from `src/transitions/physics.js`; `Piece` objects from `src/transitions/collect-pieces.js`.
- Produces:
  - `settleTargets(pieces: Array<Piece>) => Array<Element>` — pure; the `'whole'` pieces only.
  - `settle(pieces: Array<Piece>) => void` — runs the animation via `el.animate`.

The settle animates the **real** incoming elements, not clones, and only the `'whole'` pieces. Translating a real element also translates its descendants, so a list holding both an element and its ancestor would animate the same pixels twice at two different offsets. `'whole'` pieces are mutually disjoint by construction, which is exactly the guarantee needed.

- [ ] **Step 1: Write the failing test**

Create `tests/transitions-settle.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { settleTargets } from '../src/transitions/settle.js';

test('settleTargets keeps only the whole pieces, in order', () => {
    const shell = { el: { tag: 'panel' }, mode: 'shell' };
    const first = { el: { tag: 'h1' }, mode: 'whole' };
    const second = { el: { tag: 'img' }, mode: 'whole' };
    const targets = settleTargets([shell, first, second]);
    assert.deepEqual(targets, [first.el, second.el]);
});

test('settleTargets returns nothing when every piece is a shell', () => {
    assert.deepEqual(settleTargets([{ el: {}, mode: 'shell' }]), []);
});

test('settleTargets tolerates an empty list', () => {
    assert.deepEqual(settleTargets([]), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-settle.test.js`
Expected: FAIL, `Cannot find module '.../src/transitions/settle.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/transitions/settle.js`:

```js
import { MOTION } from './physics.js';

/*
 * The incoming settle (spec section 6). The arriving page is already in its
 * final position, so this animates the real elements rather than clones:
 * a short drift down from 24px above with a fade, staggered in DOM order,
 * over 320ms. That is comfortably shorter than the fall, so the two overlap
 * and arrival reads as one gesture rather than a second animation.
 */
const DISTANCE = 24;   // px
const DURATION = 320;  // ms

/*
 * Only the whole pieces. A transform on a real element moves its descendants
 * too, so animating an element and its ancestor would shift the same pixels
 * twice; whole pieces are mutually disjoint, shells are not.
 */
export function settleTargets(pieces) {
    return pieces.filter((piece) => piece.mode === 'whole').map((piece) => piece.el);
}

export function settle(pieces) {
    const targets = settleTargets(pieces);
    targets.forEach((el, index) => {
        if (typeof el.animate !== 'function') return;
        el.animate(
            [
                { opacity: 0, transform: `translateY(-${DISTANCE}px)` },
                { opacity: 1, transform: 'translateY(0)' },
            ],
            {
                duration: DURATION,
                delay: Math.min(index * MOTION.stagger, MOTION.staggerCap),
                easing: 'cubic-bezier(.2, .7, .3, 1)',
                fill: 'backwards',
            }
        );
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --import ./tests/jsx-loader.mjs tests/transitions-settle.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/transitions/settle.js tests/transitions-settle.test.js
git commit -m "feat: add the incoming-page settle animation"
```

---

### Task 7: Wire the seam into the router

**Files:**
- Create: `src/transitions/PageTransitions.jsx`
- Create: `tests/page-transitions.test.js`
- Modify: `src/App.jsx`
- Modify: `src/routes.js` (add `noTransition: true` to the `/admin/` route)

**Interfaces:**
- Consumes: `buildEligiblePaths`, `isEligiblePath`, `titleForPath` (Task 1); `describeClick`, `shouldIntercept` (Task 2); `collectPieces`, `domContext`, `pageRoot` (Task 3); `runFall`, `cancelFall` (Task 5); `settle` (Task 6); `routes` from `src/routes.js`.
- Produces: `PageTransitions` default export, a component that renders `null`.

`PageTransitions` must be SSR-safe: `App` is also rendered by `entry-server.jsx` under `StaticRouter`, so no `document`, `window` or `matchMedia` access during render. Everything goes in effects.

- [ ] **Step 1: Write the failing test**

Create `tests/page-transitions.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import PageTransitions from '../src/transitions/PageTransitions.jsx';
import { routes } from '../src/routes.js';

test('PageTransitions renders no markup at all', () => {
    const html = renderToStaticMarkup(
        <StaticRouter location="/gallery/">
            <PageTransitions />
        </StaticRouter>
    );
    assert.equal(html, '');
});

test('App still server-renders every route with PageTransitions mounted', () => {
    for (const route of routes) {
        const html = renderToStaticMarkup(
            <StaticRouter location={route.path}>
                <App />
            </StaticRouter>
        );
        assert.ok(html.length > 0, route.path);
    }
});

test('the gallery page still server-renders its panel with PageTransitions mounted', () => {
    const html = renderToStaticMarkup(
        <StaticRouter location="/gallery/">
            <App />
        </StaticRouter>
    );
    assert.match(html, /<div class="page-teal">/);
    assert.match(html, /<div class="panel-wrapper panel--wide"><div class="panel">/);
});

test('the admin route opts out of transitions', () => {
    const admin = routes.find((route) => route.path === '/admin/');
    assert.equal(admin.noTransition, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/page-transitions.test.js`
Expected: FAIL, `Cannot find module '.../src/transitions/PageTransitions.jsx'`.

- [ ] **Step 3: Write the component**

Create `src/transitions/PageTransitions.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { routes } from '../routes.js';
import { buildEligiblePaths, isEligiblePath, titleForPath } from './paths.js';
import { describeClick, shouldIntercept } from './should-intercept.js';
import { collectPieces, domContext, pageRoot } from './collect-pieces.js';
import { runFall, cancelFall } from './fall.js';
import { settle } from './settle.js';

const ELIGIBLE = buildEligiblePaths(routes);

/*
 * The navigation seam (spec section 3).
 *
 * Every internal link on this site is a plain <a href>, so before this
 * component existed every click was a full document load and there was
 * nothing for the transition to hook into. A single capture-phase listener
 * on document turns an eligible click into a client-side navigation, and
 * takes over the two things the browser was doing for free: the title and
 * the scroll position. Both fail silently when wrong, so both are handled
 * here deliberately rather than left to be discovered later.
 *
 * Known limitation: back and forward navigate without the effect. This
 * catches clicks, and popstate ordering against React Router's own listener
 * is not guaranteed, so animating it would be racy.
 */
export default function PageTransitions() {
    const navigate = useNavigate();
    const location = useLocation();
    const transitioning = useRef(false);

    useEffect(() => {
        function onClick(event) {
            const described = describeClick(event, window.location);
            if (!described) return;
            described.isEligible = isEligiblePath(described.url.pathname, ELIGIBLE);
            if (!shouldIntercept(described)) return;

            event.preventDefault();

            // Read at transition time, never cached at load.
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!reduced) {
                const root = pageRoot();
                if (root) {
                    const pieces = collectPieces(root, domContext());
                    if (pieces.length > 0) runFall(pieces);
                }
            }

            transitioning.current = !reduced;
            navigate(`${described.url.pathname}${described.url.search}${described.url.hash}`);
        }

        document.addEventListener('click', onClick, true);
        return () => {
            document.removeEventListener('click', onClick, true);
            cancelFall();
        };
    }, [navigate]);

    useEffect(() => {
        const title = titleForPath(location.pathname, routes);
        if (title) document.title = title;

        window.scrollTo(0, 0);

        // Keyboard users must not be left holding focus on a detached clone.
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        if (!transitioning.current) return;
        transitioning.current = false;
        const root = pageRoot();
        if (root) settle(collectPieces(root, domContext()));
    }, [location.pathname]);

    return null;
}
```

- [ ] **Step 4: Mount it and flag the admin route**

In `src/App.jsx`, import the component and render it above `<Routes>`:

```jsx
import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';
import GalleryCharacterRoute from './pages/GalleryCharacterRoute.jsx';
import PageTransitions from './transitions/PageTransitions.jsx';

export default function App() {
    return (
        <>
            <PageTransitions />
            <Routes>
                {routes.map(({ path, Page }) => (
                    <Route key={path} path={path} element={<Page />} />
                ))}
                <Route path="/gallery/:slug/" element={<GalleryCharacterRoute />} />
            </Routes>
        </>
    );
}
```

In `src/routes.js`, add the opt-out flag to the admin route, leaving every other field as it is:

```js
    {
        path: '/admin/',
        Page: Admin,
        title: 'Admin | Vyphir',
        robotsNoIndex: true,
        noTransition: true,
        csp: "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self';",
        extraStylesheets: ['/admin/admin.css'],
    },
```

- [ ] **Step 5: Run the new tests, then the whole suite**

Run: `node --test --import ./tests/jsx-loader.mjs tests/page-transitions.test.js`
Expected: PASS, 4 tests.

Run: `npm test`
Expected: PASS. `scripts/render-pages.js` spreads route fields into the shell, so confirm `head-parity.test.js` and `render-pages.test.js` are both still green — the new `noTransition` field must not leak into any emitted HTML. If it does, that is a real failure, not a test to update.

- [ ] **Step 6: Commit**

```bash
git add src/transitions/PageTransitions.jsx src/App.jsx src/routes.js tests/page-transitions.test.js
git commit -m "feat: intercept internal links and run the gravity-drop transition"
```

---

### Task 8: Make the character route survive client-side navigation

**Files:**
- Modify: `src/pages/GalleryCharacterRoute.jsx`
- Test: `tests/gallery-character-route.test.js` (create)

**Interfaces:**
- Consumes: `useParams` from `react-router-dom`; `/data/characters.json`, the same endpoint `GalleryIndexGrid`, `QueueBoard`, `TosPointList` and `Commissions` already fetch.
- Produces: no new exports. The component keeps its default export and its current markup.

The route reads its character from `data-character` on `#root`, which the build bakes into each character page. Under client-side navigation the document is still the one served for `/gallery/`, whose `#root` carries no such attribute, so the component returns `null` and renders a blank page. Clicking a character card is the most common navigation on the site, so this is a blocker.

- [ ] **Step 1: Write the failing test**

Create `tests/gallery-character-route.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from 'react-test-renderer';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GalleryCharacterRoute from '../src/pages/GalleryCharacterRoute.jsx';

const VYPHIR = { slug: 'vyphir', name: 'Vyphir', bio: 'A slime.', images: [] };
const OTHER = { slug: 'other', name: 'Other', bio: 'Someone else.', images: [] };

function renderAt(path) {
    let tree;
    act(() => {
        tree = create(
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/gallery/:slug/" element={<GalleryCharacterRoute />} />
                </Routes>
            </MemoryRouter>
        );
    });
    return tree;
}

function withStubs({ embedded = null, characters = [] }, run) {
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;
    const originalTitle = globalThis.document?.title;

    globalThis.document = {
        title: '',
        getElementById: () => (embedded ? { dataset: { character: JSON.stringify(embedded) } } : null),
    };
    globalThis.fetch = async () => new Response(JSON.stringify({ characters }), { status: 200 });

    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = originalFetch;
        if (originalDocument === undefined) delete globalThis.document;
        else {
            globalThis.document = originalDocument;
            globalThis.document.title = originalTitle;
        }
    });
}

function textOf(tree) {
    return JSON.stringify(tree.toJSON());
}

test('renders from the embedded attribute when its slug matches the route', async () => {
    await withStubs({ embedded: VYPHIR, characters: [] }, async () => {
        const tree = renderAt('/gallery/vyphir/');
        await act(async () => {});
        assert.match(textOf(tree), /Vyphir/);
    });
});

test('ignores embedded data belonging to another character and fetches instead', async () => {
    await withStubs({ embedded: OTHER, characters: [VYPHIR, OTHER] }, async () => {
        const tree = renderAt('/gallery/vyphir/');
        await act(async () => {});
        const text = textOf(tree);
        assert.match(text, /Vyphir/);
        assert.doesNotMatch(text, /Someone else/);
    });
});

test('fetches and selects by slug when no attribute is present', async () => {
    await withStubs({ embedded: null, characters: [VYPHIR, OTHER] }, async () => {
        const tree = renderAt('/gallery/vyphir/');
        await act(async () => {});
        assert.match(textOf(tree), /Vyphir/);
    });
});

test('renders nothing rather than crashing when the slug matches no character', async () => {
    await withStubs({ embedded: null, characters: [OTHER] }, async () => {
        const tree = renderAt('/gallery/missing/');
        await act(async () => {});
        assert.equal(tree.toJSON(), null);
    });
});

test('sets the document title once the character resolves', async () => {
    await withStubs({ embedded: null, characters: [VYPHIR] }, async () => {
        renderAt('/gallery/vyphir/');
        await act(async () => {});
        assert.equal(globalThis.document.title, 'Vyphir | Vyphir');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/gallery-character-route.test.js`
Expected: FAIL. The current component reads the attribute unconditionally and never fetches, so the second, third and fifth tests fail.

- [ ] **Step 3: Write the implementation**

Replace `src/pages/GalleryCharacterRoute.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GalleryCharacter from './GalleryCharacter.jsx';

/*
 * The build bakes each character onto #root as data-character, which is the
 * fast path on a full page load. Client-side navigation from /gallery/ leaves
 * the document that was served for /gallery/, so that attribute is either
 * absent or belongs to a different character -- hence the slug check and the
 * fetch fallback, which is the same pattern GalleryIndexGrid, QueueBoard,
 * TosPointList and Commissions already use (spec section 7).
 */
function readEmbeddedCharacter(slug) {
    if (typeof document === 'undefined') return null;
    const raw = document.getElementById('root')?.dataset.character;
    if (!raw) return null;
    try {
        const character = JSON.parse(raw);
        return character && character.slug === slug ? character : null;
    } catch {
        return null;
    }
}

export default function GalleryCharacterRoute() {
    const { slug } = useParams();
    const [character, setCharacter] = useState(() => readEmbeddedCharacter(slug));

    useEffect(() => {
        const embedded = readEmbeddedCharacter(slug);
        if (embedded) {
            setCharacter(embedded);
            return undefined;
        }
        let cancelled = false;
        setCharacter(null);
        fetch('/data/characters.json')
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                const match = (data.characters || []).find((c) => c.slug === slug);
                setCharacter(match || null);
            })
            .catch((error) => {
                console.error(error);
                if (!cancelled) setCharacter(null);
            });
        return () => {
            cancelled = true;
        };
    }, [slug]);

    // The browser set this for free on a full page load; under client-side
    // navigation only this component knows the name (spec section 3).
    useEffect(() => {
        if (character) document.title = `${character.name} | Vyphir`;
    }, [character]);

    if (!character) return null;
    return <GalleryCharacter character={character} />;
}
```

- [ ] **Step 4: Run the new tests, then the whole suite**

Run: `node --test --import ./tests/jsx-loader.mjs tests/gallery-character-route.test.js`
Expected: PASS, 5 tests.

Run: `npm test`
Expected: PASS. `tests/publish-character.test.js` and `tests/render-pages.test.js` cover the build's static character pages; the embedded fast path is unchanged when the slug matches, so they must stay green.

- [ ] **Step 5: Commit**

```bash
git add src/pages/GalleryCharacterRoute.jsx tests/gallery-character-route.test.js
git commit -m "fix: resolve the character by slug under client-side navigation"
```

---

### Task 9: Keep the hub's preview art after a client-side navigation home

**Files:**
- Modify: `src/pages/Landing.jsx`
- Modify: `scripts/render-pages.js` (the comment block around line 124 only)
- Test: `tests/landing-previews-fallback.test.js` (create)

**Interfaces:**
- Consumes: `selectLandingPreviews` from `shared/landing-previews.js`, already used by `scripts/render-pages.js`; `/data/characters.json` and `/data/commissions.json`.
- Produces: no new exports. `Landing` keeps its `previews` prop and its markup.

This is the spec gap named at the top of this plan. `Landing.jsx` reads `data-previews` off `#root` once at hydration, and its own comment says both halves break the moment client-side routing to `/` exists. Every page's back-link points at `/`, so after Task 7 that is a common navigation, and without this the hub silently falls back to flat blobs.

- [ ] **Step 1: Write the failing test**

Create `tests/landing-previews-fallback.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from 'react-test-renderer';
import Landing from '../src/pages/Landing.jsx';

const CHARACTERS = { characters: [{ slug: 'a', name: 'A', images: [{ url: 'https://img/a.png', nsfw: false }] }] };
const COMMISSIONS = { pastWork: [{ url: 'https://img/c.png', nsfw: false }] };

function withFetch(run) {
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;
    const calls = [];

    globalThis.document = { getElementById: () => null };
    globalThis.fetch = async (url) => {
        calls.push(url);
        const body = url.includes('characters') ? CHARACTERS : COMMISSIONS;
        return new Response(JSON.stringify(body), { status: 200 });
    };

    return Promise.resolve(run(calls)).finally(() => {
        globalThis.fetch = originalFetch;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    });
}

test('fetches preview art when there is no prop and no embedded data', async () => {
    await withFetch(async (calls) => {
        let tree;
        act(() => {
            tree = create(<Landing />);
        });
        await act(async () => {});
        assert.deepEqual(calls.sort(), ['/data/characters.json', '/data/commissions.json']);
        assert.match(JSON.stringify(tree.toJSON()), /https:\/\/img\/a\.png/);
    });
});

test('does not fetch when previews were passed as a prop', async () => {
    await withFetch(async (calls) => {
        act(() => {
            create(<Landing previews={{ gallery: ['https://img/p.png'], commissions: [] }} />);
        });
        await act(async () => {});
        assert.deepEqual(calls, []);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import ./tests/jsx-loader.mjs tests/landing-previews-fallback.test.js`
Expected: FAIL on the first test — no fetch happens, so `calls` is empty.

- [ ] **Step 3: Write the implementation**

In `src/pages/Landing.jsx`, add the imports:

```jsx
import { useEffect, useState } from 'react';
import { BLOB_PATHS } from '../components/decor/blob-paths.js';
import { selectLandingPreviews } from '../../shared/landing-previews.js';
```

Replace the comment block above `readEmbeddedPreviews` with one that matches the new reality:

```jsx
/*
 * Preview art is baked into the page at build time (landing-hub spec section
 * 4): the SSG writes it onto #root as data-previews and this reads it back at
 * hydration. `renderLanding` in scripts/render-pages.js bypasses the router
 * for '/' for the same reason -- it renders <Landing> directly with the
 * preview data instead of going through <App>.
 *
 * That covers a full page load only. Since the gravity-drop transitions
 * (page-transitions spec section 3) every internal link is a client-side
 * navigation, so arriving at '/' from any other page leaves the document that
 * was served for that page and #root carries no data-previews at all. The
 * effect below is the fallback for exactly that case: it derives the same
 * previews from the same two JSON files the build reads, using the same
 * shared selector, so both paths always agree.
 */
```

Replace the body of the `Landing` component's state setup:

```jsx
export default function Landing({ previews }) {
    const [embedded, setEmbedded] = useState(readEmbeddedPreviews);

    useEffect(() => {
        if (previews || embedded) return undefined;
        let cancelled = false;
        Promise.all([
            fetch('/data/characters.json').then((r) => r.json()),
            fetch('/data/commissions.json').then((r) => r.json()),
        ])
            .then(([characters, commissions]) => {
                if (!cancelled) setEmbedded(selectLandingPreviews(characters, commissions));
            })
            .catch((error) => {
                console.error(error);
            });
        return () => {
            cancelled = true;
        };
    }, [previews, embedded]);
```

Leave the rest of the component, including the `previews ?? embedded` resolution and all markup, exactly as it is.

- [ ] **Step 4: Correct the stale comment in the build script**

In `scripts/render-pages.js`, the comment above the `renderLanding` call (around line 124) currently says in-app routing to `/` would silently break the hub. Replace the paragraph that describes that breakage with:

```js
         * Client-side routing to '/' now exists (page-transitions spec
         * section 3), so Landing carries a fetch fallback for the case where
         * #root has no data-previews. This path stays as it is: it is the
         * fast, no-request path for a full page load.
```

Do not change any code in this file.

- [ ] **Step 5: Run the new tests, then the whole suite**

Run: `node --test --import ./tests/jsx-loader.mjs tests/landing-previews-fallback.test.js`
Expected: PASS, 2 tests.

Run: `npm test`
Expected: PASS. `tests/landing-page.test.js` asserts the server-rendered hub markup, which is unchanged because the prop path still short-circuits the effect.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Landing.jsx scripts/render-pages.js tests/landing-previews-fallback.test.js
git commit -m "fix: keep hub preview art after a client-side navigation home"
```

---

### Task 10: Manual browser pass and tuning

**Files:**
- Create: `.superpowers/sdd/2026-09-10-page-transitions/drive.mjs`
- Create: `.superpowers/sdd/2026-09-10-page-transitions/shoot.sh`
- Possibly modify: `src/transitions/physics.js` (the `MOTION` constants only)

The spec's motion constants are explicitly starting points to be tuned against real pages. Everything before this task is verified by unit tests; the fall itself can only be judged by looking at it. A headless screenshot cannot click, so this task builds a small Chrome DevTools Protocol driver first. Node 26 ships a global `WebSocket`, so this needs no dependency either.

- [ ] **Step 1: Build the CDP driver**

Create `.superpowers/sdd/2026-09-10-page-transitions/drive.mjs`:

```js
/*
 * Drive a headless Chromium over the DevTools Protocol: open a page, click a
 * selector, and screenshot at a list of delays. Node 26's global WebSocket
 * means no dependency.
 *
 * Usage:
 *   node drive.mjs <url> <selector> <label> <width> <height> <delay-ms...>
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;
const [url, selector, label, width, height, ...delays] = process.argv.slice(2);

const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${width},${height}`,
    '--remote-debugging-port=9333', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function endpoint() {
    for (let i = 0; i < 50; i++) {
        try {
            const list = await fetch('http://127.0.0.1:9333/json/list').then((r) => r.json());
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
ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (resolve) { pending.delete(message.id); resolve(message.result); }
});
function send(method, params = {}) {
    const messageId = ++id;
    return new Promise((resolve) => {
        pending.set(messageId, resolve);
        ws.send(JSON.stringify({ id: messageId, method, params }));
    });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
    width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: false,
});
await send('Page.navigate', { url });
await wait(2500);

const box = await send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null; const r = el.getBoundingClientRect();
        return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()`,
    returnByValue: true,
});
if (!box.result.value) throw new Error(`selector not found: ${selector}`);
const point = JSON.parse(box.result.value);

await mkdir(join(HERE, 'shots'), { recursive: true });
const started = Date.now();
for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

// How many pieces the walk actually produced, straight off the overlay.
await wait(100);
const count = await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll(".gd-piece").length',
    returnByValue: true,
});
console.log(`pieces: ${count.result.value}`);

for (const delay of delays.map(Number).sort((a, b) => a - b)) {
    await wait(Math.max(0, started + delay - Date.now()));
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(HERE, 'shots', `${label}-${width}-${delay}ms.png`);
    await writeFile(file, Buffer.from(shot.data, 'base64'));
    console.log(`wrote ${file}`);
}

ws.close();
chrome.kill();
```

Create `.superpowers/sdd/2026-09-10-page-transitions/shoot.sh`:

```bash
#!/usr/bin/env bash
# Capture a gravity-drop transition mid-fall.
# Usage: bash shoot.sh <label> <path> <selector>
# Requires: npm run build since the last CSS/JSX edit.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
OLD="$ROOT/.superpowers/sdd/2026-09-07-landing-hub"
W="$ROOT/.superpowers/sdd/2026-09-10-page-transitions"
LABEL="${1:?usage: shoot.sh <label> <path> <selector>}"
PATH_="${2:?}"
SELECTOR="${3:?}"
PORT=8099
if ! curl -sf -o /dev/null "http://localhost:$PORT/"; then
  nohup node "$OLD/serve.mjs" "$ROOT/dist/client" $PORT > "$W/serve.log" 2>&1 &
  sleep 2
fi
for wh in 1440x900 375x800; do
  w="${wh%x*}"; h="${wh#*x}"
  node "$W/drive.mjs" "http://localhost:$PORT$PATH_" "$SELECTOR" "$LABEL" "$w" "$h" 120 350 700 1200
done
```

- [ ] **Step 2: Build and capture the hub falling**

Run:

```bash
npm run build
bash .superpowers/sdd/2026-09-10-page-transitions/shoot.sh hub / '.hub-item--gallery'
```

Expected: eight PNGs under that directory's `shots/`. Read them. Confirm at `120ms` the pieces have barely moved and nothing has jumped, snapped upright, lost its colour or lost its clipped preview art; at `350ms` and `700ms` the hub is visibly coming apart over the gallery page; at `1200ms` the overlay is gone and the gallery is clean.

- [ ] **Step 3: Capture the gallery falling, and count its pieces**

Run:

```bash
bash .superpowers/sdd/2026-09-10-page-transitions/shoot.sh gallery /gallery/ '.back-link'
```

The gallery is the page most likely to hit the 150-piece ceiling, so the driver prints the count it produced (`pieces: N`, counted off the live overlay 100ms after the click). Record the number for both the hub and the gallery in the Step 9 commit message, so the ceiling's real headroom is on file rather than assumed.

If the gallery prints a count at or near 150 and the `350ms` frames show whole cards tumbling rather than card shell, image and title falling separately, the ceiling engaged and the walk went shallower. That is correct behaviour, not a defect. Note it; do not raise the ceiling to get a prettier frame without re-checking the phone viewport for dropped frames.

- [ ] **Step 4: Verify the things screenshots cannot show**

By hand, with `npm run dev` or the static server:

- Click a character card from `/gallery/`. The correct character renders, and the tab title becomes `<name> | Vyphir`.
- Click through `/` to `/gallery/` to `/commissions/` to `/tos/` to `/queue/` and back to `/`. Each title matches the route table, the scroll position resets, and the hub's preview art is still real art on return, not flat blobs.
- Middle-click and ctrl-click an internal link. A new tab opens and no transition runs.
- Click each of the six hub social links. They leave the site normally.
- Navigate to `/admin/` from a link. It is a full page load with no transition.
- Scroll `/tos/` down, then navigate away. Nothing falls from above the viewport, and the new page starts at the top.

- [ ] **Step 5: Verify reduced motion skips the effect entirely**

Run:

```bash
node .superpowers/sdd/2026-09-10-page-transitions/drive.mjs \
  http://localhost:8099/ '.hub-item--gallery' reduced 1440 900 120 350
```

with `'--force-prefers-reduced-motion=reduce'` added to the Chrome argument list in `drive.mjs` for this run only. Expected: both frames show the gallery page already fully rendered with no falling pieces and no overlay. Revert the flag afterwards.

- [ ] **Step 6: Firefox**

The spec records Firefox headless as unavailable, but Playwright's Firefox is present at `~/.cache/ms-playwright/firefox-1538/firefox/firefox`. Try it:

```bash
~/.cache/ms-playwright/firefox-1538/firefox/firefox --headless --screenshot \
  /tmp/ff-hub.png --window-size=1440,900 http://localhost:8099/
```

If that produces a correct still of the hub, Firefox renders the site and the CSP verdict in spec §2 can be extended to it by checking the console for style violations. If it does not run, say so plainly and hand the click-through in Step 4 to the site owner, who uses Firefox as their primary browser. Either way, record the outcome; do not claim a Firefox pass that did not happen.

- [ ] **Step 7: Tune**

If the fall reads as too slow, too fast, too uniform or too chaotic, change only the `MOTION` object in `src/transitions/physics.js` and re-capture. The range assertions in `tests/transitions-physics.test.js` are written against `MOTION` itself, so they follow the constants rather than pinning them. Do not move the tuning into `fall.js`.

- [ ] **Step 8: Full suite and the CSP guard**

Run: `npm test`
Expected: PASS, the original 197 tests plus the new ones.

Run: `grep -rn "setAttribute('style'\|setAttribute(\"style\"" src/ scripts/ shared/`
Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add .superpowers/sdd/2026-09-10-page-transitions src/transitions/physics.js
git commit -m "chore: add the transition capture harness and tune the fall"
```

---

## Done when

Checked against spec §11:

- [ ] Clicking an internal link breaks the outgoing page into pieces that fall and tumble off the bottom, revealing the incoming page (Tasks 3, 5, 7; verified Task 10 Steps 2 and 3).
- [ ] The background stays put; everything else falls (Task 3 — the walk starts at `#root`'s first element child, so `body` is never part of it).
- [ ] Middle-click, modifier-click, external links, `/admin/` and `/i/<id>` behave exactly as they do today (Tasks 1, 2, 7; verified Task 10 Step 4).
- [ ] Character pages render the right character after a client-side navigation (Task 8).
- [ ] Titles and scroll position are correct on every client-side navigation (Tasks 1, 7, 8; verified Task 10 Step 4).
- [ ] Reduced motion skips the effect (Task 7; verified Task 10 Step 5).
- [ ] No `setAttribute('style', …)` anywhere in the feature (Task 10 Step 8).
- [ ] Full test suite green, with the new unit tests (Task 10 Step 8).
- [ ] Manual pass complete, including Firefox or an explicit record of why not (Task 10 Step 6).

Plus the one item the spec did not anticipate:

- [ ] The hub still shows real preview art after navigating home client-side (Task 9).
