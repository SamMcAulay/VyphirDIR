# Slime Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace vyphir.com's dark, notched-corner "datapad" theme with a light, bright, rounded "Slime Rancher"-inspired design system — saturated color-block panels on a warm cream base, chunky rounded typography, organic decorative blob shapes, and satisfying click-pop / letter-wave micro-interactions — across every existing page and (lightly) the admin panel.

**Architecture:** Pure CSS + small reusable React components, no new npm dependencies. A new token set in `public/styles.css` replaces the old dark palette; a `Panel` component replaces the old `.datapad-wrapper`/`.datapad-screen` structure everywhere; a small `Blob` decorative component, a `WaveText` component, and a `usePopClick` hook are built once and reused across every page. `Background.jsx` (the three.js starfield) and the `three` npm dependency are deleted outright.

**Tech Stack:** Existing React 19 / Vite 8 / React Router 7 stack, unchanged. Two new Google Fonts (Fredoka, Nunito) replacing the current two (Space Mono, Quicksand). No new npm packages.

**Spec:** [2026-09-06-slime-design-system-design.md](../specs/2026-09-06-slime-design-system-design.md)

## Global Constraints

- No new npm dependencies. `three` is removed (not replaced).
- No routing, build-pipeline, or CMS/API code changes — `functions/`, `data/*.json`, `scripts/render-pages.js`'s route-generation logic, and every existing route path stay exactly as they are. Only `scripts/render-pages.js`'s `renderShell()` font `<link>` tags change.
- Design tokens (exact names and values, all in `public/styles.css`'s `:root`):
  - `--bg-cream: #FFF6E9;` `--surface: #FFFFFF;` `--text-ink: #3A2A24;` `--text-muted: #8A7368;` `--outline-w: 3px;` `--radius-panel: 32px;` `--radius-button: 999px;`
  - `--slime-pink: #FF6FA0;` `--slime-pink-light: #FFD3E4;` `--slime-pink-dark: #E14C82;`
  - `--slime-teal: #23C9B7;` `--slime-teal-light: #C6F5EF;` `--slime-teal-dark: #189E90;`
  - `--slime-honey: #FFC93C;` `--slime-honey-light: #FFEDB0;` `--slime-honey-dark: #E0A800;`
  - `--slime-lavender: #B98CFF;` `--slime-lavender-light: #E7D8FF;` `--slime-lavender-dark: #8F5FE0;`
  - `--slime-tabby: #FF9A44;` `--slime-tabby-light: #FFE0BE;` `--slime-tabby-dark: #E07A1F;`
  - `--accent` / `--accent-light` / `--accent-dark` default to the pink triad at `:root`; each page overrides them via a `.page-<color>` class on its outermost element (see Task 2's per-page mapping table).
- Typography: **Fredoka** for headings/display/buttons, **Nunito** for body text — replacing `Space Mono`/`Quicksand` everywhere, including in `admin.css`.
- Functional UI (buttons, inputs, panels) stays rounded-rectangle or pill (`--radius-panel` / `--radius-button`) — never an organic blob. Organic blobs (Task 4) are decoration and image-framing only.
- Every existing `node --test` either keeps passing unmodified or is updated in the same task that changes the markup/class it asserts on — never left broken between tasks. The suite is 159 tests before this plan starts; run `npm test` after every task.
- `prefers-reduced-motion: reduce` must disable ambient blob drift and shorten the pop/wave animations to near-instant (Tasks 4, 5, 6).
- Admin (`public/admin/admin.css`, `src/pages/Admin.jsx`, `src/components/admin/*.jsx`) gets tokens/fonts/colors only — no Panel, no blobs, no WaveText/pop-click, no layout changes. Its existing rounded-corner scale (6px/8px/12px) and flex layouts stay as they are.

---

## File Structure

```
public/
  styles.css                    # modify: full token/theme rewrite + per-page/component rules
  admin/admin.css                # modify: token/color/font swap only, structure untouched
src/
  components/
    Panel.jsx                    # create: replaces .datapad-wrapper/.datapad-screen
    WaveText.jsx                 # create: per-letter hover-wave text
    decor/
      Blob.jsx                   # create: decorative organic blob shape
    Background.jsx                # delete: three.js starfield, no longer used
  hooks/
    usePopClick.js                # create: click "pop" interaction hook
  pages/
    Landing.jsx                   # modify: Panel + WaveText + pop-click + page-pink
    Gallery.jsx                   # modify: Panel + WaveText + page-teal
    GalleryCharacter.jsx          # modify: Panel + WaveText + page-teal
    Commissions.jsx               # modify: Panel + WaveText + pop-click + page-honey
    Tos.jsx                       # modify: Panel + WaveText + page-lavender
    Queue.jsx                     # modify: Panel + WaveText + page-tabby
  App.jsx                        # modify: remove <Background/> and its useLocation gate
  entry-server.jsx                # modify: remove <Background/> from renderCharacter()
tests/
  landing-page.test.js            # modify: assert new panel/page-pink classes
  gallery-index-page.test.js      # modify: assert new panel/page-teal classes
  # (character-page test coverage lives inside render-pages.test.js — see Task 9)
  commissions-page.test.js        # modify: assert new panel/page-honey classes
  tos-page.test.js                # modify: assert new panel/page-lavender classes
  queue-page.test.js              # modify: assert new panel/page-tabby classes
  wave-text.test.js               # create: WaveText span-splitting behavior
package.json                     # modify: remove `three`
```

---

## Task 1: Design tokens + global base styles

**Files:**
- Modify: `public/styles.css:1–162` (the `:root` block through the pre-existing `.datapad-wrapper*` rules, `#webgl-canvas`, and the `@view-transition`/`::view-transition-*`/`@keyframes panel-flip-*` block)
- Modify: `scripts/render-pages.js` (Google Fonts `<link>` in `renderShell()`)

**Interfaces:**
- Produces: the full token set listed in Global Constraints, available to every later task via `var(--token-name)`.
- Produces: `body` styled on the new cream/ink palette with Nunito as the default font.

- [ ] **Step 1: Replace `public/styles.css`'s `:root` block and remove the old view-transition/webgl-canvas rules**

Replace lines 1–52 of `public/styles.css` (the `:root` block through the `* { box-sizing... }` reset) with:

```css
:root {
    --bg-cream: #FFF6E9;
    --surface: #FFFFFF;
    --text-ink: #3A2A24;
    --text-muted: #8A7368;
    --outline-w: 3px;
    --radius-panel: 32px;
    --radius-button: 999px;

    --slime-pink: #FF6FA0;
    --slime-pink-light: #FFD3E4;
    --slime-pink-dark: #E14C82;

    --slime-teal: #23C9B7;
    --slime-teal-light: #C6F5EF;
    --slime-teal-dark: #189E90;

    --slime-honey: #FFC93C;
    --slime-honey-light: #FFEDB0;
    --slime-honey-dark: #E0A800;

    --slime-lavender: #B98CFF;
    --slime-lavender-light: #E7D8FF;
    --slime-lavender-dark: #8F5FE0;

    --slime-tabby: #FF9A44;
    --slime-tabby-light: #FFE0BE;
    --slime-tabby-dark: #E07A1F;

    --accent: var(--slime-pink);
    --accent-light: var(--slime-pink-light);
    --accent-dark: var(--slime-pink-dark);

    --shadow-pop: 6px 6px 0 var(--accent-dark);
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}
```

This deletes the old `@view-transition { navigation: auto; }` block, `.datapad-screen { view-transition-name: main-panel; }`, `::view-transition-group/old/new(main-panel)`, and `@keyframes panel-flip-out/panel-flip-in` entirely — they animated a selector (`.datapad-screen`) that no longer exists after Task 2, and the spec explicitly defers any page-transition system to a later sub-project.

- [ ] **Step 2: Update the base input/body rules**

Replace the `input, select, textarea, button { ... }` block (old lines 53–62) with:

```css
input, select, textarea, button {
    font-family: 'Nunito', sans-serif;
    font-size: inherit;
    color: inherit;
    background: transparent;
    border: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
}
```

Replace the old `body { ... }` block (old lines 138–142) with:

```css
body {
    font-family: 'Nunito', sans-serif;
    background: var(--bg-cream);
    color: var(--text-ink);
    overflow-x: hidden;
}
```

Delete the `#webgl-canvas { ... }` block entirely (old lines 144–152) — `Background.jsx` and its canvas are removed in Task 7.

- [ ] **Step 3: Update checkbox/radio/file-input styling to the new palette**

Replace the `input[type="checkbox"]`, `input[type="checkbox"]:checked`, `input[type="checkbox"]:checked::after`, `input[type="radio"]`, `input[type="radio"]:checked`, `input[type="radio"]:checked::after`, and `input[type="file"]::file-selector-button` blocks (old lines 64–136) with:

```css
input[type="checkbox"] {
    width: 18px;
    height: 18px;
    min-width: 18px;
    border: 2px solid var(--accent);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
    position: relative;
    vertical-align: middle;
}

input[type="checkbox"]:checked {
    background: var(--accent);
    border-color: var(--accent);
}

input[type="checkbox"]:checked::after {
    content: '\2713';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--surface);
    font-size: 12px;
    line-height: 1;
}

input[type="radio"] {
    width: 18px;
    height: 18px;
    min-width: 18px;
    border: 2px solid var(--accent);
    border-radius: 50%;
    background: var(--surface);
    cursor: pointer;
    position: relative;
    vertical-align: middle;
}

input[type="radio"]:checked {
    border-color: var(--accent);
}

input[type="radio"]:checked::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent);
}

input[type="file"]::file-selector-button,
input[type="file"]::-webkit-file-upload-button {
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: var(--radius-button);
    background: var(--accent);
    color: var(--surface);
    border: none;
    cursor: pointer;
    margin-right: 10px;
}

input[type="file"]::file-selector-button:hover,
input[type="file"]::-webkit-file-upload-button:hover {
    background: var(--accent-dark);
}
```

- [ ] **Step 4: Swap the Google Fonts `<link>` in `scripts/render-pages.js`**

In `scripts/render-pages.js`'s `renderShell()`, find this line:

```js
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
```

Replace it with:

```js
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
```

- [ ] **Step 5: Build and confirm no crash**

```bash
npm run build
```

Expected: build succeeds (the site will look visually broken/unstyled for now — the old `.datapad-*`/`.link-btn`/etc. selectors that reference now-removed tokens like `var(--bg-dark)` will fall back to CSS's default "invalid value" behavior, i.e. those properties simply won't apply; this is expected and fixed page-by-page in Tasks 8–13). This step only confirms the build pipeline itself doesn't error.

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```

Expected: all 159 tests still pass — nothing in this task touches JSX or class names, only CSS values and one font `<link>`, so no test should be affected.

- [ ] **Step 7: Commit**

```bash
git add public/styles.css scripts/render-pages.js
git commit -m "feat: replace dark datapad theme tokens with Slime design system palette"
```

---

## Task 2: `Panel` component (replaces `.datapad-wrapper`/`.datapad-screen`)

**Files:**
- Create: `src/components/Panel.jsx`
- Modify: `public/styles.css` (add `.panel-wrapper`/`.panel`/`.page-*` rules, remove old `.datapad-wrapper*`/`.datapad-screen*` rules)
- Test: `tests/panel.test.js`

**Interfaces:**
- Produces: `<Panel wide xwide className>` — a React component. Renders `<div className="panel-wrapper {sizeClass}"><div className="panel {className}">{children}</div></div>`, where `sizeClass` is `panel--wide` when `wide` is true, `panel--xwide` when `xwide` is true, and empty otherwise (matching the old `datapad-wrapper`/`datapad-wrapper--wide`/`datapad-wrapper--xwide` size variants one-for-one).
- Produces: five page-accent CSS classes — `page-pink`, `page-teal`, `page-honey`, `page-lavender`, `page-tabby` — each overriding `--accent`/`--accent-light`/`--accent-dark`. Later tasks apply exactly one of these to each page's outermost element (see the table in Step 2).

- [ ] **Step 1: Write `src/components/Panel.jsx`**

```jsx
export default function Panel({ children, wide = false, xwide = false, className = '' }) {
    const sizeClass = xwide ? 'panel--xwide' : wide ? 'panel--wide' : '';
    return (
        <div className={`panel-wrapper ${sizeClass}`.trim()}>
            <div className={`panel ${className}`.trim()}>{children}</div>
        </div>
    );
}
```

- [ ] **Step 2: Add `.panel-wrapper`/`.panel`/`.page-*` CSS, remove the old `.datapad-*` rules**

In `public/styles.css`, delete the `.datapad-wrapper`, `.datapad-wrapper--wide`, `.datapad-wrapper--xwide`, `.datapad-screen`, and `.datapad-screen::before` rules (old lines 154–200) and replace them with:

```css
.panel-wrapper {
    width: 100%;
    max-width: 460px;
    margin: 40px auto;
    padding: 0 15px;
    position: relative;
    z-index: 10;
}

.panel-wrapper.panel--wide {
    max-width: 700px;
}

.panel-wrapper.panel--xwide {
    max-width: 1100px;
}

.panel {
    position: relative;
    background: var(--surface);
    border: var(--outline-w) solid var(--accent);
    border-radius: var(--radius-panel);
    box-shadow: var(--shadow-pop);
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 25px;
}

.page-pink { --accent: var(--slime-pink); --accent-light: var(--slime-pink-light); --accent-dark: var(--slime-pink-dark); }
.page-teal { --accent: var(--slime-teal); --accent-light: var(--slime-teal-light); --accent-dark: var(--slime-teal-dark); }
.page-honey { --accent: var(--slime-honey); --accent-light: var(--slime-honey-light); --accent-dark: var(--slime-honey-dark); }
.page-lavender { --accent: var(--slime-lavender); --accent-light: var(--slime-lavender-light); --accent-dark: var(--slime-lavender-dark); }
.page-tabby { --accent: var(--slime-tabby); --accent-light: var(--slime-tabby-light); --accent-dark: var(--slime-tabby-dark); }
```

Page-to-accent mapping (used by Tasks 8–12; record it here so each task can be dispatched independently):

| Page | Class |
|---|---|
| Landing | `page-pink` |
| Gallery + GalleryCharacter | `page-teal` |
| Commissions | `page-honey` |
| Tos | `page-lavender` |
| Queue | `page-tabby` |

- [ ] **Step 3: Write `tests/panel.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Panel from '../src/components/Panel.jsx';

test('renders default size with no modifier class', () => {
    const html = renderToStaticMarkup(<Panel>hi</Panel>);
    assert.match(html, /class="panel-wrapper "?>/);
    assert.doesNotMatch(html, /panel--wide/);
    assert.doesNotMatch(html, /panel--xwide/);
});

test('renders the wide variant', () => {
    const html = renderToStaticMarkup(<Panel wide>hi</Panel>);
    assert.match(html, /class="panel-wrapper panel--wide"/);
});

test('renders the xwide variant', () => {
    const html = renderToStaticMarkup(<Panel xwide>hi</Panel>);
    assert.match(html, /class="panel-wrapper panel--xwide"/);
});

test('passes through an extra className on the inner panel', () => {
    const html = renderToStaticMarkup(<Panel className="extra">hi</Panel>);
    assert.match(html, /class="panel extra"/);
});

test('renders children inside the panel', () => {
    const html = renderToStaticMarkup(<Panel><p>content</p></Panel>);
    assert.match(html, /<p>content<\/p>/);
});
```

- [ ] **Step 4: Run the test**

```bash
node --test --import ./tests/jsx-loader.mjs tests/panel.test.js
```

Expected: 5/5 pass. Note: the default-size test's regex allows for React's exact whitespace serialization (`class="panel-wrapper "` with a trailing space from the empty `sizeClass`, or `class="panel-wrapper"` if you trim it in the component — if the test fails on this specific point, adjust `Panel.jsx`'s template literal to trim trailing whitespace with `.trim()` on the wrapper's className too, matching the inner panel's existing `.trim()`, and re-run).

- [ ] **Step 5: Full build + test**

```bash
npm run build && npm test
```

Expected: 164 tests pass (159 + 5 new). Nothing else references `Panel` yet, so no other test is affected.

- [ ] **Step 6: Commit**

```bash
git add src/components/Panel.jsx public/styles.css tests/panel.test.js
git commit -m "feat: add Panel component and page-accent theming, replacing datapad-wrapper/screen"
```

---

## Task 3: `WaveText` component

**Files:**
- Create: `src/components/WaveText.jsx`
- Modify: `public/styles.css` (add `.wave-text`/`.wave-text-letter` rules and the `@keyframes wave-bounce`)
- Test: `tests/wave-text.test.js`

**Interfaces:**
- Produces: `<WaveText text="..." as="h1" className="...">` — splits `text` into one `<span className="wave-text-letter">` per character (spaces become non-breaking spaces so they don't collapse), wrapped in `as` (defaults to `span`) with `className="wave-text {className}"`.

- [ ] **Step 1: Write `src/components/WaveText.jsx`**

```jsx
export default function WaveText({ text, as: Tag = 'span', className = '' }) {
    const letters = Array.from(text);
    return (
        <Tag className={`wave-text ${className}`.trim()}>
            {letters.map((ch, i) => (
                <span className="wave-text-letter" style={{ '--i': i }} key={i}>
                    {ch === ' ' ? ' ' : ch}
                </span>
            ))}
        </Tag>
    );
}
```

- [ ] **Step 2: Add the wave-hover CSS**

Append to `public/styles.css`:

```css
.wave-text-letter {
    display: inline-block;
}

.wave-text:hover .wave-text-letter {
    animation: wave-bounce 0.6s ease-in-out;
    animation-delay: calc(var(--i) * 0.04s);
}

@keyframes wave-bounce {
    0%, 100% { transform: translateY(0); }
    30% { transform: translateY(-10px); }
    60% { transform: translateY(2px); }
}

@media (prefers-reduced-motion: reduce) {
    .wave-text:hover .wave-text-letter {
        animation: none;
    }
}
```

- [ ] **Step 3: Write `tests/wave-text.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import WaveText from '../src/components/WaveText.jsx';

test('splits text into one span per character', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi!" />);
    const matches = html.match(/class="wave-text-letter"/g) || [];
    assert.equal(matches.length, 3);
});

test('renders spaces as non-breaking spaces so they do not collapse', () => {
    const html = renderToStaticMarkup(<WaveText text="a b" />);
    assert.match(html, / /);
});

test('renders with the given tag name', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi" as="h1" />);
    assert.match(html, /^<h1 class="wave-text">/);
    assert.match(html, /<\/h1>$/);
});

test('defaults to a span wrapper', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi" />);
    assert.match(html, /^<span class="wave-text">/);
});

test('appends an extra className', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi" className="section-title" />);
    assert.match(html, /class="wave-text section-title"/);
});
```

- [ ] **Step 4: Run the test**

```bash
node --test --import ./tests/jsx-loader.mjs tests/wave-text.test.js
```

Expected: 5/5 pass.

- [ ] **Step 5: Full build + test**

```bash
npm run build && npm test
```

Expected: 169 tests pass (164 + 5 new).

- [ ] **Step 6: Commit**

```bash
git add src/components/WaveText.jsx public/styles.css tests/wave-text.test.js
git commit -m "feat: add WaveText component with per-letter hover animation"
```

---

## Task 4: `usePopClick` hook

**Files:**
- Create: `src/hooks/usePopClick.js`
- Modify: `public/styles.css` (add `.pop-clickable`/`.pop-active` rules and `@keyframes pop-bounce`)
- Test: `tests/use-pop-click.test.js`

**Interfaces:**
- Produces: `usePopClick()` — a React hook returning `{ className, onPointerUp }`. `className` is `'pop-active'` for 260ms after the last `onPointerUp` call, empty otherwise. Callers spread `onPointerUp` onto the interactive element and always include the static `pop-clickable` class alongside the hook's dynamic `className` (e.g. `className={`pop-clickable ${pop.className}`}`).

Since this hook has real branching logic (a timer-driven state flip) rather than being purely presentational, it needs a DOM-capable test — this repo has no jsdom, so it's tested via `react-test-renderer`'s no-DOM `act()` helper instead of `renderToStaticMarkup` (which can't run hooks' effects/timers). Check `package.json` first: if `react-test-renderer` isn't already a dependency, this is the one exception in this plan to "no new dependencies" — it's a devDependency needed only to unit-test a hook's timing behavior, matching React's own officially-supported no-DOM testing approach, and ships with zero runtime/production footprint.

- [ ] **Step 1: Check for `react-test-renderer`, install if missing**

```bash
grep -q "react-test-renderer" package.json || npm install --save-dev react-test-renderer@19.2.0
```

- [ ] **Step 2: Write `src/hooks/usePopClick.js`**

```js
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePopClick(durationMs = 260) {
    const [popping, setPopping] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const onPointerUp = useCallback(() => {
        setPopping(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setPopping(false), durationMs);
    }, [durationMs]);

    return { className: popping ? 'pop-active' : '', onPointerUp };
}
```

- [ ] **Step 3: Add the pop-click CSS**

Append to `public/styles.css`:

```css
.pop-clickable {
    transition: transform 0.08s ease;
}

.pop-clickable:active {
    transform: scale(0.92);
}

.pop-clickable.pop-active {
    animation: pop-bounce 0.26s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes pop-bounce {
    0% { transform: scale(0.92); }
    60% { transform: scale(1.08); }
    100% { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
    .pop-clickable.pop-active {
        animation: none;
    }
    .pop-clickable:active {
        transform: none;
    }
}
```

- [ ] **Step 4: Write `tests/use-pop-click.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from 'react-test-renderer';
import { usePopClick } from '../src/hooks/usePopClick.js';

function TestComponent({ onRender }) {
    const pop = usePopClick(50);
    onRender(pop);
    return null;
}

test('starts with no pop-active class', () => {
    let latest;
    act(() => {
        create(<TestComponent onRender={(pop) => { latest = pop; }} />);
    });
    assert.equal(latest.className, '');
});

test('sets pop-active immediately after onPointerUp', () => {
    let latest;
    act(() => {
        create(<TestComponent onRender={(pop) => { latest = pop; }} />);
    });
    act(() => {
        latest.onPointerUp();
    });
    assert.equal(latest.className, 'pop-active');
});

test('clears pop-active after the duration elapses', async () => {
    let latest;
    act(() => {
        create(<TestComponent onRender={(pop) => { latest = pop; }} />);
    });
    act(() => {
        latest.onPointerUp();
    });
    await new Promise((resolve) => {
        act(() => {
            setTimeout(resolve, 80);
        });
    });
    assert.equal(latest.className, '');
});
```

- [ ] **Step 5: Run the test**

```bash
node --test --import ./tests/jsx-loader.mjs tests/use-pop-click.test.js
```

Expected: 3/3 pass. If the third test is flaky on timing, increase the `await`'s delay (e.g. to 120ms) relative to the hook's 50ms test duration — it needs enough margin for the `setTimeout` to have fired.

- [ ] **Step 6: Full build + test**

```bash
npm run build && npm test
```

Expected: 172 tests pass (169 + 3 new).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/usePopClick.js public/styles.css tests/use-pop-click.test.js package.json package-lock.json
git commit -m "feat: add usePopClick hook with click-and-release pop animation"
```

---

## Task 5: `Blob` decorative component + ambient drift

**Files:**
- Create: `src/components/decor/Blob.jsx`
- Modify: `public/styles.css` (add `.decor-blob` rules and `@keyframes blob-drift`)
- Test: `tests/blob.test.js`

**Interfaces:**
- Produces: `<Blob variant={1|2|3|4} color="var(--slime-pink-light)" size={200} rotate={0} className="">` — renders an absolutely-positionable decorative `<svg>` blob. `variant` selects one of four fixed path shapes; `color` sets the fill; `size` sets both width and height in pixels; `rotate` sets a degree rotation; `className` is appended for positioning (callers apply `position: absolute; top/left/right/bottom` via their own CSS, `Blob` itself has no position opinion beyond the ambient drift animation).

- [ ] **Step 1: Write `src/components/decor/Blob.jsx`**

```jsx
const BLOB_PATHS = {
    1: 'M45,10 C80,0 130,5 160,35 C190,65 195,115 170,150 C145,185 90,195 55,175 C20,155 5,110 15,70 C22,45 25,18 45,10 Z',
    2: 'M60,15 C100,-5 150,15 175,55 C195,90 185,140 150,170 C115,198 55,195 25,160 C0,130 5,80 25,50 C35,35 45,22 60,15 Z',
    3: 'M90,5 C130,0 175,25 185,65 C195,105 175,150 135,175 C95,198 45,190 20,155 C-5,120 5,70 35,40 C55,20 70,8 90,5 Z',
    4: 'M50,25 C85,0 140,0 170,30 C200,60 195,110 165,145 C135,180 75,190 40,165 C5,140 0,90 15,60 C25,40 35,32 50,25 Z',
};

export default function Blob({ variant = 1, color = 'var(--slime-pink-light)', size = 200, rotate = 0, className = '' }) {
    const path = BLOB_PATHS[variant] || BLOB_PATHS[1];
    return (
        <svg
            className={`decor-blob ${className}`.trim()}
            width={size}
            height={size}
            viewBox="0 0 200 200"
            style={{ transform: `rotate(${rotate}deg)` }}
            aria-hidden="true"
        >
            <path d={path} fill={color} />
        </svg>
    );
}
```

- [ ] **Step 2: Add the ambient-drift CSS**

Append to `public/styles.css`:

```css
.decor-blob {
    pointer-events: none;
    animation: blob-drift 28s ease-in-out infinite;
}

@keyframes blob-drift {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    50% { transform: translate(12px, -16px) rotate(6deg); }
}

@media (prefers-reduced-motion: reduce) {
    .decor-blob {
        animation: none;
    }
}
```

Note: the inline `style={{ transform: rotate(...) }}` set by the component (Step 1) is a static base rotation per-instance; the CSS `@keyframes blob-drift` animates the same `transform` property via the animation engine, which overrides the inline style while the animation runs and naturally returns to a `translate(0,0) rotate(0deg)` state at 0%/100% — meaning the inline per-instance `rotate` prop is only visible as the animation's momentary reference frame, not the resting pose. This is intentional and acceptable for ambient decoration (the exact resting angle isn't load-bearing); if a future task wants the static per-instance rotation to persist as the true resting pose too, wrap the `<path>`'s parent in an extra static-rotation `<g transform="rotate(...)">` instead of rotating the whole `<svg>`, and drive `blob-drift` off a wrapping `<div>` instead. Not needed for this plan's scope — flag it in the task report if it looks visually wrong and note it as a follow-up rather than reworking it mid-task.

- [ ] **Step 3: Write `tests/blob.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Blob from '../src/components/decor/Blob.jsx';

test('renders an svg with the requested size', () => {
    const html = renderToStaticMarkup(<Blob size={150} />);
    assert.match(html, /width="150"/);
    assert.match(html, /height="150"/);
});

test('defaults to variant 1 path data', () => {
    const html = renderToStaticMarkup(<Blob />);
    assert.match(html, /d="M45,10 C80,0/);
});

test('renders a different path for variant 3', () => {
    const html = renderToStaticMarkup(<Blob variant={3} />);
    assert.match(html, /d="M90,5 C130,0/);
});

test('falls back to variant 1 for an unknown variant number', () => {
    const html = renderToStaticMarkup(<Blob variant={99} />);
    assert.match(html, /d="M45,10 C80,0/);
});

test('applies the given fill color', () => {
    const html = renderToStaticMarkup(<Blob color="#ff0000" />);
    assert.match(html, /fill="#ff0000"/);
});

test('appends an extra className alongside decor-blob', () => {
    const html = renderToStaticMarkup(<Blob className="hero-blob-1" />);
    assert.match(html, /class="decor-blob hero-blob-1"/);
});

test('is marked aria-hidden', () => {
    const html = renderToStaticMarkup(<Blob />);
    assert.match(html, /aria-hidden="true"/);
});
```

- [ ] **Step 4: Run the test**

```bash
node --test --import ./tests/jsx-loader.mjs tests/blob.test.js
```

Expected: 7/7 pass.

- [ ] **Step 5: Full build + test**

```bash
npm run build && npm test
```

Expected: 179 tests pass (172 + 7 new).

- [ ] **Step 6: Commit**

```bash
git add src/components/decor/Blob.jsx public/styles.css tests/blob.test.js
git commit -m "feat: add Blob decorative component with ambient drift animation"
```

---

## Task 6: Shared cross-page component styling

**Files:**
- Modify: `public/styles.css` (rules used by more than one page/component — see Step list)

**Interfaces:**
- None new — this task only restyles existing shared selectors so every later per-page task can rely on them already being correct.

This task restyles every CSS class currently used by **more than one** component, so per-page tasks (8–13) don't duplicate or diverge on shared visual language. Verified shared usage: `.back-link` (Gallery, GalleryCharacter, Commissions, Tos, Queue), `.gallery-empty` (`CharacterGalleryStrip`, `CommissionsPreviewStrip`, `GalleryIndexGrid`, `TosPointList`, `QueueBoard`), `.feed-error` (`BlueskyFeed`, `Commissions.jsx`), `.tier-card`/`.past-work-card` (`CommissionTierList`, `PastWorkGrid`, and `QueueBoard`'s `Card` which applies `queue-card tier-card` together), `.char-image-wrap`/`.nsfw-warning`/`.nsfw-blur`/`.revealed` (`NsfwBlurImage`, used by `GalleryCharacter` and `PastWorkGrid`), `a.enlarge-link` (`EnlargeableImage`, used everywhere images appear), and the `.permalink-copy-btn`/`.permalink-explore-link` classes used by the out-of-React-scope `/i/:id` permalink Function (`functions/i/[id].js` — not touched by this plan, but it shares this same stylesheet, so its two classes need updating here or the permalink page ends up half old-theme).

- [ ] **Step 1: Restyle `.back-link`**

Replace the `.back-link { ... }` rule (old lines 620–627) with:

```css
.back-link {
    display: inline-block;
    color: var(--accent-dark);
    text-decoration: none;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 0.9rem;
    margin-bottom: 15px;
}

.back-link:hover {
    text-decoration: underline;
}
```

- [ ] **Step 2: Restyle `.gallery-empty` and `.feed-error`**

Replace the `.gallery-empty { ... }` rule (old lines 426–433) and `.feed-error { ... }` rule (old lines 597–600) with:

```css
.gallery-empty {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--text-muted);
    font-family: 'Nunito', sans-serif;
    font-size: 0.95rem;
    padding: 15px 0;
}

.feed-error {
    color: var(--slime-tabby-dark);
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
}
```

- [ ] **Step 3: Restyle `.tier-card`/`.past-work-card`**

Replace the `.tier-card, .past-work-card { ... }`, `.past-work-card { transition... }`, `.past-work-card:hover { ... }`, `.tier-card::before, .past-work-card::before { ... }`, `.tier-card { margin-bottom }`, and `.tier-card img, .past-work-card img { ... }` rules (old lines 739–780) with:

```css
.tier-card, .past-work-card {
    background: var(--surface);
    border: var(--outline-w) solid var(--accent);
    border-radius: 20px;
    padding: 14px;
    box-shadow: var(--shadow-pop);
}

.tier-card {
    margin-bottom: 14px;
}

.past-work-card {
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.past-work-card:hover {
    transform: translateY(-4px) scale(1.03);
}

.tier-card img, .past-work-card img {
    width: 100%;
    border-radius: 12px;
    margin-bottom: 8px;
}
```

- [ ] **Step 4: Restyle `.char-image-wrap`/`.nsfw-warning`/`a.enlarge-link`**

Replace the `.char-image-wrap { ... }`, `.char-image-wrap:hover { ... }`, `.char-image-wrap img { ... }`, `.char-image-wrap.nsfw-blur img { ... }`, `.char-image-wrap.nsfw-blur.revealed img { ... }`, `.nsfw-warning { ... }`, and `.char-image-wrap.nsfw-blur.revealed .nsfw-warning { ... }` rules (old lines 647–692), and the `a.enlarge-link { ... }` rule (old line 939–941), with:

```css
.char-image-wrap {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    background: var(--accent-light);
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.char-image-wrap:hover {
    transform: translateY(-4px) scale(1.03);
}

.char-image-wrap img {
    width: 100%;
    height: auto;
    display: block;
}

.char-image-wrap.nsfw-blur img {
    filter: blur(20px);
    transition: filter 0.2s ease;
}

.char-image-wrap.nsfw-blur.revealed img {
    filter: none;
}

.nsfw-warning {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(58, 42, 36, 0.55);
    color: var(--surface);
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 0.85rem;
    text-align: center;
    cursor: pointer;
    padding: 10px;
}

.char-image-wrap.nsfw-blur.revealed .nsfw-warning {
    display: none;
}

a.enlarge-link {
    display: block;
}
```

- [ ] **Step 5: Restyle the permalink page's two classes**

Replace the `.permalink-copy-btn { ... }`, `.permalink-copy-btn:hover { ... }`, and `.permalink-explore-link { ... }` rules (old lines 914–937) with:

```css
.permalink-copy-btn {
    background: var(--accent);
    color: var(--surface);
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    padding: 10px 18px;
    border-radius: var(--radius-button);
    cursor: pointer;
    transition: background-color 0.1s ease;
}

.permalink-copy-btn:hover {
    background: var(--accent-dark);
}

.permalink-explore-link {
    display: inline-block;
    margin-top: 12px;
    margin-left: 12px;
    color: var(--accent-dark);
    text-decoration: none;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 0.9rem;
}
```

This does not touch `functions/i/[id].js` itself (its markup and classes stay exactly as they are — only what these class names resolve to changes), so it doesn't violate the "never modify `functions/`" constraint.

- [ ] **Step 6: Update the reduced-motion block**

Replace the `@media (prefers-reduced-motion: reduce) { .status-light { animation: none; } ::view-transition-group... }` block (old lines 435–445) with nothing — delete it. `.status-light`'s own reduced-motion handling moves into Task 8 alongside the rest of its rule (it's Landing/BlueskyFeed-specific), and the `::view-transition-*` selectors it referenced no longer exist after Task 1.

- [ ] **Step 7: Build and run the full suite**

```bash
npm run build && npm test
```

Expected: 179 tests pass, unchanged from Task 5 — this task only changes CSS values on selectors, no JSX/class-name/markup changes.

- [ ] **Step 8: Commit**

```bash
git add public/styles.css
git commit -m "feat: restyle shared cross-page components (back-link, cards, nsfw-blur, permalink page)"
```

---

## Task 7: Remove the starfield background and the `three` dependency

**Files:**
- Delete: `src/components/Background.jsx`
- Modify: `src/App.jsx`, `src/entry-server.jsx`, `package.json`

**Interfaces:**
- Removes: the `<Background />` export and every import of it.

- [ ] **Step 1: Confirm nothing else imports `Background.jsx` besides the two files this task edits**

```bash
grep -rln "Background" --include="*.jsx" src/ | grep -v node_modules
```

Expected: `src/App.jsx`, `src/entry-server.jsx`, and `src/components/Background.jsx` itself. If anything else appears, stop and investigate before deleting.

- [ ] **Step 2: Delete `src/components/Background.jsx`**

```bash
git rm src/components/Background.jsx
```

- [ ] **Step 3: Update `src/App.jsx`**

Current content:

```jsx
import { Routes, Route, useLocation } from 'react-router-dom';
import { routes } from './routes.js';
import Background from './components/Background.jsx';
import GalleryCharacterRoute from './pages/GalleryCharacterRoute.jsx';

export default function App() {
    const location = useLocation();
    return (
        <>
            {location.pathname !== '/admin/' && <Background />}
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

Replace it with:

```jsx
import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';
import GalleryCharacterRoute from './pages/GalleryCharacterRoute.jsx';

export default function App() {
    return (
        <Routes>
            {routes.map(({ path, Page }) => (
                <Route key={path} path={path} element={<Page />} />
            ))}
            <Route path="/gallery/:slug/" element={<GalleryCharacterRoute />} />
        </Routes>
    );
}
```

(`useLocation` is no longer needed now that there's nothing to conditionally hide per-route.)

- [ ] **Step 4: Update `src/entry-server.jsx`**

Current content:

```jsx
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App.jsx';
import Background from './components/Background.jsx';
import GalleryCharacter from './pages/GalleryCharacter.jsx';

export { routes } from './routes.js';

export function render(url) {
    const html = renderToString(
        <StaticRouter location={url}>
            <App />
        </StaticRouter>
    );
    return { html };
}

export function renderCharacter(character) {
    const html = renderToString(
        <>
            <Background />
            <GalleryCharacter character={character} />
        </>
    );
    return { html };
}
```

Replace it with:

```jsx
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App.jsx';
import GalleryCharacter from './pages/GalleryCharacter.jsx';

export { routes } from './routes.js';

export function render(url) {
    const html = renderToString(
        <StaticRouter location={url}>
            <App />
        </StaticRouter>
    );
    return { html };
}

export function renderCharacter(character) {
    const html = renderToString(<GalleryCharacter character={character} />);
    return { html };
}
```

Recall from the foundation migration (sub-project 1) that `GalleryCharacterRoute.jsx` (the client-side route matched by `App.jsx`) reads its character data from a `data-character` attribute on `#root`, and that server/client output must stay byte-identical for hydration to work. Removing `<Background />` from both the server (`renderCharacter`) and client (`App.jsx`, which `GalleryCharacterRoute` renders under) paths symmetrically preserves that — neither side renders a canvas anymore, so they still match.

- [ ] **Step 5: Remove `three` from `package.json`**

```bash
npm uninstall three
```

- [ ] **Step 6: Build and confirm the character-page hydration parity check still holds**

```bash
npm run build
node -e "
const server = await import('./dist-server/entry-server.js');
const data = JSON.parse(await (await import('node:fs/promises')).readFile('data/characters.json', 'utf8'));
const character = data.characters[0];
const serverHtml = server.renderCharacter(character).html;
const clientHtml = server.render('/gallery/' + character.slug + '/').html;
console.log('server renderCharacter length:', serverHtml.length);
console.log('client route render length:', clientHtml.length);
"
```

Expected: this only exercises the server-side `render(url)` path (matching `/gallery/:slug/` against `App`'s `<Routes>`), which still renders nothing for that route server-side (unchanged from before — `GalleryCharacterRoute` is client-only, reading from `#root`'s `data-character` attribute, exactly as sub-project 1 built it). The two lengths are expected to differ; this step's real purpose is confirming the build doesn't crash now that `Background`/`three` are gone, not asserting equality. Do a full manual sanity check instead: confirm `dist/client/gallery/<any-slug>/index.html` contains `data-character="..."` on `<div id="root">` and no `<canvas id="webgl-canvas">` anywhere in the build output:

```bash
grep -l "data-character" dist/client/gallery/*/index.html
grep -rl "webgl-canvas" dist/client/ || echo "no webgl-canvas references remain"
```

- [ ] **Step 7: Run the full test suite**

```bash
npm test
```

Expected: 179 tests pass. If any test references `Background.jsx` or asserts a `<canvas>` is present, it will fail here — read the failure, confirm it's asserting the now-removed starfield, and update that test to remove the assertion (there should be none, since sub-project 1's tests were all SSR-shell assertions on page-specific content, not the shared canvas, but verify rather than assume).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: remove starfield background and three.js dependency"
```

---

## Task 8: Landing page restyle

**Files:**
- Modify: `src/pages/Landing.jsx`, `public/styles.css`
- Test: `tests/landing-page.test.js`

**Interfaces:**
- Consumes: `Panel` (Task 2), `WaveText` (Task 3), `usePopClick` (Task 4), `page-pink` (Task 2).

- [ ] **Step 1: Rewrite `src/pages/Landing.jsx`**

Replace the whole file with:

```jsx
import BlueskyFeed from '../components/BlueskyFeed.jsx';
import CharacterGalleryStrip from '../components/CharacterGalleryStrip.jsx';
import CommissionsPreviewStrip from '../components/CommissionsPreviewStrip.jsx';
import Panel from '../components/Panel.jsx';
import WaveText from '../components/WaveText.jsx';
import { usePopClick } from '../hooks/usePopClick.js';

function LinkButton({ href, icon, children }) {
    const pop = usePopClick();
    return (
        <a href={href} className={`link-btn pop-clickable ${pop.className}`.trim()} onPointerUp={pop.onPointerUp}>
            <i className={icon} /> {children}
        </a>
    );
}

function CtaButton({ href, icon, children }) {
    const pop = usePopClick();
    return (
        <a href={href} className={`commissions-cta pop-clickable ${pop.className}`.trim()} onPointerUp={pop.onPointerUp}>
            <i className={icon} /> {children}
        </a>
    );
}

export default function Landing() {
    return (
        <div className="page-pink">
            <Panel>
                <div className="sys-header">
                    <div className="status-light" />
                    <span>KITTPAD_OS v1.MEOW</span>
                    <span><i className="fa-solid fa-battery-full" /></span>
                </div>

                <div className="profile">
                    <div className="avatar-frame">
                        <img src="https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401" alt="Profile" className="avatar" />
                    </div>
                    <WaveText as="h1" text="Sam" />
                    <p>Genius, billionaire, playboy, philanthropist, cat</p>
                </div>

                <div>
                    <div className="links-grid">
                        <LinkButton href="https://www.instagram.com/vyphir" icon="fa-brands fa-instagram">Instagram</LinkButton>
                        <LinkButton href="https://x.com/Vyphirr" icon="fa-brands fa-x-twitter">Twitter</LinkButton>
                        <LinkButton href="https://bsky.app/profile/samisaderp.bsky.social" icon="fa-brands fa-bluesky">Bluesky</LinkButton>
                        <LinkButton href="https://t.me/Samisaderp#" icon="fa-brands fa-telegram">Telegram</LinkButton>
                        <LinkButton href="https://toyhou.se/samisaderp/characters" icon="fa-solid fa-box-open">Toyhouse</LinkButton>
                        <LinkButton href="https://steamcommunity.com/profiles/76561199191219060/" icon="fa-brands fa-steam">Steam</LinkButton>
                    </div>
                </div>

                <div>
                    <WaveText as="h2" className="section-title" text="Character Archives" />
                    <CtaButton href="/gallery/" icon="fa-solid fa-image">View All Characters</CtaButton>
                    <CharacterGalleryStrip />
                </div>

                <div>
                    <WaveText as="h2" className="section-title" text="Commissions" />
                    <CtaButton href="/commissions/" icon="fa-solid fa-palette">View Commissions</CtaButton>
                    <CommissionsPreviewStrip />
                </div>

                <div>
                    <WaveText as="h2" className="section-title" text="Comms Feed" />
                    <h3 className="bsky-init-heading">Latest from Bluesky</h3>
                    <div className="feed-container" id="bsky-feed">
                        <BlueskyFeed handle="samisaderp.bsky.social" />
                    </div>
                </div>
            </Panel>
        </div>
    );
}
```

Two intentional content changes beyond the visual restyle, both because the old copy was explicitly terminal/sci-fi flavor text that has no place in the new theme: the `<i>` icon usage stays (Font Awesome icons are theme-neutral), but `"&gt; INITIALIZING BLUESKY LINK..."` becomes `"Latest from Bluesky"` — a plain, friendly heading matching the new tone. `WaveText` is applied to `<h1>Sam</h1>` and each `.section-title` heading, per the spec's letter-wave-hover requirement; buttons that need the click-pop are wrapped in small local `LinkButton`/`CtaButton` components rather than adding the hook's boilerplate inline six times.

- [ ] **Step 2: Restyle Landing's CSS**

Replace `.sys-header`, `.sys-header::after`, `.status-light`, `@keyframes blink`, `.profile`, `.avatar-frame`, `.avatar`, `.profile h1`, `.profile p`, `.links-grid`, `.link-btn`, `.link-btn::before`, `.link-btn:hover, .link-btn:active`, `.link-btn::before` hover, `.link-btn i`, `.link-btn:hover i, .link-btn:active i`, `.commissions-cta` and its `::before`/`:hover`/`i` variants, `.commissions-preview-grid`, `.commissions-preview-grid img`, `.commissions-preview-grid img:hover`, `.section-title`, `.section-title i`, `.gallery-container` and its scrollbar rules, `.gallery-card` and its `::before`/`:hover`/`img`/`p` variants, `a.gallery-card`, `.feed-container`, `.feed-container::before`, `.feed-entry`, `.feed-entry-header`, `.feed-handle`, `.feed-date`, `.feed-text`, `.bsky-init-heading`, and `.feed-loading-placeholder` (old lines 202–343, 345–424, 447–539, 540–618, minus the shared rules already moved in Task 6) with:

```css
.sys-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--accent-dark);
    padding-bottom: 12px;
    border-bottom: 2px dashed var(--accent-light);
}

.status-light {
    width: 10px;
    height: 10px;
    background-color: var(--slime-honey);
    border-radius: 50%;
    animation: blink 2s infinite;
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

@media (prefers-reduced-motion: reduce) {
    .status-light {
        animation: none;
    }
}

.profile {
    text-align: center;
}

.avatar-frame {
    display: inline-block;
    width: 110px;
    height: 110px;
    margin-bottom: 10px;
    border-radius: 50%;
    border: var(--outline-w) solid var(--accent);
    overflow: hidden;
}

.avatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.profile h1 {
    font-family: 'Fredoka', sans-serif;
    font-size: 1.8rem;
    color: var(--text-ink);
    margin-bottom: 5px;
}

.profile p {
    font-size: 0.95rem;
    line-height: 1.4;
    color: var(--text-muted);
}

.links-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.link-btn {
    background: var(--accent-light);
    border: var(--outline-w) solid var(--accent);
    color: var(--text-ink);
    text-decoration: none;
    padding: 12px;
    border-radius: var(--radius-button);
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    font-size: 0.9rem;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: var(--shadow-pop);
}

.link-btn:hover {
    background: var(--accent);
}

.link-btn i {
    font-size: 1.1rem;
    color: var(--accent-dark);
}

.commissions-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    border-radius: var(--radius-button);
    background: var(--accent);
    color: var(--surface);
    text-decoration: none;
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    font-size: 0.95rem;
    text-align: center;
    margin-bottom: 12px;
    box-shadow: var(--shadow-pop);
}

.commissions-cta:hover {
    background: var(--accent-dark);
}

.commissions-cta i {
    font-size: 1.1rem;
}

.commissions-preview-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}

.commissions-preview-grid img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 16px;
    border: 2px solid var(--accent);
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.commissions-preview-grid img:hover {
    transform: translateY(-4px) scale(1.04);
}

.section-title {
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--text-ink);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.section-title i {
    color: var(--accent-dark);
}

.gallery-container {
    display: flex;
    gap: 15px;
    overflow-x: auto;
    padding: 8px 2px 14px 2px;
    scroll-snap-type: x mandatory;
    scrollbar-width: thin;
    scrollbar-color: var(--accent) var(--accent-light);
}

.gallery-card {
    flex: 0 0 140px;
    scroll-snap-align: start;
    background: var(--accent-light);
    border: 2px solid var(--accent);
    border-radius: 20px;
    overflow: hidden;
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.gallery-card:hover {
    transform: translateY(-4px) scale(1.04);
}

.gallery-card img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
}

.gallery-card p {
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 0.8rem;
    text-align: center;
    padding: 8px 5px;
    color: var(--accent-dark);
}

a.gallery-card {
    text-decoration: none;
    display: block;
}

.feed-container {
    background: var(--accent-light);
    border: 2px solid var(--accent);
    border-radius: 20px;
    padding: 15px;
    min-height: 200px;
}

.feed-entry {
    border-bottom: 2px dashed var(--accent);
    padding-bottom: 15px;
    margin-bottom: 15px;
}

.feed-entry-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
}

.feed-handle {
    color: var(--accent-dark);
    font-weight: 700;
    font-family: 'Nunito', sans-serif;
    font-size: 0.85rem;
}

.feed-date {
    color: var(--text-muted);
    font-size: 0.8rem;
}

.feed-text {
    font-size: 0.9rem;
    line-height: 1.4;
}

.bsky-init-heading {
    font-family: 'Nunito', sans-serif;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--accent-dark);
    margin-bottom: 10px;
}

.feed-loading-placeholder {
    text-align: center;
    color: var(--text-muted);
}
```

- [ ] **Step 3: Update `tests/landing-page.test.js`**

Read the current file first (`tests/landing-page.test.js`) to see its exact existing assertions, then update every assertion that references a removed class or the old copy string. At minimum:
- Any assertion matching `class="datapad-wrapper"` or similar becomes an assertion on `class="page-pink"` wrapping the page, and `class="panel-wrapper "` / `class="panel"` for the Panel structure underneath.
- Any assertion matching `&gt; INITIALIZING BLUESKY LINK` becomes an assertion matching `Latest from Bluesky`.
- Add one new assertion confirming `WaveText` is actually used on the heading: `assert.match(html, /class="wave-text">.*<span class="wave-text-letter"/s)` (or similar, adjusted to the test's existing style) around the `<h1>` output.

- [ ] **Step 4: Build and test**

```bash
npm run build && npm test
```

Expected: 179 tests pass (same count as Task 7 — this task modifies existing tests, not add new ones). Read the actual `dist/client/index.html` output and confirm visually-relevant facts hold: `class="page-pink"` wraps the page, `class="panel"` replaces the old datapad screen, the Font Awesome icons still render (CSP/link tag unaffected by this task).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.jsx public/styles.css tests/landing-page.test.js
git commit -m "feat: restyle Landing page with Panel, WaveText, and click-pop buttons"
```

---

## Task 9: Gallery index + character detail page restyle

**Files:**
- Modify: `src/pages/Gallery.jsx`, `src/pages/GalleryCharacter.jsx`, `src/components/GalleryIndexGrid.jsx`, `public/styles.css`
- Test: `tests/gallery-index-page.test.js`, `tests/render-pages.test.js` (character-page assertions)

**Interfaces:**
- Consumes: `Panel`, `WaveText`, `page-teal`.

- [ ] **Step 1: Rewrite `src/pages/Gallery.jsx`**

Replace the whole file with:

```jsx
import GalleryIndexGrid from '../components/GalleryIndexGrid.jsx';
import Panel from '../components/Panel.jsx';
import WaveText from '../components/WaveText.jsx';

export default function Gallery() {
    return (
        <div className="page-teal">
            <Panel wide>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <WaveText as="h1" text="Character Gallery" />
                <div id="gallery-index"><GalleryIndexGrid /></div>
            </Panel>
        </div>
    );
}
```

(The `<i className="fa-solid fa-image" />` icon that used to sit inside the `<h1>` is dropped here because `WaveText` splits its `text` prop into character spans and can't wrap an icon element inside that split — the heading text alone carries the new visual weight. If this reads as a meaningful loss, note it in the task report; it isn't a functional regression since no test asserts on that icon specifically.)

- [ ] **Step 2: Rewrite `src/pages/GalleryCharacter.jsx`**

Replace the whole file with:

```jsx
import NsfwBlurImage from '../components/NsfwBlurImage.jsx';
import Panel from '../components/Panel.jsx';
import WaveText from '../components/WaveText.jsx';

export default function GalleryCharacter({ character }) {
    return (
        <div className="page-teal">
            <Panel>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <div className="profile">
                    <WaveText as="h1" text={character.name} />
                    <p className="char-species">{character.species}</p>
                </div>
                <p className="char-bio">{character.bio}</p>
                <div className="char-image-grid">
                    {(character.images || []).map((img, i) => (
                        <NsfwBlurImage key={i} src={img.url} alt="" nsfw={Boolean(img.nsfw)} />
                    ))}
                </div>
            </Panel>
        </div>
    );
}
```

This file is used both by the server (`entry-server.jsx`'s `renderCharacter`) and — after sub-project 1's hydration fix — by `GalleryCharacterRoute.jsx` on the client, so this single change covers both render paths.

- [ ] **Step 3: Update `src/components/GalleryIndexGrid.jsx`'s card markup**

The file's logic (`truncateBio`, `selectPreviewImages`, the fetch-on-mount effect) is unchanged — only the JSX inside `CharacterCard` changes. Read the current file, then replace the `CharacterCard` function's return statement:

```jsx
    return (
        <div className="gallery-index-card">
            <a className="gallery-index-card-main" href={`/gallery/${character.slug}/`}>
                {iconImage && <img className="gallery-index-icon" src={iconImage.url} alt={character.name} loading="lazy" />}
                <h3>{character.name}</h3>
                <p className="gallery-index-bio">{truncateBio(character.bio)}</p>
            </a>
            {previewImages.length > 0 && (
                <div className="gallery-index-art-row">
                    {previewImages.map((img, i) => (
                        <EnlargeableImage key={i} src={img.url} alt={character.name} className="gallery-index-thumb" />
                    ))}
                </div>
            )}
        </div>
    );
```

(Unchanged from before — confirming no markup edit is actually needed here, only the CSS in Step 4 changes how it looks. This step is a no-op verification, not a real edit; skip writing anything if the file already matches this exactly.)

- [ ] **Step 4: Restyle Gallery/character CSS**

Replace `.gallery-index-grid`, `.gallery-index-card`, `.gallery-index-card::before`, `.gallery-index-card:hover`, `.gallery-index-card-main`, `.gallery-index-icon`, `.gallery-index-card-main h3`, `.gallery-index-bio`, `.gallery-index-art-row`, `.gallery-index-thumb img` (old lines 943–1022), and `.char-species`, `.char-bio`, `.char-image-grid` (old lines 629–645) with:

```css
.gallery-index-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 18px;
}

.gallery-index-card {
    background: var(--accent-light);
    border: 2px solid var(--accent);
    border-radius: 20px;
    overflow: hidden;
    transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.gallery-index-card:hover {
    transform: translateY(-4px) scale(1.03);
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
    border-radius: 14px;
    margin-bottom: 10px;
    display: block;
}

.gallery-index-card-main h3 {
    color: var(--accent-dark);
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    font-size: 1.05rem;
    margin-bottom: 6px;
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
    border-radius: 10px;
}

.char-species {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin-top: 4px;
}

.char-bio {
    line-height: 1.5;
    margin: 15px 0;
    white-space: pre-wrap;
}

.char-image-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
```

- [ ] **Step 5: Update `tests/gallery-index-page.test.js`**

Read the current file, then update assertions for the new markup: `class="page-teal"` wraps the page, `class="panel-wrapper panel--wide"`/`class="panel"` replace the old `datapad-wrapper--wide`/`datapad-screen` assertions, and (since the `<h1>` icon was intentionally dropped in Step 1) drop or update any assertion that specifically expected `<i class="fa-solid fa-image">` inside the `<h1>`.

- [ ] **Step 6: Update the character-page assertions in `tests/render-pages.test.js`**

Read the current file and find the assertions checking generated character-page HTML (name/species/bio/images). Update any assertion referencing `datapad-wrapper`/`datapad-screen` to expect `page-teal`/`panel` instead. Do not touch the parts of this test unrelated to markup (the build-triggering logic, the manifest/route-loading logic).

- [ ] **Step 7: Build and test**

```bash
npm run build && npm test
```

Expected: 179 tests pass. Read `dist/client/gallery/index.html` and `dist/client/gallery/<a-real-slug>/index.html` to visually confirm `page-teal`/`panel` markup and new class names are present.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Gallery.jsx src/pages/GalleryCharacter.jsx public/styles.css tests/gallery-index-page.test.js tests/render-pages.test.js
git commit -m "feat: restyle Gallery index and character detail pages"
```

---

## Task 10: Commissions page restyle

**Files:**
- Modify: `src/pages/Commissions.jsx`, `public/styles.css`
- Test: `tests/commissions-page.test.js`

**Interfaces:**
- Consumes: `Panel`, `WaveText`, `usePopClick`, `page-honey`.

- [ ] **Step 1: Rewrite `src/pages/Commissions.jsx`**

Replace the whole file with:

```jsx
import { useEffect, useState } from 'react';
import CommissionTierList from '../components/CommissionTierList.jsx';
import PastWorkGrid from '../components/PastWorkGrid.jsx';
import Panel from '../components/Panel.jsx';
import WaveText from '../components/WaveText.jsx';
import { usePopClick } from '../hooks/usePopClick.js';

function NavButton({ href, icon, children }) {
    const pop = usePopClick();
    return (
        <a href={href} className={`link-btn pop-clickable ${pop.className}`.trim()} onPointerUp={pop.onPointerUp}>
            <i className={icon} /> {children}
        </a>
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
        <div className="page-honey">
            <Panel wide>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <WaveText as="h1" text="Commissions" />
                <div className="links-grid">
                    <NavButton href="/queue" icon="fa-solid fa-list-check">Queue</NavButton>
                    <NavButton href="/tos" icon="fa-solid fa-file-contract">Terms of Service</NavButton>
                </div>
                {error && <p className="feed-error">&gt; DATA UNAVAILABLE.</p>}
                {data && (
                    <>
                        <div className={`commission-status ${data.status ? 'open' : 'closed'}`}>
                            {data.status ? 'COMMISSIONS OPEN' : 'COMMISSIONS CLOSED'}
                        </div>
                        {data.specialOffer && <div className="commission-special-offer">{data.specialOffer}</div>}
                        <p>{data.intro || ''}</p>
                        <h2 className="section-title">Tiers</h2>
                        <CommissionTierList tiers={data.tiers || []} />
                        <h2 className="section-title">Past Work</h2>
                        <PastWorkGrid items={data.pastWork || []} />
                    </>
                )}
            </Panel>
        </div>
    );
}
```

- [ ] **Step 2: Restyle Commissions-specific CSS**

Replace `.commission-status`, `.commission-status.open`, `.commission-status.closed`, `.commission-special-offer`, `.commission-special-offer::before`, `.tier-price`, and `#commission-past-work` / `#commission-past-work .past-work-card p` (old lines 694–796, 782–791) with:

```css
.commission-status {
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    padding: 8px 20px;
    border-radius: var(--radius-button);
    display: inline-block;
    margin-bottom: 10px;
}

.commission-status.open {
    background: var(--slime-teal-light);
    color: var(--slime-teal-dark);
}

.commission-status.closed {
    background: var(--bg-cream);
    border: 2px solid var(--text-muted);
    color: var(--text-muted);
}

.commission-special-offer {
    background: var(--accent);
    color: var(--surface);
    border-radius: 16px;
    padding: 12px 16px;
    margin: 15px 0;
    font-weight: 700;
}

.tier-price {
    color: var(--accent-dark);
    font-weight: 700;
}

#commission-past-work {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
}

#commission-past-work .past-work-card p {
    font-size: 0.75rem;
    margin: 0;
}
```

- [ ] **Step 3: Update `tests/commissions-page.test.js`**

Read the current file, update assertions for `page-honey`/`panel`/`panel--wide` in place of the old `datapad-wrapper--wide`/`datapad-screen` assertions.

- [ ] **Step 4: Build and test**

```bash
npm run build && npm test
```

Expected: 179 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Commissions.jsx public/styles.css tests/commissions-page.test.js
git commit -m "feat: restyle Commissions page"
```

---

## Task 11: TOS page restyle

**Files:**
- Modify: `src/pages/Tos.jsx`, `public/styles.css`
- Test: `tests/tos-page.test.js`

**Interfaces:**
- Consumes: `Panel`, `WaveText`, `page-lavender`.

- [ ] **Step 1: Rewrite `src/pages/Tos.jsx`**

Replace the whole file with:

```jsx
import Panel from '../components/Panel.jsx';
import TosPointList from '../components/TosPointList.jsx';
import WaveText from '../components/WaveText.jsx';

export default function Tos() {
    return (
        <div className="page-lavender">
            <Panel wide>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <WaveText as="h1" text="Terms of Service" />
                <div id="tos-points"><TosPointList /></div>
            </Panel>
        </div>
    );
}
```

- [ ] **Step 2: Restyle TOS-specific CSS**

Replace `.tos-point`, `.tos-point h3`, `.tos-point-number`, `.tos-bullets`, `.tos-bullets li`, `.tos-bullet-plain::before`, `.tos-bullet-yesno i`, `.tos-bullet-yes i`, `.tos-bullet-no i` (old lines 798–840) with:

```css
.tos-point {
    margin-bottom: 14px;
}

.tos-point h3 {
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    font-size: 1.05rem;
    margin-bottom: 6px;
}

.tos-point-number {
    color: var(--accent-dark);
}

.tos-bullets {
    list-style: none;
    margin: 8px 0 0 0;
    padding: 0;
}

.tos-bullets li {
    padding: 4px 0;
}

.tos-bullet-plain::before {
    content: '\2022';
    color: var(--accent-dark);
    margin-right: 8px;
}

.tos-bullet-yesno i {
    width: 16px;
    text-align: center;
    margin-right: 8px;
}

.tos-bullet-yes i {
    color: var(--slime-teal-dark);
}

.tos-bullet-no i {
    color: var(--slime-tabby-dark);
}
```

- [ ] **Step 3: Update `tests/tos-page.test.js`**

Read the current file, update assertions for `page-lavender`/`panel`/`panel--wide` in place of the old `datapad-wrapper--wide`/`datapad-screen` assertions.

- [ ] **Step 4: Build and test**

```bash
npm run build && npm test
```

Expected: 179 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Tos.jsx public/styles.css tests/tos-page.test.js
git commit -m "feat: restyle TOS page"
```

---

## Task 12: Queue page restyle

**Files:**
- Modify: `src/pages/Queue.jsx`, `public/styles.css`
- Test: `tests/queue-page.test.js`

**Interfaces:**
- Consumes: `Panel`, `WaveText`, `page-tabby`.

- [ ] **Step 1: Rewrite `src/pages/Queue.jsx`**

Replace the whole file with:

```jsx
import Panel from '../components/Panel.jsx';
import QueueBoard from '../components/QueueBoard.jsx';
import WaveText from '../components/WaveText.jsx';

export default function Queue() {
    return (
        <div className="page-tabby">
            <Panel xwide>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <WaveText as="h1" text="Commission Queue" />
                <div id="queue-board"><QueueBoard /></div>
            </Panel>
        </div>
    );
}
```

- [ ] **Step 2: Restyle Queue-specific CSS**

Replace `.queue-board-columns`, its `@media (max-width: 720px)` block, `.queue-column h3`, `.queue-column-cards`, `.queue-card`, `.queue-card h4`, `.queue-card p`, `.queue-card-for`, `.queue-card-target`, `.queue-card-age` (old lines 842–912) with:

```css
.queue-board-columns {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
    padding: 8px 2px 14px 2px;
    align-items: start;
}

@media (max-width: 720px) {
    .queue-board-columns {
        display: flex;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scrollbar-width: thin;
        scrollbar-color: var(--accent) var(--accent-light);
    }

    .queue-column {
        flex: 0 0 220px;
        scroll-snap-align: start;
    }
}

.queue-column h3 {
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--accent-dark);
    margin-bottom: 10px;
}

.queue-column-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.queue-card {
    margin-bottom: 0;
}

.queue-card h4 {
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 4px;
}

.queue-card p {
    font-size: 0.8rem;
    margin: 2px 0 0 0;
}

.queue-card-for {
    color: var(--accent-dark);
}

.queue-card-target {
    color: var(--slime-teal-dark);
}

.queue-card-age {
    color: var(--text-muted);
}
```

- [ ] **Step 3: Update `tests/queue-page.test.js`**

Read the current file, update assertions for `page-tabby`/`panel`/`panel--xwide` in place of the old `datapad-wrapper--xwide`/`datapad-screen` assertions.

- [ ] **Step 4: Build and test**

```bash
npm run build && npm test
```

Expected: 179 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Queue.jsx public/styles.css tests/queue-page.test.js
git commit -m "feat: restyle Queue page"
```

---

## Task 13: Admin light-touch restyle

**Files:**
- Modify: `public/admin/admin.css`

**Interfaces:**
- None new — pure CSS/color/font swap, no JSX or layout changes to any of the 5 admin components or `Admin.jsx`.

Admin never used `.datapad-wrapper`/`.datapad-screen` (its own `body` rule handles layout directly), so no JSX changes are needed anywhere in `src/pages/Admin.jsx` or `src/components/admin/*.jsx` for this task — confirm this before starting:

```bash
grep -rl "datapad" src/pages/Admin.jsx src/components/admin/
```

Expected: no matches. If this finds something, stop — it means the codebase has diverged from what this plan assumes, and the task needs re-scoping before proceeding.

- [ ] **Step 1: Replace `public/admin/admin.css`'s color/font references**

Replace the entire file with:

```css
body {
    font-family: 'Nunito', sans-serif;
    background: var(--bg-cream, #FFF6E9);
    color: var(--text-ink, #3A2A24);
    max-width: 700px;
    margin: 0 auto;
    padding: 30px 15px;
}

h1, h2 {
    font-family: 'Fredoka', sans-serif;
    font-weight: 600;
    margin-bottom: 15px;
}

.admin-panel {
    background: var(--surface, #FFFFFF);
    border: 2px solid var(--slime-lavender, #B98CFF);
    border-radius: 20px;
    padding: 20px;
    margin-bottom: 25px;
}

.admin-panel label {
    display: block;
    margin-top: 12px;
    margin-bottom: 4px;
    font-size: 0.85rem;
    color: var(--text-muted, #8A7368);
}

.admin-panel input[type="text"],
.admin-panel textarea {
    width: 100%;
    padding: 8px;
    border-radius: 10px;
    background: var(--bg-cream, #FFF6E9);
    border: 1px solid var(--slime-lavender-light, #E7D8FF);
    color: inherit;
}

.admin-panel button {
    margin-top: 15px;
    padding: 10px 18px;
    border-radius: var(--radius-button, 999px);
    background: var(--slime-lavender, #B98CFF);
    color: var(--surface, #FFFFFF);
    font-weight: bold;
    cursor: pointer;
}

.admin-status {
    margin-top: 10px;
    font-size: 0.85rem;
}

.admin-status.error { color: var(--slime-tabby-dark, #E07A1F); }
.admin-status.success { color: var(--slime-lavender-dark, #8F5FE0); }

.image-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
}

.hidden {
    display: none;
}

.character-list-row,
.past-work-list-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--slime-lavender-light, #E7D8FF);
}

.character-list-thumb,
.past-work-list-thumb,
.existing-image-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 10px;
    background: var(--bg-cream, #FFF6E9);
}

.character-list-name,
.past-work-list-caption {
    flex: 1;
}

.admin-panel button.danger-button {
    background: var(--slime-tabby-dark, #E07A1F);
    color: var(--surface, #FFFFFF);
}

.admin-panel button:disabled {
    background: var(--slime-lavender-light, #E7D8FF);
    color: var(--text-muted, #8A7368);
    cursor: not-allowed;
}

.tier-row {
    background: var(--bg-cream, #FFF6E9);
    border: 1px solid var(--slime-lavender-light, #E7D8FF);
    border-radius: 12px;
    padding: 12px;
    margin-top: 10px;
}

.tier-row input[type="text"],
.tier-row textarea {
    margin-top: 6px;
}

.tos-point-row {
    background: var(--bg-cream, #FFF6E9);
    border: 1px solid var(--slime-lavender-light, #E7D8FF);
    border-radius: 12px;
    padding: 12px;
    margin-top: 10px;
}

.tos-point-row input[type="text"],
.tos-point-row textarea {
    margin-top: 6px;
}

.tos-point-row-header {
    display: flex;
    gap: 8px;
}

.tos-point-row-header button {
    margin-top: 0;
    padding: 6px 10px;
}

.tos-bullet-rows {
    margin-top: 8px;
}

.tos-bullet-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
}

.tos-bullet-row .tos-bullet-text {
    flex: 1;
}

.tos-bullet-row button {
    margin-top: 0;
    padding: 6px 10px;
}

.tos-bullet-yesno-value {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    white-space: nowrap;
}
```

The `var(--token, #hexFallback)` pattern is kept exactly as the original file used it (e.g. `var(--hot-pink, #ff69b4)`) — each fallback hex is updated to match the new token's actual value, so the page still renders correctly if `admin.css` is ever loaded standalone without `styles.css`'s `:root` block (matching the original file's own defensive design).

- [ ] **Step 2: Build and test**

```bash
npm run build && npm test
```

Expected: 179 tests pass — this task changes zero JSX/class names, only CSS values, so no admin test assertion is affected (they assert on structural markup like `id="char-name"`, not colors).

- [ ] **Step 3: Manually verify admin still functions**

```bash
npx wrangler pages dev dist/client
```

If wrangler is available in this environment, open `/admin/` and confirm every section (Characters, Commission Info, Past Work, TOS, Queue) still displays its fields/lists/buttons correctly with the new colors — this task must not change any layout or interactive behavior, only appearance. If wrangler isn't available, do a static read of `dist/client/admin/index.html` confirming the class names/ids are unchanged from before this task, and note in the report that full interactive verification needs a human with browser access (matching the pattern already established for admin verification in sub-project 1).

- [ ] **Step 4: Commit**

```bash
git add public/admin/admin.css
git commit -m "feat: apply Slime design system tokens to admin panel (light touch)"
```

---

## Task 14: Final sweep and verification

**Files:** None modified unless the sweep in Step 1 finds something.

**Interfaces:** None new — this task is entirely verification.

- [ ] **Step 1: Sweep for stray old-theme references**

```bash
grep -rn "datapad\|Space Mono\|Quicksand\|bg-dark\|hot-pink\|--pink:\|--red:\|bg-glass\|bg-element\|notch-lg\|notch-md\|notch-sm" public/ src/ scripts/ | grep -v node_modules
```

Expected: no matches. If anything appears, it's a component or CSS rule this plan's per-page tasks (8–13) or shared tasks (1, 6) missed — fix it in this task rather than leaving it, since Task 14 is the last checkpoint before this sub-project is considered done.

- [ ] **Step 2: Confirm `three` is fully gone**

```bash
grep -n "three" package.json
grep -rln "from 'three'" src/ scripts/
```

Expected: no matches in either command.

- [ ] **Step 3: Run the full test suite one final time**

```bash
npm test
```

Expected: all tests pass (179, or more if Step 1 required fixes that added assertions).

- [ ] **Step 4: Manual browser verification checklist**

Run `npx wrangler pages dev dist/client` (after `npm run build`) if available in this environment, or otherwise note this step needs a human with browser access. Check, on every route (`/`, `/gallery/`, at least 2 character pages, `/commissions/`, `/tos/`, `/queue/`, `/admin/`):

- The cream background and Fredoka/Nunito fonts are actually loading (not falling back to system fonts — check the Network tab or computed styles for the font-family).
- Each page's accent color matches the mapping table in Task 2 (pink/teal/teal/honey/lavender/tabby/muted-admin).
- Text contrast is legible everywhere — this is the single most likely place for a regression when flipping a dark theme to a light one, so check it explicitly rather than glancing.
- Hovering over `Sam`, `Character Archives`, `Commissions`, `Comms Feed`, `Character Gallery`, character names, `Commissions`, `Terms of Service`, and `Commission Queue` triggers the letter-wave animation.
- Clicking any `link-btn`/`commissions-cta` button triggers the pop animation.
- The decorative `Blob` component isn't actually used by any page yet in this plan (Tasks 8–13 don't place any `<Blob>` instances — the component and its CSS exist and are tested, but decorative placement was intentionally left out of scope for this pass to keep each page task focused on the token/shape/interaction migration itself). If this is unwanted, note it as a fast, low-risk follow-up: adding 1–2 `<Blob>` instances to Landing's hero area and Commissions' empty-state area, using the already-built component from Task 5.
- With OS-level "reduce motion" enabled, the wave/pop/drift animations are disabled or near-instant.

- [ ] **Step 5: Commit any fixes from Step 1, or note there were none**

If Step 1 required changes:

```bash
git add -A
git commit -m "fix: sweep remaining old-theme references (final Slime design system check)"
```

If Step 1 found nothing, no commit is needed for this task.

---

## Self-Review Notes

- **Spec coverage:** Tokens (Task 1), Panel/shape language (Task 2), WaveText (Task 3), click-pop (Task 4), Blob decoration (Task 5, though not yet placed on any page — flagged explicitly in Task 14 rather than silently left out), shared component restyle (Task 6), starfield/three.js removal (Task 7), all six pages + admin (Tasks 8–13), and final verification against the spec's rollout checklist (Task 14) are all covered.
- **`react-test-renderer` dependency:** this is the one addition to "no new dependencies" in this plan, scoped to Task 4 only, as a devDependency for testing a hook's timer behavior — flagged explicitly in that task rather than silently added.
- **Blob decoration placement:** intentionally deferred past this plan's per-page tasks (Tasks 8–13 focus on token/shape/interaction migration, not decorative polish) and called out as a known gap in Task 14 rather than silently dropped — a human can decide whether to fold it into this pass or treat it as a fast follow-up.
