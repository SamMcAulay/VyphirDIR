# React/Vite SSG Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate vyphir.com from static HTML/vanilla-JS pages to a Vite + React + React Router SSG pipeline, with zero visual change and zero functional regression, while preserving the git-backed CMS (`functions/api/*` → GitHub → Cloudflare Pages rebuild) and per-page baked OG meta tags.

**Architecture:** Vite builds a client entry (`src/entry-client.jsx`, hydrates in-browser) and a server entry (`src/entry-server.jsx`, built via `vite build --ssr`, runs under plain Node). A new `scripts/render-pages.js` imports the built server bundle, renders every route (static + one per character) to a string via `ReactDOMServer.renderToString` + React Router's `StaticRouter`, and writes `dist/client/<route>/index.html` with per-route `<title>`/OG meta baked in. `functions/`, `data/`, and `shared/` stay exactly where they are — Functions keep importing `shared/*.js` by relative path as today; `src/` components import the same files the same way. Cloudflare Pages serves `dist/client` as static output plus `functions/` as API routes, unchanged from today's split.

**Tech Stack:** React 18, React Router 6 (`StaticRouter`/`BrowserRouter`), Vite 5, `three` (npm, replacing the unpkg import map), existing `sharp`/`gifenc` (unchanged, still used for the commissions preview GIF).

**Spec:** [2026-09-04-react-vite-ssg-foundation-design.md](../specs/2026-09-04-react-vite-ssg-foundation-design.md)

## Global Constraints

- No visual change: `styles.css` and `admin/admin.css` ship byte-for-byte unchanged, as static passthrough assets — no CSS-in-JS, no Tailwind, no class renames.
- No new npm dependencies beyond `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`, and moving `three` from CDN-import-map to an npm dependency. `sharp`/`gifenc` stay as-is.
- `shared/*.js` (`format-date.js`, `slugify.js`, `escape-html.js`, `image-id.js`) stay at their current repo-root path and keep being imported by `functions/api/*.js` exactly as today — never duplicated into `src/`.
- `functions/`, `data/*.json` are never modified by this plan.
- `/admin/` access control is Cloudflare Access, external to this repo — no in-app auth code is added.
- Every existing `node --test` in `tests/` either keeps passing unmodified or is updated in the same task that obsoletes what it tested — never left broken between tasks.
- Every git-history-mutating admin action keeps its existing `window.confirm(...)` guard with the exact same message text (these are deliberate anti-footgun prompts, not incidental UI).

---

## File Structure

```
package.json                          # modify: deps + build/dev scripts
vite.config.js                        # create
index.html                            # create: Vite dev-server entry only
public/
  styles.css                          # moved from repo root, unchanged content
  admin/admin.css                     # moved from admin/admin.css, unchanged content
src/
  entry-client.jsx                    # create
  entry-server.jsx                    # create
  App.jsx                             # create: <Routes> shell
  routes.js                           # create: static route descriptors + meta
  pages/
    Landing.jsx
    Gallery.jsx
    GalleryCharacter.jsx
    Commissions.jsx
    Tos.jsx
    Queue.jsx
    Admin.jsx
  components/
    Background.jsx
    BlueskyFeed.jsx
    EnlargeableImage.jsx
    NsfwBlurImage.jsx
    CharacterGalleryStrip.jsx
    CommissionsPreviewStrip.jsx
    GalleryIndexGrid.jsx
    CommissionTierList.jsx
    PastWorkGrid.jsx
    TosPointList.jsx
    QueueBoard.jsx
    admin/
      AdminCharacters.jsx
      AdminCommissionsInfo.jsx
      AdminPastWork.jsx
      AdminTos.jsx
      AdminQueue.jsx
scripts/
  render-pages.js                     # create: SSG driver
  generate-commissions-preview-image.js  # renamed+trimmed from generate-commissions-preview.js (GIF only, no HTML)
tests/
  render-pages.test.js                # create
  generate-commissions-preview-image.test.js  # renamed+trimmed from generate-commissions-preview.test.js
  head-parity.test.js                 # modify: assert against SSG output instead of template files
  redirects-module-paths.test.js      # modify: new entry-module list
# deleted once superseded (see per-task notes):
#   router.js, shared/route-table.js, tests/route-table.test.js,
#   scripts/generate-characters.js, tests/generate-characters.test.js,
#   background.js, shared/enlargeable.js, nsfw-reveal.js,
#   script.js, admin/admin.js, admin/admin.css (old location),
#   index.html (old root page), gallery/index.html, gallery/gallery-index.js, gallery/character.js,
#   commissions/index.html, commissions/commissions.js, tos/index.html, tos/tos.js,
#   queue/index.html, queue/queue.js, admin/index.html,
#   templates/character.html, templates/commissions.html,
#   every generated gallery/<slug>/index.html (regenerated by render-pages.js instead)
```

`shared/*.js` is **not** listed as moved — it stays at the repo root and `src/` imports it by relative path (e.g. `../../shared/format-date.js`), exactly like `functions/api/publish-character.js` already does. This is the one piece of logic reused on both the server (Functions) and the new client/SSR code, so it can't move into `src/` without duplicating it.

---

## Task 1: Vite + React scaffolding, dev server, static routes render

**Files:**
- Create: `package.json` (modify), `vite.config.js`, `index.html`, `src/entry-client.jsx`, `src/entry-server.jsx`, `src/App.jsx`, `src/routes.js`, `src/pages/Landing.jsx` (placeholder content, replaced fully in Task 6)
- Test: `tests/render-pages.test.js` (first case only — smoke test)

**Interfaces:**
- Produces: `export const routes` from `src/routes.js` — array of `{ path: string, Page: React.ComponentType, title: string, description?: string, ogImage?: string, robotsNoIndex?: boolean }`.
- Produces: `export function render(url)` from `src/entry-server.jsx` — returns `{ html: string }` for a given pathname, used by `render-pages.js` (built by Task 2).
- Produces: `<App routes={routes} />` from `src/App.jsx` — renders `<Routes>{routes.map(...)}</Routes>` inside whatever Router wraps it (caller's responsibility, so the same `App` works under both `BrowserRouter` and `StaticRouter`).

- [ ] **Step 1: Install dependencies**

```bash
npm install react react-dom react-router-dom three
npm install --save-dev vite @vitejs/plugin-react
```

- [ ] **Step 2: Update `package.json` scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build:client": "vite build --outDir dist/client",
    "build:server": "vite build --ssr src/entry-server.jsx --outDir dist-server",
    "build": "npm run build:client && npm run build:server && node scripts/render-pages.js && node scripts/generate-commissions-preview-image.js",
    "test": "node --test"
  }
}
```

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
  },
});
```

- [ ] **Step 4: Create `index.html` (Vite dev entry only — production pages are generated by `render-pages.js`, not this file)**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vyphir (dev)</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <canvas id="webgl-canvas"></canvas>
    <div id="root"></div>
    <script type="module" src="/src/entry-client.jsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create `src/routes.js`**

```js
import Landing from './pages/Landing.jsx';

export const routes = [
    { path: '/', Page: Landing, title: "Sam's Directory", description: "Sam's Personal Social directory" },
];
```

(Task 6-11 append the remaining static routes here; Task 8 adds the data-driven `/gallery/:slug/` route separately since it needs per-character data, not a fixed descriptor.)

- [ ] **Step 6: Create `src/pages/Landing.jsx` (placeholder — full content in Task 6)**

```jsx
export default function Landing() {
    return <div className="datapad-screen"><h1>Sam</h1></div>;
}
```

- [ ] **Step 7: Create `src/App.jsx`**

```jsx
import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';

export default function App() {
    return (
        <Routes>
            {routes.map(({ path, Page }) => (
                <Route key={path} path={path} element={<Page />} />
            ))}
        </Routes>
    );
}
```

- [ ] **Step 8: Create `src/entry-client.jsx`**

```jsx
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

hydrateRoot(
    document.getElementById('root'),
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>
);
```

- [ ] **Step 9: Create `src/entry-server.jsx`**

```jsx
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App.jsx';

export function render(url) {
    const html = renderToString(
        <StaticRouter location={url}>
            <App />
        </StaticRouter>
    );
    return { html };
}
```

- [ ] **Step 10: Move CSS to `public/`**

```bash
mkdir -p public/admin
git mv styles.css public/styles.css
git mv admin/admin.css public/admin/admin.css
```

- [ ] **Step 11: Write the smoke test — `tests/render-pages.test.js` (first case)**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('build produces a static index.html that contains the hydrated root markup', () => {
    execSync('npm run build:client && npm run build:server', { cwd: projectRoot, stdio: 'inherit' });
    execSync('node scripts/render-pages.js', { cwd: projectRoot, stdio: 'inherit' });

    const outPath = join(projectRoot, 'dist/client/index.html');
    assert.ok(existsSync(outPath), 'dist/client/index.html should exist after build');
    const html = readFileSync(outPath, 'utf8');
    assert.match(html, /<div id="root">.*Sam.*<\/div>/s);
    assert.match(html, /<script type="module" src="\/assets\/entry-client[^"]*\.js">/);
});
```

This test intentionally runs the real build (Task 2 creates `render-pages.js` for it to invoke) — leave it failing after this task (no `render-pages.js` yet) and green it at the end of Task 2.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html public/ src/ tests/render-pages.test.js
git commit -m "feat: scaffold Vite/React/SSR entry points"
```

---

## Task 2: `render-pages.js` SSG driver + static route HTML shell

**Files:**
- Create: `scripts/render-pages.js`
- Modify: `tests/render-pages.test.js` (test written in Task 1 now passes)

**Interfaces:**
- Consumes: `render(url)` from `dist-server/entry-server.js` (the built output of `src/entry-server.jsx`), `routes` array shape from Task 1.
- Produces: `writeRoute({ outDir, route, html })` — internal helper, not exported, but its output contract (`dist/client/<path>/index.html`, meta tags matching `route.title`/`route.description`/`route.ogImage`) is what every later page task's SSG registration relies on.

- [ ] **Step 1: Write `scripts/render-pages.js`**

```js
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../shared/escape-html.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_OUT = join(projectRoot, 'dist', 'client');

const CSP = "default-src 'self'; style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' https: data:; connect-src 'self' https://public.api.bsky.app; object-src 'none'; base-uri 'self';";

async function loadManifest() {
    const raw = await readFile(join(CLIENT_OUT, '.vite', 'manifest.json'), 'utf8');
    return JSON.parse(raw);
}

function entryAssets(manifest) {
    const entry = manifest['src/entry-client.jsx'];
    const css = entry.css || [];
    return { script: `/${entry.file}`, css: css.map((href) => `/${href}`) };
}

function renderShell({ title, description, ogImage, ogImageType, robotsNoIndex, csp, extraStylesheets, appHtml, script, css }) {
    const ogTags = description
        ? `
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">${ogImage ? `
    <meta property="og:image" content="${escapeHtml(ogImage)}">${ogImageType ? `
    <meta property="og:image:type" content="${escapeHtml(ogImageType)}">` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ''}`
        : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">${robotsNoIndex ? '\n    <meta name="robots" content="noindex, nofollow">' : ''}${ogTags}
    <meta http-equiv="Content-Security-Policy" content="${csp || CSP}">
    <title>${escapeHtml(title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">
    <link rel="stylesheet" href="/styles.css">${css.map((href) => `\n    <link rel="stylesheet" href="${href}">`).join('')}${(extraStylesheets || []).map((href) => `\n    <link rel="stylesheet" href="${href}">`).join('')}
</head>
<body>
    <canvas id="webgl-canvas"></canvas>
    <div id="root">${appHtml}</div>
    <script type="module" src="${script}"></script>
</body>
</html>
`;
}

async function writeRoute({ route, html, script, css }) {
    const outDir = route.path === '/' ? CLIENT_OUT : join(CLIENT_OUT, route.path.replace(/^\//, ''));
    await mkdir(outDir, { recursive: true });
    const page = renderShell({ ...route, appHtml: html, script, css });
    await writeFile(join(outDir, 'index.html'), page);
}

async function main() {
    const manifest = await loadManifest();
    const { script, css } = entryAssets(manifest);
    const { render } = await import(join(projectRoot, 'dist-server', 'entry-server.js'));
    const { routes } = await import(join(projectRoot, 'dist-server', 'routes.js'));

    for (const route of routes) {
        const { html } = render(route.path);
        await writeRoute({ route, html, script, css });
    }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

export { renderShell, writeRoute };
```

`vite build --ssr src/entry-server.jsx` bundles whatever `entry-server.jsx` imports — including `routes.js` — into `dist-server/`, so `import(join(projectRoot, 'dist-server', 'routes.js'))` works because Task 1's `src/routes.js` is reachable from `src/entry-server.jsx`'s import graph via `App.jsx`. If Vite's SSR build doesn't emit `routes.js` as a separate chunk (it may inline it into `entry-server.js`), re-export `routes` directly from `entry-server.jsx` instead — adjust step 1 of Task 1's `entry-server.jsx` to also `export { routes } from './routes.js';` and change the import above to pull `routes` from the same `entry-server.js` module as `render`. Verify which happens by running the build once and checking `dist-server/`'s contents before finalizing this file.

- [ ] **Step 2: Run the smoke test from Task 1**

```bash
npm test -- --test-name-pattern="build produces a static index.html"
```

Expected: PASS. `dist/client/index.html` exists, contains the hydrated Landing placeholder, and references the hashed client script.

- [ ] **Step 3: Commit**

```bash
git add scripts/render-pages.js
git commit -m "feat: add SSG build script rendering routes to static HTML"
```

---

## Task 3: Background (starfield) component, delete old `background.js`/`router.js`/`route-table.js`

**Files:**
- Create: `src/components/Background.jsx`
- Modify: `src/App.jsx` (mount `<Background />` once, outside `<Routes>`)
- Delete: `background.js`, `router.js`, `shared/route-table.js`, `tests/route-table.test.js`

**Interfaces:**
- Produces: `<Background />` — a component with no props, safe to mount once at the app root; renders nothing itself (writes directly to `#webgl-canvas` via a `ref`-driven `useEffect`), matching today's behavior of `background.js` finding `#webgl-canvas` and running independently of page content.

- [ ] **Step 1: Create `src/components/Background.jsx`**

Port `background.js` verbatim into a `useEffect` that runs once on mount, using a `<canvas ref={canvasRef} id="webgl-canvas">` instead of `document.querySelector`. Keep every constant, star count, color, and animation loop identical — this is a direct translation, not a rewrite:

```jsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Background() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#2a1220');
        scene.fog = new THREE.FogExp2('#2a1220', 0.04);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0, 10);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const galaxyGroup = new THREE.Group();
        scene.add(galaxyGroup);

        const colorsArray = [new THREE.Color('#ff1f4b'), new THREE.Color('#ff4d4d'), new THREE.Color('#fff2d6')];
        const stars = [];
        const numStars = 130;
        const starGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const boundary = 12;

        for (let i = 0; i < numStars; i++) {
            const baseColor = colorsArray[Math.floor(Math.random() * colorsArray.length)];
            const star = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: baseColor }));
            star.position.set(
                (Math.random() - 0.5) * boundary * 2,
                (Math.random() - 0.5) * boundary * 2,
                (Math.random() - 0.5) * boundary * 2
            );
            star.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.008,
                    (Math.random() - 0.5) * 0.008,
                    (Math.random() - 0.5) * 0.008
                ),
                color: baseColor,
            };
            galaxyGroup.add(star);
            stars.push(star);
        }

        const maxConnections = (numStars * (numStars - 1)) / 2;
        const positions = new Float32Array(maxConnections * 6);
        const colors = new Float32Array(maxConnections * 6);
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
        const linesMesh = new THREE.LineSegments(
            lineGeo,
            new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.75 })
        );
        galaxyGroup.add(linesMesh);

        const maxDistance = 3.5;
        let scrollPercent = 0;
        const onScroll = () => {
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const maxScroll = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            scrollPercent = maxScroll > 0 ? scrollTop / maxScroll : 0;
        };
        document.addEventListener('scroll', onScroll);

        const clock = new THREE.Clock();
        let frameId;
        function animate() {
            frameId = requestAnimationFrame(animate);
            const time = clock.getElapsedTime();
            galaxyGroup.rotation.y = time * 0.02 + scrollPercent * 1.5;
            galaxyGroup.rotation.x = scrollPercent * 0.5;
            camera.position.z = 10 - scrollPercent * 4;

            let vertexPos = 0;
            let colorPos = 0;
            let numConnected = 0;
            for (let i = 0; i < numStars; i++) {
                const star = stars[i];
                star.position.add(star.userData.velocity);
                if (star.position.x < -boundary || star.position.x > boundary) star.userData.velocity.x *= -1;
                if (star.position.y < -boundary || star.position.y > boundary) star.userData.velocity.y *= -1;
                if (star.position.z < -boundary || star.position.z > boundary) star.userData.velocity.z *= -1;
                for (let j = i + 1; j < numStars; j++) {
                    const otherStar = stars[j];
                    const dist = star.position.distanceTo(otherStar.position);
                    if (dist < maxDistance) {
                        const alpha = 1.0 - dist / maxDistance;
                        positions[vertexPos++] = star.position.x;
                        positions[vertexPos++] = star.position.y;
                        positions[vertexPos++] = star.position.z;
                        positions[vertexPos++] = otherStar.position.x;
                        positions[vertexPos++] = otherStar.position.y;
                        positions[vertexPos++] = otherStar.position.z;
                        colors[colorPos++] = star.userData.color.r * alpha;
                        colors[colorPos++] = star.userData.color.g * alpha;
                        colors[colorPos++] = star.userData.color.b * alpha;
                        colors[colorPos++] = otherStar.userData.color.r * alpha;
                        colors[colorPos++] = otherStar.userData.color.g * alpha;
                        colors[colorPos++] = otherStar.userData.color.b * alpha;
                        numConnected++;
                    }
                }
            }
            lineGeo.setDrawRange(0, numConnected * 2);
            lineGeo.attributes.position.needsUpdate = true;
            lineGeo.attributes.color.needsUpdate = true;
            camera.position.y = Math.sin(time * 0.5) * 0.2;
            renderer.render(scene, camera);
        }
        animate();

        const onResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frameId);
            document.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
        };
    }, []);

    return <canvas ref={canvasRef} id="webgl-canvas" />;
}
```

- [ ] **Step 2: Mount it in `src/App.jsx`, remove the static `<canvas>` from `index.html` and `render-pages.js`'s shell**

```jsx
import { Routes, Route } from 'react-router-dom';
import { routes } from './routes.js';
import Background from './components/Background.jsx';

export default function App() {
    return (
        <>
            <Background />
            <Routes>
                {routes.map(({ path, Page }) => (
                    <Route key={path} path={path} element={<Page />} />
                ))}
            </Routes>
        </>
    );
}
```

Remove `<canvas id="webgl-canvas"></canvas>` from `index.html` (Task 1 step 4) and from `renderShell()` in `scripts/render-pages.js` (Task 2 step 1) — it's now rendered by `<Background />` itself as part of `appHtml`.

- [ ] **Step 3: Delete superseded files**

```bash
git rm background.js router.js shared/route-table.js tests/route-table.test.js
```

- [ ] **Step 4: Run full test suite, confirm the deleted-file tests are gone and nothing else references them**

```bash
npm test
grep -rn "route-table\|background\.js\|router\.js" --include="*.js" --include="*.html" . 2>/dev/null | grep -v node_modules | grep -v dist
```

Expected: `npm test` passes; the grep finds no remaining references (later tasks still need to delete the old `<script src="/router.js">` tags in the legacy HTML files, which happens as each page is migrated).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: port starfield background to React, remove superseded client router"
```

---

## Task 4: Shared image components — `EnlargeableImage`, `NsfwBlurImage`

**Files:**
- Create: `src/components/EnlargeableImage.jsx`, `src/components/NsfwBlurImage.jsx`
- Test: `tests/enlargeable-image.test.js`, `tests/nsfw-blur-image.test.js` — DOM-behavior tests using `react-dom/server` + `node:assert` regex checks on the rendered string (this project has no DOM-testing library installed; keep assertions to markup shape, consistent with how `tests/generate-characters.test.js` already asserts on rendered HTML strings)

**Interfaces:**
- Produces: `<EnlargeableImage src={string} alt={string} />` — renders the same `.char-image-wrap > a.enlarge-link > img` structure `shared/enlargeable.js` builds today, using `extractImageId` from `shared/image-id.js`. `href="/i/<id>"`, `target="_blank"`, `rel="noopener"`.
- Produces: `<NsfwBlurImage src={string} alt={string} nsfw={boolean} />` — wraps `<EnlargeableImage>` and, when `nsfw` is true, renders the `.nsfw-blur` class and a `.nsfw-warning` click-to-reveal overlay exactly like `nsfw-reveal.js` today, using local `useState` instead of a DOM class toggle.

- [ ] **Step 1: Write `src/components/EnlargeableImage.jsx`**

`wrap` defaults to `true` (the common case: this component owns its `.char-image-wrap`). `NsfwBlurImage` (step 2) passes `wrap={false}` because it needs to render that wrapper itself, with `.nsfw-blur`/`data-nsfw` on it and `.nsfw-warning` as a sibling inside it — matching `enlargeable.js` + `nsfw-reveal.js`'s original combined single-wrapper DOM exactly, rather than nesting two wrappers.

```jsx
import { extractImageId } from '../../shared/image-id.js';

export default function EnlargeableImage({ src, alt = '', className = '', wrap = true }) {
    const id = extractImageId(src);
    const img = <img src={src} alt={alt} loading="lazy" />;
    const link = id ? (
        <a className="enlarge-link" href={`/i/${id}`} target="_blank" rel="noopener" aria-label={alt ? `Enlarge ${alt}` : 'Enlarge image'}>
            {img}
        </a>
    ) : (
        img
    );

    if (!wrap) return link;
    return <div className={`char-image-wrap ${className}`.trim()}>{link}</div>;
}
```

- [ ] **Step 2: Write `src/components/NsfwBlurImage.jsx`**

```jsx
import { useState } from 'react';
import EnlargeableImage from './EnlargeableImage.jsx';

export default function NsfwBlurImage({ src, alt = '', nsfw = false }) {
    const [revealed, setRevealed] = useState(false);

    if (!nsfw) return <EnlargeableImage src={src} alt={alt} />;

    return (
        <div className={`char-image-wrap nsfw-blur ${revealed ? 'revealed' : ''}`.trim()} data-nsfw="true">
            <EnlargeableImage src={src} alt={alt} wrap={false} />
            {!revealed && (
                <div className="nsfw-warning" onClick={() => setRevealed(true)}>
                    NSFW (click to reveal)
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 3: Write `tests/nsfw-blur-image.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import NsfwBlurImage from '../src/components/NsfwBlurImage.jsx';

test('non-nsfw image renders without a wrapper or warning', () => {
    const html = renderToStaticMarkup(<NsfwBlurImage src="https://example.com/a.jpg" alt="Test" />);
    assert.doesNotMatch(html, /nsfw-blur/);
    assert.doesNotMatch(html, /nsfw-warning/);
});

test('nsfw image renders exactly one char-image-wrap with a reveal warning', () => {
    const html = renderToStaticMarkup(<NsfwBlurImage src="https://example.com/a.jpg" alt="Test" nsfw />);
    assert.match(html, /class="char-image-wrap nsfw-blur"/);
    assert.match(html, /data-nsfw="true"/);
    assert.match(html, /nsfw-warning/);
    assert.equal((html.match(/char-image-wrap/g) || []).length, 1, 'should not double-wrap');
});
```

This test file needs a `.test.jsx`-capable Node test run — Node's built-in `--test` runner doesn't transform JSX. Add a `--import` loader: create `tests/register-jsx.mjs` using `esbuild-register`-style on-the-fly transform, or simpler, add `esbuild` as a dev dependency and a `node --test --import ./tests/jsx-loader.mjs` wrapper. Resolve this loader mechanism as this step's first action (before writing the test) since every subsequent `.jsx`-importing test in this plan depends on it — once working here, no later task needs to touch it again.

```bash
npm install --save-dev esbuild
```

```js
// tests/jsx-loader.mjs
import { register } from 'node:module';
register('./jsx-esbuild-loader.mjs', import.meta.url);
```

```js
// tests/jsx-esbuild-loader.mjs
import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';

export async function load(url, context, nextLoad) {
    if (url.endsWith('.jsx')) {
        const rawSource = await readFile(new URL(url), 'utf8');
        const { code } = await transform(rawSource, { loader: 'jsx', format: 'esm' });
        return { format: 'module', source: code, shortCircuit: true };
    }
    return nextLoad(url, context);
}
```

```json
// package.json — update the test script
"test": "node --test --import ./tests/jsx-loader.mjs"
```

- [ ] **Step 4: Run the new tests**

```bash
npm test -- --test-name-pattern="nsfw"
```

Expected: PASS.

- [ ] **Step 5: Write `tests/enlargeable-image.test.js`** (mirrors step 3's pattern, asserting `href="/i/<id>"`, `target="_blank"` on a `.jpg`/`.png` URL, and a plain `<img>` with no wrapping `<a>` when the URL has no extractable id)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: port enlargeable-image and nsfw-blur behavior to React components; add JSX test loader"
```

---

## Task 5: `BlueskyFeed` component

**Files:**
- Create: `src/components/BlueskyFeed.jsx`
- Test: `tests/bluesky-feed.test.js`

**Interfaces:**
- Consumes: `formatDate` from `../../shared/format-date.js`.
- Produces: `<BlueskyFeed handle="samisaderp.bsky.social" />` — client-only fetch-on-mount component (same as today's `loadBlueskyFeed`), renders `.feed-entry` / `.feed-error` markup identical to `script.js`'s DOM output. On the server (SSR) it renders the initial `<p className="feed-loading-placeholder">Loading data packets...</p>` state only, matching today's server-baked placeholder in `index.html`.

- [ ] **Step 1: Write `src/components/BlueskyFeed.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { formatDate } from '../../shared/format-date.js';

export default function BlueskyFeed({ handle }) {
    const [state, setState] = useState({ status: 'loading', posts: [] });

    useEffect(() => {
        let cancelled = false;
        fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=3`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                const posts = (data.feed || [])
                    .map((item) => item.post?.record)
                    .filter(Boolean)
                    .map((post) => ({ text: post.text, date: formatDate(post.createdAt) }));
                setState({ status: 'ready', posts });
            })
            .catch((error) => {
                console.error(error);
                if (!cancelled) setState({ status: 'error', posts: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [handle]);

    if (state.status === 'loading') {
        return <p className="feed-loading-placeholder">Loading data packets...</p>;
    }
    if (state.status === 'error') {
        return <p className="feed-error">&gt; UPLINK FAILED.</p>;
    }
    return (
        <>
            {state.posts.map((post, i) => (
                <div className="feed-entry" key={i}>
                    <div className="feed-entry-header">
                        <span className="feed-handle">@{handle}</span>
                        <span className="feed-date">{post.date}</span>
                    </div>
                    <p className="feed-text">{post.text}</p>
                </div>
            ))}
        </>
    );
}
```

- [ ] **Step 2: Write `tests/bluesky-feed.test.js`** — SSR-only assertion (no real network call in tests): renders to the loading state and asserts the exact placeholder text/class match what `index.html` bakes today (`Loading data packets...`, class `feed-loading-placeholder`), which is what matters for SSR/hydration parity — the fetch behavior itself isn't unit-testable without a network mock, consistent with `script.js`'s `loadBlueskyFeed` never having had a unit test either.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import BlueskyFeed from '../src/components/BlueskyFeed.jsx';

test('renders the loading placeholder on first (server) render', () => {
    const html = renderToStaticMarkup(<BlueskyFeed handle="samisaderp.bsky.social" />);
    assert.match(html, /class="feed-loading-placeholder"/);
    assert.match(html, /Loading data packets\.\.\./);
});
```

- [ ] **Step 3: Run tests, confirm pass**

```bash
npm test -- --test-name-pattern="bluesky"
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: port Bluesky feed widget to React component"
```

---

## Task 6: Landing page

**Files:**
- Create: `src/components/CharacterGalleryStrip.jsx`, `src/components/CommissionsPreviewStrip.jsx`
- Modify: `src/pages/Landing.jsx` (replace Task 1's placeholder), `src/routes.js` (fill in full meta for `/`)
- Test: `tests/landing-page.test.js`

**Interfaces:**
- Consumes: `EnlargeableImage`/`NsfwBlurImage` (Task 4), `BlueskyFeed` (Task 5).
- Produces: `<Landing />` — full port of `index.html` + `script.js`'s `loadCharacterGallery`/`loadCommissionsPreview` logic, fetching `/data/characters.json` and `/data/commissions.json` client-side exactly as today (these stay runtime `fetch`, not SSG-baked data, since the auto-scrolling character strip is randomized per page load — `shuffleArray` — so baking it server-side would defeat the shuffle; server-render shows the empty containers, client fetch populates them, matching today's behavior where the containers are also empty in the initial static HTML).

- [ ] **Step 1: Write `src/components/CharacterGalleryStrip.jsx`** (ports `shuffleArray` + `loadCharacterGallery` + `setupAutoScroll` from `script.js:3-94`)

```jsx
import { useEffect, useRef, useState } from 'react';

function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export default function CharacterGalleryStrip() {
    const [characters, setCharacters] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        fetch('/data/characters.json')
            .then((r) => r.json())
            .then((d) => setCharacters(shuffleArray(d.characters || [])))
            .catch((error) => console.error(error));
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !characters || characters.length === 0) return;

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
        container.addEventListener('touchstart', stopScroll, { passive: true });
        container.addEventListener('touchend', startScroll, { passive: true });

        return () => {
            stopScroll();
            container.removeEventListener('mouseenter', stopScroll);
            container.removeEventListener('mouseleave', startScroll);
            container.removeEventListener('touchstart', stopScroll);
            container.removeEventListener('touchend', startScroll);
        };
    }, [characters]);

    if (characters === null) return <div className="gallery-container" id="character-gallery" ref={containerRef} />;
    if (characters.length === 0) return <div className="gallery-container" id="character-gallery" ref={containerRef}><p className="gallery-empty">&gt; NO CHARACTERS ARCHIVED YET</p></div>;

    return (
        <div className="gallery-container" id="character-gallery" ref={containerRef}>
            {characters.map((char) => {
                const images = char.images || [];
                const firstImage = images.find((img) => img.thumbnail && !img.nsfw) || images.find((img) => !img.nsfw);
                if (!firstImage) return null;
                return (
                    <a className="gallery-card" href={`/gallery/${char.slug}/`} key={char.slug}>
                        <img src={firstImage.url} alt={char.name} loading="lazy" />
                        <p>{char.name}</p>
                    </a>
                );
            })}
        </div>
    );
}
```

- [ ] **Step 2: Write `src/components/CommissionsPreviewStrip.jsx`** (ports `loadCommissionsPreview` from `script.js:96-125`)

```jsx
import { useEffect, useState } from 'react';

function shuffleArray(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export default function CommissionsPreviewStrip() {
    const [items, setItems] = useState(null);

    useEffect(() => {
        fetch('/data/commissions.json')
            .then((r) => r.json())
            .then((d) => {
                const candidates = (d.pastWork || []).slice(0, 9).filter((item) => !item.nsfw);
                setItems(shuffleArray(candidates).slice(0, 3));
            })
            .catch((error) => console.error(error));
    }, []);

    if (items === null) return <div className="commissions-preview-grid" id="commissions-preview" />;
    if (items.length === 0) return <div className="commissions-preview-grid" id="commissions-preview"><p className="gallery-empty">&gt; NO PAST WORK YET</p></div>;

    return (
        <div className="commissions-preview-grid" id="commissions-preview">
            {items.map((item, i) => (
                <img src={item.url} alt={item.caption || ''} loading="lazy" key={i} />
            ))}
        </div>
    );
}
```

- [ ] **Step 3: Write `src/pages/Landing.jsx`** (ports the `.datapad-screen` body of `index.html:25-73`)

```jsx
import BlueskyFeed from '../components/BlueskyFeed.jsx';
import CharacterGalleryStrip from '../components/CharacterGalleryStrip.jsx';
import CommissionsPreviewStrip from '../components/CommissionsPreviewStrip.jsx';

export default function Landing() {
    return (
        <div className="datapad-wrapper">
            <div className="datapad-screen">
                <div className="sys-header">
                    <div className="status-light" />
                    <span>KITTPAD_OS v1.MEOW</span>
                    <span><i className="fa-solid fa-battery-full" /></span>
                </div>

                <div className="profile">
                    <div className="avatar-frame">
                        <img src="https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401" alt="Profile" className="avatar" />
                    </div>
                    <h1>Sam</h1>
                    <p>Genius, billionaire, playboy, philanthropist, cat</p>
                </div>

                <div>
                    <div className="links-grid">
                        <a href="https://www.instagram.com/vyphir" className="link-btn"><i className="fa-brands fa-instagram" /> Instagram</a>
                        <a href="https://x.com/Vyphirr" className="link-btn"><i className="fa-brands fa-x-twitter" /> Twitter</a>
                        <a href="https://bsky.app/profile/samisaderp.bsky.social" className="link-btn"><i className="fa-brands fa-bluesky" /> Bluesky</a>
                        <a href="https://t.me/Samisaderp#" className="link-btn"><i className="fa-brands fa-telegram" /> Telegram</a>
                        <a href="https://toyhou.se/samisaderp/characters" className="link-btn"><i className="fa-solid fa-box-open" /> Toyhouse</a>
                        <a href="https://steamcommunity.com/profiles/76561199191219060/" className="link-btn"><i className="fa-brands fa-steam" /> Steam</a>
                    </div>
                </div>

                <div>
                    <h2 className="section-title"><i className="fa-solid fa-image" /> Character Archives</h2>
                    <a href="/gallery/" className="commissions-cta"><i className="fa-solid fa-image" /> View All Characters</a>
                    <CharacterGalleryStrip />
                </div>

                <div>
                    <h2 className="section-title"><i className="fa-solid fa-palette" /> Commissions</h2>
                    <a href="/commissions/" className="commissions-cta"><i className="fa-solid fa-palette" /> View Commissions</a>
                    <CommissionsPreviewStrip />
                </div>

                <div>
                    <h2 className="section-title"><i className="fa-solid fa-satellite-dish" /> Comms Feed</h2>
                    <h3 className="bsky-init-heading">&gt; INITIALIZING BLUESKY LINK...</h3>
                    <div className="feed-container" id="bsky-feed">
                        <BlueskyFeed handle="samisaderp.bsky.social" />
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Update `src/routes.js`**

```js
import Landing from './pages/Landing.jsx';

export const routes = [
    {
        path: '/',
        Page: Landing,
        title: "Sam's Directory",
        description: "Sam's Personal Social directory",
        ogImage: 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401',
    },
];
```

- [ ] **Step 5: Write `tests/landing-page.test.js`** — SSR assertion that the rendered markup contains every static link (`instagram`, `x.com/Vyphirr`, `bsky.app/profile/samisaderp.bsky.social`, `t.me/Samisaderp`, `toyhou.se/samisaderp`, `steamcommunity.com/profiles/76561199191219060`) and the section headings, mirroring what `head-parity`-style tests already check for elsewhere in this repo.

- [ ] **Step 6: Run full build + tests, visually diff against production**

```bash
npm run build
npm test
```

Then run `npx serve dist/client` (or equivalent) and manually compare `http://localhost:.../` against `https://vyphir.com/` side-by-side — this is the first full-page parity check in the migration, worth doing carefully since every later page reuses this pattern.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate landing page to React"
```

---

## Task 7: Gallery index page

**Files:**
- Create: `src/components/GalleryIndexGrid.jsx`, `src/pages/Gallery.jsx`
- Modify: `src/routes.js`
- Delete: `gallery/index.html`, `gallery/gallery-index.js`
- Test: `tests/gallery-index-page.test.js`

**Interfaces:**
- Produces: `<Gallery />` at `/gallery/`, `datapad-wrapper--wide` variant (per `gallery/index.html:19`).

- [ ] **Step 1: Write `src/components/GalleryIndexGrid.jsx`** (ports `gallery/gallery-index.js` in full — `truncateBio`, `selectPreviewImages`, `renderCharacterCard`, `loadGalleryIndex`)

```jsx
import { useEffect, useState } from 'react';
import EnlargeableImage from './EnlargeableImage.jsx';

function truncateBio(bio, maxLength = 120) {
    const firstLine = (bio || '').split('\n')[0].trim();
    if (firstLine.length <= maxLength) return firstLine;
    return `${firstLine.slice(0, maxLength - 1).trimEnd()}…`;
}

function selectPreviewImages(images, iconUrl, maxCount = 3) {
    return (images || []).filter((img) => !img.nsfw && img.url !== iconUrl).slice(0, maxCount);
}

function CharacterCard({ character }) {
    const images = character.images || [];
    const iconImage = images.find((img) => img.thumbnail && !img.nsfw) || images.find((img) => !img.nsfw);
    const previewImages = selectPreviewImages(images, iconImage && iconImage.url);

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
    if (characters === 'error') return <p className="feed-error">&gt; DATA UNAVAILABLE.</p>;
    if (characters.length === 0) return <p className="gallery-empty">&gt; NO CHARACTERS ARCHIVED YET</p>;

    return (
        <div className="gallery-index-grid">
            {characters.map((char) => <CharacterCard character={char} key={char.slug} />)}
        </div>
    );
}
```

- [ ] **Step 2: Write `src/pages/Gallery.jsx`**

```jsx
import GalleryIndexGrid from '../components/GalleryIndexGrid.jsx';

export default function Gallery() {
    return (
        <div className="datapad-wrapper datapad-wrapper--wide">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <h1><i className="fa-solid fa-image" /> Character Gallery</h1>
                <div id="gallery-index"><GalleryIndexGrid /></div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Add to `src/routes.js`**

```js
import Gallery from './pages/Gallery.jsx';
// ...
{ path: '/gallery/', Page: Gallery, title: 'Gallery | Vyphir' },
```

- [ ] **Step 4: Delete superseded files**

```bash
git rm gallery/index.html gallery/gallery-index.js
```

- [ ] **Step 5: Write `tests/gallery-index-page.test.js`** (SSR assertion: renders `<h1>` with "Character Gallery", `datapad-wrapper--wide` class present, back-link to `/`)

- [ ] **Step 6: Build, test, manual parity check against `/gallery/`**

```bash
npm run build && npm test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate gallery index page to React"
```

---

## Task 8: Character detail page (data-driven route) — replaces `generate-characters.js`

**Files:**
- Create: `src/pages/GalleryCharacter.jsx`
- Modify: `scripts/render-pages.js` (add a per-character render loop, reading `data/characters.json` directly — not through the React Router `routes` array, since this is data-driven, not a fixed path)
- Delete: `scripts/generate-characters.js`, `tests/generate-characters.test.js`, `templates/character.html`, every existing `gallery/<slug>/index.html` (regenerated by the new build)
- Test: `tests/render-pages.test.js` (add character-route cases), replacing what `generate-characters.test.js` covered

**Interfaces:**
- Produces: `<GalleryCharacter character={CharacterShape} />` where `CharacterShape = { slug, name, species, bio, images: [{url, nsfw, thumbnail?}] }` — this is the one page component that takes props instead of fetching its own data, because SSG needs the character's data available at render time (there's no `/gallery/:slug/` route param to resolve client-side the way `react-router` normally would, since routing here is purely path-based static generation, matching today's pre-generated-per-character-page approach).

- [ ] **Step 1: Write `src/pages/GalleryCharacter.jsx`** (ports `templates/character.html:18-30` + the NSFW-flagging behavior from `generate-characters.js`'s `renderImages`)

```jsx
import NsfwBlurImage from '../components/NsfwBlurImage.jsx';

export default function GalleryCharacter({ character }) {
    return (
        <div className="datapad-wrapper">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <div className="profile">
                    <h1>{character.name}</h1>
                    <p className="char-species">{character.species}</p>
                </div>
                <p className="char-bio">{character.bio}</p>
                <div className="char-image-grid">
                    {(character.images || []).map((img, i) => (
                        <NsfwBlurImage key={i} src={img.url} alt="" nsfw={Boolean(img.nsfw)} />
                    ))}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Add a character-rendering export to `src/entry-server.jsx`**

```jsx
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App.jsx';
import Background from './components/Background.jsx';
import GalleryCharacter from './pages/GalleryCharacter.jsx';

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

`<GalleryCharacter>` is rendered standalone here (not wrapped in `<App>`/`<StaticRouter>`) because it takes its data as a prop rather than reading route params — it doesn't need routing context, but it still needs `<Background />` alongside it for visual parity with every other page, exactly as `<App>` provides for the router-based routes.

- [ ] **Step 3: Extend `scripts/render-pages.js`'s `main()` with a character loop**

```js
import { readFile } from 'node:fs/promises';
// ...(existing imports)

async function renderCharacters({ script, css }) {
    const raw = await readFile(join(projectRoot, 'data', 'characters.json'), 'utf8');
    const { characters } = JSON.parse(raw);
    const { renderCharacter } = await import(join(projectRoot, 'dist-server', 'entry-server.js'));

    for (const character of characters) {
        const { html } = renderCharacter(character);
        const route = {
            path: `/gallery/${character.slug}/`,
            title: `${character.name} | Vyphir`,
        };
        await writeRoute({ route, html, script, css });
    }
}
```

Call `await renderCharacters({ script, css })` inside `main()`, after the static-routes loop.

- [ ] **Step 4: Delete superseded files**

```bash
git rm scripts/generate-characters.js tests/generate-characters.test.js templates/character.html
find gallery -mindepth 2 -name index.html -not -path "gallery/index.html" -delete
```

(The `find` targets only pre-generated per-character `index.html` files, e.g. `gallery/drasil/index.html` — `gallery/index.html` itself was already removed in Task 7.)

- [ ] **Step 5: Add character-route cases to `tests/render-pages.test.js`**

```js
test('build renders a static page per character with escaped bio/species/name', async () => {
    const html = readFileSync(join(projectRoot, 'dist/client/gallery/vyphir/index.html'), 'utf8');
    assert.match(html, /<h1>Vyphir<\/h1>/);
    assert.match(html, /Mainecoon Cat/);
});

test('nsfw character images are marked in the SSG output', async () => {
    // pick a real nsfw:true entry from data/characters.json, or add a temp fixture entry
    // and assert the rendered page contains data-nsfw="true" for it
});
```

(Base the second test on an actual `nsfw: true` entry found in `data/characters.json` — grep it first; if none exists, add a throwaway fixture character to a copied `data/characters.json` under a temp dir the same way `generate-characters.test.js` did, rather than mutating the real data file.)

- [ ] **Step 6: Build, test, manual parity check on 2-3 real character pages (including at least one with an NSFW image, to verify the blur/reveal still works client-side after hydration)**

```bash
npm run build && npm test
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate character detail pages to React SSG, replacing generate-characters.js"
```

---

## Task 9: Commissions page (public) + GIF preview integration

**Files:**
- Create: `src/components/CommissionTierList.jsx`, `src/components/PastWorkGrid.jsx`, `src/pages/Commissions.jsx`, `scripts/generate-commissions-preview-image.js` (trimmed from `scripts/generate-commissions-preview.js` — GIF only, no HTML templating)
- Modify: `scripts/render-pages.js` (call the GIF generator before computing the `/commissions/` route's meta)
- Delete: `commissions/index.html`, `commissions/commissions.js`, `templates/commissions.html`, `scripts/generate-commissions-preview.js`, `tests/generate-commissions-preview.test.js`
- Test: `tests/generate-commissions-preview-image.test.js` (renamed/trimmed), `tests/commissions-page.test.js`

**Interfaces:**
- Consumes: `NsfwBlurImage` (Task 4).
- Produces: `generateCommissionsPreviewImage({ dataPath, outDir, fetchImage })` from `scripts/generate-commissions-preview-image.js` — same `selectPreviewPieces`/`renderFrame`/`encodeGif` logic as today, but returns `{ pieceCount, ogImage }` and writes only `preview.gif` into `outDir` — no `index.html` templating (that responsibility moves entirely to `render-pages.js`).

- [ ] **Step 1: Write `scripts/generate-commissions-preview-image.js`** (trim `scripts/generate-commissions-preview.js:1-70` down to the GIF-only path)

```js
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { GIFEncoder, quantize, applyPalette } from 'gifenc/dist/gifenc.esm.js';

const MAX_IMAGES = 9;
const FRAME_SIZE = 720;
const FRAME_DELAY_MS = 1750;
const PAD_COLOR = '#120a0d';
const FALLBACK_IMAGE = 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401';

export function selectPreviewPieces(pastWork) {
    return (pastWork || []).filter((item) => !item.nsfw).slice(0, MAX_IMAGES);
}

export async function renderFrame(imageBuffer) {
    const { data } = await sharp(imageBuffer)
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: PAD_COLOR })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    return data;
}

export function encodeGif(frameBuffers, { delay = FRAME_DELAY_MS } = {}) {
    const gif = GIFEncoder();
    for (const rgba of frameBuffers) {
        const palette = quantize(rgba, 256);
        const index = applyPalette(rgba, palette);
        gif.writeFrame(index, FRAME_SIZE, FRAME_SIZE, { palette, delay, repeat: 0 });
    }
    gif.finish();
    return Buffer.from(gif.bytes());
}

export async function generateCommissionsPreviewImage({ dataPath, outDir, fetchImage = fetch }) {
    const dataRaw = await readFile(dataPath, 'utf8');
    const data = JSON.parse(dataRaw);
    const pieces = selectPreviewPieces(data.pastWork);

    if (pieces.length === 0) {
        return { pieceCount: 0, ogImage: FALLBACK_IMAGE };
    }

    const frames = [];
    for (const piece of pieces) {
        const response = await fetchImage(piece.url);
        if (!response.ok) throw new Error(`Failed to fetch preview image: ${piece.url}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        frames.push(await renderFrame(buffer));
    }
    const gifBytes = encodeGif(frames);
    const hash = createHash('sha1').update(gifBytes).digest('hex').slice(0, 10);
    await writeFile(join(outDir, 'preview.gif'), gifBytes);

    return { pieceCount: pieces.length, ogImage: `https://vyphir.com/commissions/preview.gif?v=${hash}` };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    generateCommissionsPreviewImage({
        dataPath: join(projectRoot, 'data', 'commissions.json'),
        outDir: join(projectRoot, 'dist', 'client', 'commissions'),
    }).then(({ pieceCount, ogImage }) => {
        console.log(`Generated commissions preview (${pieceCount} piece(s)): ${ogImage}`);
    });
}
```

Note the `outDir` default changes from the repo-root `commissions/` to `dist/client/commissions/` — the GIF is now a build output artifact, not a committed file, matching how every other generated page now lands in `dist/client/`.

- [ ] **Step 2: Write `src/components/CommissionTierList.jsx` and `src/components/PastWorkGrid.jsx`** (ports `commissions/commissions.js`'s `renderTier`/`renderPastWork`)

```jsx
// CommissionTierList.jsx
export default function CommissionTierList({ tiers }) {
    return (
        <>
            {tiers.map((tier, i) => (
                <div className="tier-card" key={i}>
                    {tier.example && <img src={tier.example} alt={tier.name} />}
                    <h3>{tier.name}<span className="tier-price">{tier.price ? ` — ${tier.price}` : ''}</span></h3>
                    <p>{tier.description || ''}</p>
                </div>
            ))}
        </>
    );
}
```

```jsx
// PastWorkGrid.jsx
import NsfwBlurImage from './NsfwBlurImage.jsx';

export default function PastWorkGrid({ items }) {
    return (
        <>
            {items.map((item, i) => (
                <div className="past-work-card" key={i}>
                    <NsfwBlurImage src={item.url} nsfw={Boolean(item.nsfw)} alt={item.caption || (item.giftArt ? 'Past gift art' : 'Past commission work')} />
                    {item.caption && <p>{item.caption}</p>}
                </div>
            ))}
        </>
    );
}
```

- [ ] **Step 3: Write `src/pages/Commissions.jsx`** (ports `templates/commissions.html:26-42` + `commissions/commissions.js`'s `loadCommissions` data-fetch)

```jsx
import { useEffect, useState } from 'react';
import CommissionTierList from '../components/CommissionTierList.jsx';
import PastWorkGrid from '../components/PastWorkGrid.jsx';

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
        <div className="datapad-wrapper datapad-wrapper--wide">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <h1><i className="fa-solid fa-palette" /> Commissions</h1>
                <div className="links-grid">
                    <a href="/queue" className="link-btn"><i className="fa-solid fa-list-check" /> Queue</a>
                    <a href="/tos" className="link-btn"><i className="fa-solid fa-file-contract" /> Terms of Service</a>
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
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Add the route in `src/routes.js`, computing `ogImage`/`description` at build time in `render-pages.js` instead of as a fixed descriptor** (the commissions route's OG image depends on the freshly-generated GIF hash, unlike every other static route)

```js
// src/routes.js — Commissions gets no ogImage/description here; render-pages.js overrides them per-build
import Commissions from './pages/Commissions.jsx';
// ...
{ path: '/commissions/', Page: Commissions, title: 'Commissions | Vyphir' },
```

- [ ] **Step 5: Update `scripts/render-pages.js`'s `main()` to generate the GIF first and patch the commissions route's meta**

```js
import { generateCommissionsPreviewImage } from './generate-commissions-preview-image.js';

async function main() {
    const manifest = await loadManifest();
    const { script, css } = entryAssets(manifest);
    const { render } = await import(join(projectRoot, 'dist-server', 'entry-server.js'));
    const { routes } = await import(join(projectRoot, 'dist-server', 'routes.js'));

    const { ogImage } = await generateCommissionsPreviewImage({
        dataPath: join(projectRoot, 'data', 'commissions.json'),
        outDir: join(CLIENT_OUT, 'commissions'),
    });

    for (const route of routes) {
        const isCommissions = route.path === '/commissions/';
        const resolvedRoute = isCommissions
            ? { ...route, description: 'Examples! See full catalogue on the site!', ogImage, ogImageType: 'image/gif' }
            : route;
        const { html } = render(route.path);
        await writeRoute({ route: resolvedRoute, html, script, css });
    }

    await renderCharacters({ script, css });
}
```

`renderShell` (Task 2) already accepts `ogImageType` and emits `<meta property="og:image:type" content="...">` conditionally next to `og:image` when it's present — this matches `templates/commissions.html:11`, and no further changes to `renderShell` are needed for this task.

The GIF must be generated **before** the route loop runs (not after, as `npm run build`'s script chain implied in Task 1) — `mkdir(CLIENT_OUT/commissions)` needs to happen before `writeRoute` for `/commissions/` tries to write into the same directory. Since `generateCommissionsPreviewImage` doesn't create its own `outDir`, add `await mkdir(join(CLIENT_OUT, 'commissions'), { recursive: true })` immediately before calling it.

- [ ] **Step 6: Simplify `package.json`'s `build` script** — the GIF generation is now internal to `render-pages.js`, so drop the separate invocation from Task 1's script:

```json
"build": "npm run build:client && npm run build:server && node scripts/render-pages.js"
```

- [ ] **Step 7: Delete superseded files, rename the old test**

```bash
git rm commissions/index.html commissions/commissions.js templates/commissions.html scripts/generate-commissions-preview.js
git mv tests/generate-commissions-preview.test.js tests/generate-commissions-preview-image.test.js
```

Update the renamed test file's imports (`generateCommissionsPreview` → `generateCommissionsPreviewImage`, dropping `templatePath`/HTML-output assertions, keeping the GIF-encoding assertions — `selectPreviewPieces`, `renderFrame`, `encodeGif` tests carry over unchanged since that logic didn't change).

- [ ] **Step 8: Write `tests/commissions-page.test.js`** (SSR assertion on `<Commissions />`'s static shell: back-link, Queue/TOS nav links, section headings present)

- [ ] **Step 9: Build, test, and manually verify the OG image/GIF still generates and the commissions page's Discord/Twitter unfurl preview is unchanged** — this is the highest-risk verification point in the whole plan per the spec's stated incident history; don't skip the manual unfurl check here even though it'll be repeated in the final task's full checklist.

```bash
npm run build && npm test
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: migrate commissions page to React, split GIF generation from HTML rendering"
```

---

## Task 10: TOS page

**Files:**
- Create: `src/components/TosPointList.jsx`, `src/pages/Tos.jsx`
- Modify: `src/routes.js`
- Delete: `tos/index.html`, `tos/tos.js`
- Test: `tests/tos-page.test.js`

**Interfaces:**
- Produces: `<Tos />` at `/tos/`.

- [ ] **Step 1: Write `src/components/TosPointList.jsx`** (ports `tos/tos.js:1-70` in full — `renderBullet`, `renderPoint`, `loadTos`)

```jsx
import { useEffect, useState } from 'react';

function Bullet({ bullet }) {
    if (bullet.type === 'yesno') {
        return (
            <li className={bullet.value ? 'tos-bullet-yesno tos-bullet-yes' : 'tos-bullet-yesno tos-bullet-no'}>
                <i className={bullet.value ? 'fa-solid fa-check' : 'fa-solid fa-xmark'} /> {bullet.text || ''}
            </li>
        );
    }
    return <li className="tos-bullet-plain">{bullet.text || ''}</li>;
}

function Point({ point, index }) {
    return (
        <div className="tos-point tier-card">
            <h3><span className="tos-point-number">{index + 1}. </span>{point.title || ''}</h3>
            {point.body && <p>{point.body}</p>}
            {(point.bullets || []).length > 0 && (
                <ul className="tos-bullets">
                    {point.bullets.map((bullet, i) => <Bullet bullet={bullet} key={i} />)}
                </ul>
            )}
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

    if (error) return <p className="feed-error">&gt; DATA UNAVAILABLE.</p>;
    if (points === null) return null;
    if (points.length === 0) return <p className="gallery-empty">&gt; NO TERMS PUBLISHED YET</p>;

    return <>{points.map((point, i) => <Point point={point} index={i} key={i} />)}</>;
}
```

- [ ] **Step 2: Write `src/pages/Tos.jsx`**

```jsx
import TosPointList from '../components/TosPointList.jsx';

export default function Tos() {
    return (
        <div className="datapad-wrapper datapad-wrapper--wide">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <h1><i className="fa-solid fa-scroll" /> Terms of Service</h1>
                <div id="tos-points"><TosPointList /></div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Add to `src/routes.js`, delete superseded files, write `tests/tos-page.test.js`, build+test, commit** (same pattern as Task 7 steps 3, 4, 5, 6, 7)

```bash
git rm tos/index.html tos/tos.js
git add -A
git commit -m "feat: migrate TOS page to React"
```

---

## Task 11: Queue page

**Files:**
- Create: `src/components/QueueBoard.jsx`, `src/pages/Queue.jsx`
- Modify: `src/routes.js`
- Delete: `queue/index.html`, `queue/queue.js`
- Test: `tests/queue-page.test.js`

**Interfaces:**
- Produces: `<Queue />` at `/queue/`, `datapad-wrapper--xwide` variant (per `queue/index.html:19`).

- [ ] **Step 1: Write `src/components/QueueBoard.jsx`** (ports `queue/queue.js:1-107` in full — `formatTargetDate`, `formatRelativeAge`, `renderCard`, `renderColumn`, `loadQueue`)

```jsx
import { useEffect, useState } from 'react';
import { formatDate } from '../../shared/format-date.js';

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

function Card({ card }) {
    const targetLabel = formatTargetDate(card.targetDate);
    const ageLabel = formatRelativeAge(card.createdAt);
    return (
        <div className="queue-card tier-card">
            <h4>{card.title || ''}</h4>
            {card.for && <p className="queue-card-for">For: {card.for}</p>}
            {targetLabel && <p className="queue-card-target">Target: {targetLabel}</p>}
            {ageLabel && <p className="queue-card-age">{ageLabel}</p>}
        </div>
    );
}

function Column({ column, cards }) {
    return (
        <div className="queue-column">
            <h3>{column.name}</h3>
            <div className="queue-column-cards">
                {cards.map((card) => <Card card={card} key={card.id} />)}
            </div>
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

    if (error) return <p className="feed-error">&gt; DATA UNAVAILABLE.</p>;
    if (data === null) return null;

    const enabledColumns = (data.columns || []).filter((c) => c.enabled);
    if (enabledColumns.length === 0) return <p className="gallery-empty">&gt; QUEUE IS CURRENTLY EMPTY</p>;

    return (
        <div className="queue-board-columns">
            {enabledColumns.map((column) => (
                <Column column={column} cards={(data.cards || []).filter((c) => c.columnId === column.id)} key={column.id} />
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Write `src/pages/Queue.jsx`**

```jsx
import QueueBoard from '../components/QueueBoard.jsx';

export default function Queue() {
    return (
        <div className="datapad-wrapper datapad-wrapper--xwide">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <h1><i className="fa-solid fa-list-check" /> Commission Queue</h1>
                <div id="queue-board"><QueueBoard /></div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Add to `src/routes.js`, delete superseded files, write `tests/queue-page.test.js`, build+test, commit**

```bash
git rm queue/index.html queue/queue.js
git add -A
git commit -m "feat: migrate queue page to React"
```

---

## Task 12: Admin shell + Characters section

**Files:**
- Create: `src/pages/Admin.jsx` (shell only, composes sub-sections created in this and the next 3 tasks), `src/components/admin/AdminCharacters.jsx`
- Modify: `src/routes.js` (adds `/admin/`, `robotsNoIndex: true`, its own tighter CSP)
- Test: `tests/admin-characters.test.js`

**Interfaces:**
- Produces: `<Admin />` — composes `<AdminCharacters />` now; `<AdminCommissionsInfo />`, `<AdminPastWork />`, `<AdminTos />`, `<AdminQueue />` are added by Tasks 13-15 (each task imports its new component into this same file — expect merge-order sensitivity if tasks run out of order; this task leaves clearly marked insertion points).
- Produces: `<AdminCharacters />` — full port of `admin/admin.js:1-169` and `admin/index.html:16-43` (character list + add/edit/delete form), using local `useState` for `currentCharacters`/`editingSlug` instead of module-level `let` variables, and controlled inputs instead of `getElementById`.

The admin page's CSP today (`admin/index.html:7`) is stricter than every other page (no `unpkg.com`, no Font Awesome). Since Task 3 already removed `unpkg.com` from the shared CSP (three.js is now an npm dependency, not a CDN import map) and every other route shares the same Font-Awesome-inclusive CSP, the admin route keeps needing its own override. `renderShell()` (Task 2) already accepts an optional `csp` field that falls back to the shared `CSP` constant when absent — set it explicitly on the `/admin/` route descriptor:

```js
// src/routes.js
{
    path: '/admin/',
    Page: Admin,
    title: 'Admin | Vyphir',
    robotsNoIndex: true,
    csp: "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self';",
    extraStylesheets: ['/admin/admin.css'],
},
```

`extraStylesheets` is likewise already threaded through `renderShell()` from Task 2 — setting it here is what adds `<link rel="stylesheet" href="/admin/admin.css">` to the admin page's output; no further `render-pages.js` changes are needed for this task.

Since `/admin/`'s CSP has no `https://cdnjs.cloudflare.com` (Font Awesome), `<AdminCharacters>` and its sibling admin components must not render any `fa-*` icon classes — check `admin/index.html`'s current markup (already confirmed: it has none) and keep it that way.

- [ ] **Step 1: Write `src/components/admin/AdminCharacters.jsx`**

Port the full character-management flow from `admin/admin.js`: fetch-on-mount character list (lines 159-169), `renderCharacterList`/list row edit+delete buttons (lines 125-157), `startEditingCharacter`/`resetCharacterForm` (lines 81-102), `renderExistingImages` existing-image keep/nsfw/thumbnail rows (lines 41-79), `renderNsfwCheckboxes` for newly-selected files (lines 7-32), `deleteCharacterFlow` (lines 106-123), and the submit handler building the exact same `meta` object shape and `FormData` (lines 438-503) posted to `/api/publish-character`. Use `useState` for: `characters`, `editingSlug`, `newFiles` (the `FileList`), `newFileNsfwFlags` (array of booleans, one per `newFiles` entry), `newFileThumbnailIndex`, `existingImages` (array of `{url, nsfw, thumbnail}`, only populated while editing), and form field values (`name`, `species`, `bio`) as controlled inputs. Keep every `window.confirm(...)` and `window.prompt(...)` call with identical message text — these are the plan's Global Constraint on preserving git-history-mutation guards.

```jsx
import { useEffect, useState } from 'react';

const CONFIRM_MESSAGE = 'This will be published live and permanently recorded in git history. Continue?';

export default function AdminCharacters() {
    const [characters, setCharacters] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [editingSlug, setEditingSlug] = useState(null);
    const [name, setName] = useState('');
    const [species, setSpecies] = useState('');
    const [bio, setBio] = useState('');
    const [existingImages, setExistingImages] = useState([]);
    const [newFiles, setNewFiles] = useState([]);
    const [newFileNsfw, setNewFileNsfw] = useState([]);
    const [newThumbnailKey, setNewThumbnailKey] = useState(null); // { kind: 'existing'|'new', index or url }
    const [status, setStatus] = useState({ message: '', isError: false });

    useEffect(() => {
        fetch('/data/characters.json')
            .then((r) => r.json())
            .then((d) => setCharacters(d.characters || []))
            .catch((error) => {
                console.error('Failed to load current characters:', error);
                setLoadError(true);
            });
    }, []);

    function resetForm() {
        setEditingSlug(null);
        setName('');
        setSpecies('');
        setBio('');
        setExistingImages([]);
        setNewFiles([]);
        setNewFileNsfw([]);
        setNewThumbnailKey(null);
    }

    function startEditing(character) {
        setEditingSlug(character.slug);
        setName(character.name || '');
        setSpecies(character.species || '');
        setBio(character.bio || '');
        setExistingImages((character.images || []).map((img) => ({ url: img.url, nsfw: Boolean(img.nsfw), keep: true })));
        setNewFiles([]);
        setNewFileNsfw([]);
        const thumb = (character.images || []).find((img) => img.thumbnail);
        setNewThumbnailKey(thumb ? { kind: 'existing', url: thumb.url } : null);
    }

    async function deleteCharacter(character) {
        const typed = window.prompt(`Type "${character.name}" to permanently delete this character:`);
        if (typed !== character.name) return;

        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ action: 'delete', slug: character.slug }));
            const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setCharacters((prev) => prev.filter((c) => c.slug !== character.slug));
            if (editingSlug === character.slug) resetForm();
            setStatus({ message: 'Deleted — live shortly', isError: false });
        } catch (error) {
            setStatus({ message: `Delete failed: ${error.message}`, isError: true });
        }
    }

    function handleFilesChange(e) {
        const files = Array.from(e.target.files);
        setNewFiles(files);
        setNewFileNsfw(files.map(() => false));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        const wasEditing = Boolean(editingSlug);

        const keptExisting = existingImages
            .filter((img) => img.keep)
            .map((img) => ({
                url: img.url,
                nsfw: img.nsfw,
                thumbnail: newThumbnailKey?.kind === 'existing' && newThumbnailKey.url === img.url,
            }));

        const totalImageCount = keptExisting.length + newFiles.length;
        const allImagesNsfw =
            totalImageCount > 0 &&
            keptExisting.every((img) => img.nsfw) &&
            newFileNsfw.every(Boolean);

        const meta = {
            name,
            species,
            bio,
            nsfwFlags: newFileNsfw,
            existingImages: keptExisting,
            thumbnailNewIndex: newThumbnailKey?.kind === 'new' ? newThumbnailKey.index : null,
        };
        if (editingSlug) meta.slug = editingSlug;

        const formData = new FormData();
        formData.append('meta', JSON.stringify(meta));
        newFiles.forEach((file) => formData.append('images', file));

        setStatus({ message: wasEditing ? 'Saving...' : 'Publishing...', isError: false });
        try {
            const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            const nsfwNote = allImagesNsfw
                ? " (note: all images are NSFW, so this character won't appear on the homepage gallery)"
                : '';
            setStatus({
                message: `${wasEditing ? 'Saved' : 'Published'} — live shortly at /gallery/${result.slug}/${nsfwNote}`,
                isError: false,
            });
            setCharacters((prev) => {
                const index = prev.findIndex((c) => c.slug === result.slug);
                if (index === -1) return [...prev, result.character];
                const copy = [...prev];
                copy[index] = result.character;
                return copy;
            });
            resetForm();
        } catch (error) {
            setStatus({ message: error.message, isError: true });
        }
    }

    return (
        <>
            <section className="admin-panel">
                <h2>Manage Characters</h2>
                <div id="character-list">
                    {characters.map((character) => {
                        const images = character.images || [];
                        const thumb = images.find((img) => img.thumbnail) || images[0];
                        return (
                            <div className="character-list-row" key={character.slug}>
                                {thumb && <img className="character-list-thumb" alt="" src={thumb.url} />}
                                <span className="character-list-name">{character.name}</span>
                                <button type="button" onClick={() => startEditing(character)}>Edit</button>
                                <button type="button" className="danger-button" onClick={() => deleteCharacter(character)}>Delete</button>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="admin-panel">
                <h2>{editingSlug ? `Edit ${name}` : 'Add Character'}</h2>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="char-name">Name</label>
                    <input type="text" id="char-name" required value={name} onChange={(e) => setName(e.target.value)} />

                    <label htmlFor="char-species">Species / Type</label>
                    <input type="text" id="char-species" value={species} onChange={(e) => setSpecies(e.target.value)} />

                    <label htmlFor="char-bio">Bio</label>
                    <textarea id="char-bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />

                    <div id="char-existing-images">
                        {existingImages.map((img, i) => (
                            <div className="image-row existing-image-row" key={img.url}>
                                <img src={img.url} alt="" className="existing-image-thumb" />
                                <label>
                                    <input
                                        type="checkbox"
                                        className="existing-image-keep"
                                        checked={img.keep}
                                        onChange={(e) => setExistingImages((prev) => prev.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                                    /> Keep
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        className="existing-image-nsfw"
                                        checked={img.nsfw}
                                        onChange={(e) => setExistingImages((prev) => prev.map((x, j) => (j === i ? { ...x, nsfw: e.target.checked } : x)))}
                                    /> NSFW
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="char-thumbnail"
                                        className="existing-image-thumbnail"
                                        checked={newThumbnailKey?.kind === 'existing' && newThumbnailKey.url === img.url}
                                        onChange={() => setNewThumbnailKey({ kind: 'existing', url: img.url })}
                                    /> Thumbnail
                                </label>
                            </div>
                        ))}
                    </div>

                    <label htmlFor="char-images">Add images (select multiple)</label>
                    <input type="file" id="char-images" accept="image/png,image/jpeg,image/webp" multiple onChange={handleFilesChange} />
                    <div id="char-nsfw-rows">
                        {newFiles.map((file, i) => (
                            <div className="image-row" key={i}>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={newFileNsfw[i]}
                                        onChange={(e) => setNewFileNsfw((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                                    /> {file.name}
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="char-thumbnail"
                                        checked={newThumbnailKey?.kind === 'new' && newThumbnailKey.index === i}
                                        onChange={() => setNewThumbnailKey({ kind: 'new', index: i })}
                                    /> Thumbnail
                                </label>
                            </div>
                        ))}
                    </div>

                    <button type="submit" disabled={loadError}>{editingSlug ? 'Save Changes' : 'Publish Character'}</button>
                    {editingSlug && <button type="button" onClick={resetForm}>Cancel Edit</button>}
                    <p className={`admin-status ${status.isError ? 'error' : 'success'}`}>{status.message}</p>
                </form>
            </section>
        </>
    );
}
```

- [ ] **Step 2: Write `src/pages/Admin.jsx`** (shell — later tasks add sibling sections after `<AdminCharacters />`)

```jsx
import AdminCharacters from '../components/admin/AdminCharacters.jsx';

export default function Admin() {
    return (
        <>
            <h1>Vyphir Admin</h1>
            <AdminCharacters />
            {/* AdminCommissionsInfo, AdminPastWork, AdminTos, AdminQueue inserted here by Tasks 13-15 */}
        </>
    );
}
```

- [ ] **Step 3: Add to `src/routes.js`** (see the CSP/robots/`extraStylesheets` snippet above — that full entry is this step's deliverable)

- [ ] **Step 4: Write `tests/admin-characters.test.js`** — SSR assertion that the character-list container and add-character form fields render with correct `id`s/labels (`char-name`, `char-species`, `char-bio`, `char-images` present; submit button text is "Publish Character" in the non-editing SSR state).

- [ ] **Step 5: Build, test. Since `/admin/` is Cloudflare-Access-gated in production, manually verify locally** (`npm run dev`, or serve `dist/client/admin/`) that: loading the page lists existing characters, editing a character populates the form and existing-image rows correctly, adding a new character with images + NSFW flags + a chosen thumbnail round-trips through `/api/publish-character` (hit the real Function via `wrangler pages dev`, per the existing local-dev pattern noted in project memory), and deleting requires typing the exact name.

```bash
npm run build && npm test
npx wrangler pages dev dist/client
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: migrate admin characters section to React"
```

---

## Task 13: Admin Commissions Info + Past Work sections

**Files:**
- Create: `src/components/admin/AdminCommissionsInfo.jsx`, `src/components/admin/AdminPastWork.jsx`
- Modify: `src/pages/Admin.jsx` (insert both after `<AdminCharacters />`)
- Test: `tests/admin-commissions-info.test.js`, `tests/admin-past-work.test.js`

**Interfaces:**
- Produces: `<AdminCommissionsInfo />` — ports `admin/admin.js`'s tier-rows (lines 171-212), commissions-info fetch (421-436), and submit handler (505-550).
- Produces: `<AdminPastWork />` — ports the past-work list/reorder/toggle/edit/delete flows (lines 214-419) and the "Add Past Work" form submit handler (889-921). These two are separate components (matching the two separate `admin-panel` sections in `admin/index.html:65-87`) but share the `currentPastWork` state today via module scope — since React components can't share `useState` across siblings without lifting it, lift `pastWork` state into `Admin.jsx` and pass it + its setter down as props to both.

- [ ] **Step 1: Lift past-work state into `src/pages/Admin.jsx`**

```jsx
import { useEffect, useState } from 'react';
import AdminCharacters from '../components/admin/AdminCharacters.jsx';
import AdminCommissionsInfo from '../components/admin/AdminCommissionsInfo.jsx';
import AdminPastWork from '../components/admin/AdminPastWork.jsx';

export default function Admin() {
    const [pastWork, setPastWork] = useState([]);
    const [savedPastWorkOrder, setSavedPastWorkOrder] = useState([]);

    useEffect(() => {
        fetch('/data/commissions.json')
            .then((r) => r.json())
            .then((d) => {
                const work = d.pastWork || [];
                setPastWork(work);
                setSavedPastWorkOrder(work.map((e) => e.url));
            })
            .catch((error) => console.error('Failed to load current commissions data:', error));
    }, []);

    return (
        <>
            <h1>Vyphir Admin</h1>
            <AdminCharacters />
            <AdminCommissionsInfo />
            <AdminPastWork
                pastWork={pastWork}
                setPastWork={setPastWork}
                savedOrder={savedPastWorkOrder}
                setSavedOrder={setSavedPastWorkOrder}
            />
            {/* AdminTos, AdminQueue inserted here by Tasks 14-15 */}
        </>
    );
}
```

Note this duplicates the `/data/commissions.json` fetch that `AdminCommissionsInfo` also needs (for `status`/`intro`/`specialOffer`/`tiers`) — rather than lifting *all* of it up (which would bloat `Admin.jsx` back into a god-component), let `AdminCommissionsInfo` keep its own independent fetch for the info-only fields, matching how `admin/admin.js` already made two separate fetches to the same URL for genuinely separate concerns (info form vs. past-work list) — this mirrors the original code's structure rather than fighting it.

- [ ] **Step 2: Write `src/components/admin/AdminCommissionsInfo.jsx`**

```jsx
import { useEffect, useState } from 'react';

const CONFIRM_MESSAGE = 'This will be published live and permanently recorded in git history. Continue?';

function emptyTier() {
    return { name: '', price: '', description: '', example: '', newFile: null };
}

export default function AdminCommissionsInfo() {
    const [status, setStatus] = useState(true);
    const [intro, setIntro] = useState('');
    const [specialOffer, setSpecialOffer] = useState('');
    const [tiers, setTiers] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [saveStatus, setSaveStatus] = useState({ message: '', isError: false });

    useEffect(() => {
        fetch('/data/commissions.json')
            .then((r) => r.json())
            .then((d) => {
                setStatus(Boolean(d.status));
                setIntro(d.intro || '');
                setSpecialOffer(d.specialOffer || '');
                setTiers((d.tiers || []).map((t) => ({ ...t, newFile: null })));
            })
            .catch((error) => {
                console.error('Failed to load current commissions data:', error);
                setLoadError(true);
            });
    }, []);

    function updateTier(index, patch) {
        setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!window.confirm(CONFIRM_MESSAGE)) return;

        const cleanedTiers = [];
        const tierFiles = [];
        tiers.forEach((tier) => {
            const name = (tier.name || '').trim();
            const price = (tier.price || '').trim();
            const description = (tier.description || '').trim();
            const existingExample = tier.example || '';
            if (!name && !price && !description && !existingExample && !tier.newFile) return;
            cleanedTiers.push({ name, price, description, example: existingExample });
            tierFiles.push(tier.newFile || new File([], 'unchanged'));
        });

        const meta = { type: 'info', status, intro, specialOffer, tiers: cleanedTiers };
        const formData = new FormData();
        formData.append('meta', JSON.stringify(meta));
        tierFiles.forEach((file) => formData.append('tierImages', file));

        setSaveStatus({ message: 'Saving...', isError: false });
        try {
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setSaveStatus({ message: 'Saved — live shortly', isError: false });
            setTiers((result.tiers || []).map((t) => ({ ...t, newFile: null })));
        } catch (error) {
            setSaveStatus({ message: error.message, isError: true });
        }
    }

    return (
        <section className="admin-panel">
            <h2>Commission Info</h2>
            <form onSubmit={handleSubmit}>
                <label><input type="checkbox" checked={status} onChange={(e) => setStatus(e.target.checked)} /> Commissions open</label>

                <label htmlFor="comm-intro">Intro text</label>
                <textarea id="comm-intro" rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} />

                <label htmlFor="comm-special-offer">Special offer (e.g. PWYW) — leave blank if none</label>
                <input type="text" id="comm-special-offer" value={specialOffer} onChange={(e) => setSpecialOffer(e.target.value)} />

                <label>Tiers</label>
                <div id="comm-tiers-rows">
                    {tiers.map((tier, i) => (
                        <div className="tier-row" key={i}>
                            <input type="text" placeholder="Tier name" value={tier.name} onChange={(e) => updateTier(i, { name: e.target.value })} />
                            <input type="text" placeholder="Price (e.g. $20)" value={tier.price} onChange={(e) => updateTier(i, { price: e.target.value })} />
                            <textarea rows={2} placeholder="Description" value={tier.description} onChange={(e) => updateTier(i, { description: e.target.value })} />
                            <label>{tier.example ? 'Replace example image (optional)' : 'Example image (optional)'}</label>
                            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => updateTier(i, { newFile: e.target.files[0] || null })} />
                            <button type="button" onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}>Remove tier</button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={() => setTiers((prev) => [...prev, emptyTier()])}>Add tier</button>

                <button type="submit" disabled={loadError}>Save Commission Info</button>
                <p className={`admin-status ${saveStatus.isError ? 'error' : 'success'}`}>{saveStatus.message}</p>
            </form>
        </section>
    );
}
```

- [ ] **Step 3: Write `src/components/admin/AdminPastWork.jsx`**

Port lines 214-419 and 889-921 of `admin/admin.js`, using the `pastWork`/`setPastWork`/`savedOrder`/`setSavedOrder` props from `Admin.jsx` in place of the module-level `currentPastWork`/`savedPastWorkOrder` variables. Every mutating action (`toggleNsfwFlow`, `toggleGiftArtFlow`, `editPastWorkFlow`, `deletePastWorkFlow`, reorder, add) keeps its exact `window.confirm`/`window.prompt` text and its optimistic local-state update on success, matching the original.

```jsx
import { useState } from 'react';

const CONFIRM_MESSAGE = 'This will be published live and permanently recorded in git history. Continue?';

function isOrderDirty(pastWork, savedOrder) {
    if (pastWork.length !== savedOrder.length) return true;
    return pastWork.some((entry, i) => entry.url !== savedOrder[i]);
}

export default function AdminPastWork({ pastWork, setPastWork, savedOrder, setSavedOrder }) {
    const [orderStatus, setOrderStatus] = useState({ message: '', isError: false });
    const [itemStatus, setItemStatus] = useState({ message: '', isError: false });
    const [caption, setCaption] = useState('');
    const [nsfw, setNsfw] = useState(false);
    const [giftArt, setGiftArt] = useState(false);
    const [file, setFile] = useState(null);

    function move(entry, direction) {
        const index = pastWork.findIndex((e) => e.url === entry.url);
        const targetIndex = index + direction;
        if (index === -1 || targetIndex < 0 || targetIndex >= pastWork.length) return;
        const reordered = [...pastWork];
        [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
        setPastWork(reordered);
    }

    async function saveOrder() {
        if (!isOrderDirty(pastWork, savedOrder)) return;
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ type: 'past-work', action: 'reorder', order: pastWork.map((e) => e.url) }));
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setSavedOrder(pastWork.map((e) => e.url));
            setOrderStatus({ message: 'Order saved — live shortly', isError: false });
        } catch (error) {
            setOrderStatus({ message: error.message, isError: true });
        }
    }

    async function toggleField(entry, field, newValue) {
        if (!window.confirm(CONFIRM_MESSAGE)) return false;
        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ type: 'past-work', action: 'edit', url: entry.url, caption: entry.caption, [field]: newValue }));
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setPastWork((prev) => prev.map((e) => (e.url === entry.url ? { ...e, [field]: newValue } : e)));
            setItemStatus({ message: 'Updated — live shortly', isError: false });
            return true;
        } catch (error) {
            setItemStatus({ message: error.message, isError: true });
            return false;
        }
    }

    async function editCaption(entry) {
        const newCaption = window.prompt('Edit caption:', entry.caption || '');
        if (newCaption === null) return;
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ type: 'past-work', action: 'edit', url: entry.url, caption: newCaption }));
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setPastWork((prev) => prev.map((e) => (e.url === entry.url ? { ...e, caption: newCaption } : e)));
            setItemStatus({ message: 'Caption updated — live shortly', isError: false });
        } catch (error) {
            setItemStatus({ message: error.message, isError: true });
        }
    }

    async function deleteEntry(entry) {
        if (!window.confirm('Delete this past-work entry? This will be published live and permanently recorded in git history.')) return;
        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ type: 'past-work', action: 'delete', url: entry.url }));
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setPastWork((prev) => prev.filter((e) => e.url !== entry.url));
            setSavedOrder((prev) => prev.filter((u) => u !== entry.url));
            setItemStatus({ message: 'Deleted — live shortly', isError: false });
        } catch (error) {
            setItemStatus({ message: error.message, isError: true });
        }
    }

    async function handleAddSubmit(e) {
        e.preventDefault();
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        if (!file) return;

        const formData = new FormData();
        formData.append('meta', JSON.stringify({ type: 'past-work', action: 'add', caption, nsfw, giftArt }));
        formData.append('image', file);

        setItemStatus({ message: 'Publishing...', isError: false });
        try {
            const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setItemStatus({ message: 'Published — live shortly', isError: false });
            setPastWork((prev) => [...prev, result.entry]);
            setSavedOrder((prev) => [...prev, result.entry.url]);
            setCaption('');
            setNsfw(false);
            setGiftArt(false);
            setFile(null);
        } catch (error) {
            setItemStatus({ message: error.message, isError: true });
        }
    }

    const orderDirty = isOrderDirty(pastWork, savedOrder);

    return (
        <>
            <section className="admin-panel">
                <h2>Manage Past Work</h2>
                <div id="past-work-list">
                    {pastWork.map((entry, index) => (
                        <div className="past-work-list-row" key={entry.url}>
                            <img className="past-work-list-thumb" src={entry.url} alt="" />
                            <span className="past-work-list-caption">{entry.caption || ''}</span>
                            <label><input type="checkbox" checked={Boolean(entry.nsfw)} onChange={(e) => toggleField(entry, 'nsfw', e.target.checked)} /> NSFW</label>
                            <label><input type="checkbox" checked={Boolean(entry.giftArt)} onChange={(e) => toggleField(entry, 'giftArt', e.target.checked)} /> Gift art</label>
                            <button type="button" disabled={index === 0} onClick={() => move(entry, -1)}>↑</button>
                            <button type="button" disabled={index === pastWork.length - 1} onClick={() => move(entry, 1)}>↓</button>
                            <button type="button" onClick={() => editCaption(entry)}>Edit caption</button>
                            <button type="button" className="danger-button" onClick={() => deleteEntry(entry)}>Delete</button>
                        </div>
                    ))}
                </div>
                <button type="button" id="past-work-save-order" disabled={!orderDirty} onClick={saveOrder}>Save Order</button>
                <p className={`admin-status ${orderStatus.isError ? 'error' : 'success'}`}>{orderStatus.message}</p>
            </section>

            <section className="admin-panel">
                <h2>Add Past Work</h2>
                <form onSubmit={handleAddSubmit}>
                    <label htmlFor="past-work-image">Image</label>
                    <input type="file" id="past-work-image" accept="image/png,image/jpeg,image/webp" required onChange={(e) => setFile(e.target.files[0] || null)} />

                    <label htmlFor="past-work-caption">Caption</label>
                    <input type="text" id="past-work-caption" value={caption} onChange={(e) => setCaption(e.target.value)} />

                    <label><input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} /> NSFW</label>
                    <label><input type="checkbox" checked={giftArt} onChange={(e) => setGiftArt(e.target.checked)} /> Gift art (not commissioned)</label>

                    <button type="submit">Publish Past Work</button>
                    <p className={`admin-status ${itemStatus.isError ? 'error' : 'success'}`}>{itemStatus.message}</p>
                </form>
            </section>
        </>
    );
}
```

- [ ] **Step 4: Write `tests/admin-commissions-info.test.js` and `tests/admin-past-work.test.js`** (SSR assertions on initial-state markup: form fields present with correct ids/labels, "Add tier"/"Save Order"/"Publish Past Work" buttons present, "Save Order" disabled in the initial empty-list state).

- [ ] **Step 5: Build, test, manually verify against `wrangler pages dev`: add a tier with an image, save commission info, add a past-work entry, toggle its NSFW/gift-art flags, reorder, edit caption, delete.**

```bash
npm run build && npm test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: migrate admin commissions-info and past-work sections to React"
```

---

## Task 14: Admin TOS section

**Files:**
- Create: `src/components/admin/AdminTos.jsx`
- Modify: `src/pages/Admin.jsx` (insert after past-work sections)
- Test: `tests/admin-tos.test.js`

**Interfaces:**
- Produces: `<AdminTos />` — ports `admin/admin.js`'s TOS point/bullet row builder and submit handler (lines 552-721: `moveRow`, `renderTosBulletRow`, `renderTosPointRow`, `collectTosPoints`, fetch+submit).

- [ ] **Step 1: Write `src/components/admin/AdminTos.jsx`**

Use nested `useState` arrays: `points: [{ title, body, bullets: [{ type, text, value }] }]`. Reordering (`moveRow`'s up/down) becomes array-index swaps via `setPoints`; the same pattern applies to bullets within a point.

```jsx
import { useEffect, useState } from 'react';

const CONFIRM_MESSAGE = 'This will be published live and permanently recorded in git history. Continue?';

function emptyBullet() {
    return { type: 'plain', text: '', value: false };
}
function emptyPoint() {
    return { title: '', body: '', bullets: [] };
}
function swap(array, i, j) {
    const copy = [...array];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
}

export default function AdminTos() {
    const [points, setPoints] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [status, setStatus] = useState({ message: '', isError: false });

    useEffect(() => {
        fetch('/data/tos.json')
            .then((r) => r.json())
            .then((d) => setPoints((d.points || []).map((p) => ({ ...p, bullets: p.bullets || [] }))))
            .catch((error) => {
                console.error('Failed to load current TOS data:', error);
                setLoadError(true);
            });
    }, []);

    function updatePoint(pi, patch) {
        setPoints((prev) => prev.map((p, i) => (i === pi ? { ...p, ...patch } : p)));
    }
    function movePoint(pi, direction) {
        const target = pi + direction;
        if (target < 0 || target >= points.length) return;
        setPoints((prev) => swap(prev, pi, target));
    }
    function updateBullet(pi, bi, patch) {
        setPoints((prev) => prev.map((p, i) => (i !== pi ? p : { ...p, bullets: p.bullets.map((b, j) => (j === bi ? { ...b, ...patch } : b)) })));
    }
    function moveBullet(pi, bi, direction) {
        const point = points[pi];
        const target = bi + direction;
        if (target < 0 || target >= point.bullets.length) return;
        updatePoint(pi, { bullets: swap(point.bullets, bi, target) });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!window.confirm(CONFIRM_MESSAGE)) return;

        const cleaned = points
            .map((p) => ({
                title: (p.title || '').trim(),
                body: (p.body || '').trim(),
                bullets: p.bullets
                    .map((b) => (b.type === 'yesno' ? { type: 'yesno', text: (b.text || '').trim(), value: Boolean(b.value) } : { type: 'plain', text: (b.text || '').trim() }))
                    .filter((b) => b.text),
            }))
            .filter((p) => p.title);

        setStatus({ message: 'Saving...', isError: false });
        try {
            const response = await fetch('/api/publish-tos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points: cleaned }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setStatus({ message: 'Saved — live shortly', isError: false });
        } catch (error) {
            setStatus({ message: error.message, isError: true });
        }
    }

    return (
        <section className="admin-panel">
            <h2>Terms of Service</h2>
            <form onSubmit={handleSubmit}>
                <div id="tos-points-rows">
                    {points.map((point, pi) => (
                        <div className="tos-point-row" key={pi}>
                            <div className="tos-point-row-header">
                                <button type="button" onClick={() => movePoint(pi, -1)}>↑ Move point</button>
                                <button type="button" onClick={() => movePoint(pi, 1)}>↓ Move point</button>
                                <button type="button" className="danger-button" onClick={() => setPoints((prev) => prev.filter((_, i) => i !== pi))}>Remove point</button>
                            </div>
                            <label>Title</label>
                            <input type="text" value={point.title} onChange={(e) => updatePoint(pi, { title: e.target.value })} />
                            <label>Body</label>
                            <textarea rows={2} value={point.body} onChange={(e) => updatePoint(pi, { body: e.target.value })} />
                            <label>Bullets</label>
                            <div className="tos-bullet-rows">
                                {point.bullets.map((bullet, bi) => (
                                    <div className="tos-bullet-row" key={bi}>
                                        <select value={bullet.type} onChange={(e) => updateBullet(pi, bi, { type: e.target.value })}>
                                            <option value="plain">Plain</option>
                                            <option value="yesno">Yes / No</option>
                                        </select>
                                        <input type="text" placeholder="Bullet text" value={bullet.text} onChange={(e) => updateBullet(pi, bi, { text: e.target.value })} />
                                        <label className={bullet.type === 'yesno' ? '' : 'hidden'}>
                                            <input type="checkbox" checked={Boolean(bullet.value)} onChange={(e) => updateBullet(pi, bi, { value: e.target.checked })} /> Yes (unchecked = No)
                                        </label>
                                        <button type="button" onClick={() => moveBullet(pi, bi, -1)}>↑</button>
                                        <button type="button" onClick={() => moveBullet(pi, bi, 1)}>↓</button>
                                        <button type="button" className="danger-button" onClick={() => updatePoint(pi, { bullets: point.bullets.filter((_, i) => i !== bi) })}>Remove</button>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={() => updatePoint(pi, { bullets: [...point.bullets, emptyBullet()] })}>Add bullet</button>
                        </div>
                    ))}
                </div>
                <button type="button" onClick={() => setPoints((prev) => [...prev, emptyPoint()])}>Add point</button>
                <button type="submit" disabled={loadError}>Save TOS</button>
                <p className={`admin-status ${status.isError ? 'error' : 'success'}`}>{status.message}</p>
            </form>
        </section>
    );
}
```

- [ ] **Step 2: Insert into `src/pages/Admin.jsx`** after `<AdminPastWork />`.

- [ ] **Step 3: Write `tests/admin-tos.test.js`** (SSR assertion: "Add point"/"Save TOS" buttons present, empty `tos-points-rows` container in the initial state).

- [ ] **Step 4: Build, test, manually verify: add a point with a plain bullet and a yes/no bullet, reorder points and bullets, save, confirm `/tos/` reflects it.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrate admin TOS section to React"
```

---

## Task 15: Admin Queue section

**Files:**
- Create: `src/components/admin/AdminQueue.jsx`
- Modify: `src/pages/Admin.jsx` (insert after TOS section — this completes `Admin.jsx`, remove the trailing comment placeholder)
- Test: `tests/admin-queue.test.js`

**Interfaces:**
- Produces: `<AdminQueue />` — ports `admin/admin.js`'s queue-columns/queue-cards management and the "Add Queue Card" form (lines 723-887).

- [ ] **Step 1: Write `src/components/admin/AdminQueue.jsx`**

```jsx
import { useEffect, useState } from 'react';

const CONFIRM_MESSAGE = 'This will be published live and permanently recorded in git history. Continue?';

export default function AdminQueue() {
    const [columns, setColumns] = useState([]);
    const [cards, setCards] = useState([]);
    const [loadError, setLoadError] = useState(false);
    const [status, setStatus] = useState({ message: '', isError: false });
    const [title, setTitle] = useState('');
    const [forWhom, setForWhom] = useState('');
    const [targetDate, setTargetDate] = useState('');

    useEffect(() => {
        fetch('/data/queue.json')
            .then((r) => r.json())
            .then((d) => {
                setColumns(d.columns || []);
                setCards(d.cards || []);
            })
            .catch((error) => {
                console.error('Failed to load current queue data:', error);
                setLoadError(true);
            });
    }, []);

    function updateColumn(id, patch) {
        setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    }

    function moveCardWithinColumn(card, direction) {
        const sameColumn = cards.filter((c) => c.columnId === card.columnId);
        const posInColumn = sameColumn.indexOf(card);
        const targetPos = posInColumn + direction;
        if (targetPos < 0 || targetPos >= sameColumn.length) return;
        const neighbor = sameColumn[targetPos];
        const cardIndex = cards.indexOf(card);
        const neighborIndex = cards.indexOf(neighbor);
        setCards((prev) => {
            const copy = [...prev];
            [copy[cardIndex], copy[neighborIndex]] = [copy[neighborIndex], copy[cardIndex]];
            return copy;
        });
    }

    function updateCard(id, patch) {
        setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    }

    function addCard(e) {
        e.preventDefault();
        setCards((prev) => [
            ...prev,
            { id: crypto.randomUUID(), columnId: (columns[0] || {}).id, title, for: forWhom, targetDate, createdAt: new Date().toISOString() },
        ]);
        setTitle('');
        setForWhom('');
        setTargetDate('');
    }

    async function saveQueue() {
        if (!window.confirm(CONFIRM_MESSAGE)) return;
        setStatus({ message: 'Saving...', isError: false });
        try {
            const response = await fetch('/api/publish-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columns, cards }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown error');
            setStatus({ message: 'Saved — live shortly', isError: false });
        } catch (error) {
            setStatus({ message: error.message, isError: true });
        }
    }

    return (
        <>
            <section className="admin-panel">
                <h2>Queue Columns</h2>
                <div id="queue-columns-rows">
                    {columns.map((column) => (
                        <div className="image-row" key={column.id}>
                            <input type="text" value={column.name} onChange={(e) => updateColumn(column.id, { name: e.target.value })} />
                            <label><input type="checkbox" checked={column.enabled} onChange={(e) => updateColumn(column.id, { enabled: e.target.checked })} /> Visible</label>
                        </div>
                    ))}
                </div>
            </section>

            <section className="admin-panel">
                <h2>Queue Cards</h2>
                <div id="queue-cards-list">
                    {cards.map((card) => (
                        <div className="past-work-list-row" key={card.id}>
                            <input type="text" value={card.title} onChange={(e) => updateCard(card.id, { title: e.target.value })} />
                            <input type="text" placeholder="For" value={card.for || ''} onChange={(e) => updateCard(card.id, { for: e.target.value })} />
                            <input type="date" value={card.targetDate || ''} onChange={(e) => updateCard(card.id, { targetDate: e.target.value })} />
                            <select value={card.columnId} onChange={(e) => updateCard(card.id, { columnId: e.target.value })}>
                                {columns.map((column) => (
                                    <option value={column.id} key={column.id}>{column.enabled ? column.name : `${column.name} (hidden)`}</option>
                                ))}
                            </select>
                            <button type="button" onClick={() => moveCardWithinColumn(card, -1)}>↑</button>
                            <button type="button" onClick={() => moveCardWithinColumn(card, 1)}>↓</button>
                            <button type="button" className="danger-button" onClick={() => setCards((prev) => prev.filter((c) => c.id !== card.id))}>Delete</button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="admin-panel">
                <h2>Add Queue Card</h2>
                <form onSubmit={addCard}>
                    <label htmlFor="queue-card-title">Title</label>
                    <input type="text" id="queue-card-title" required value={title} onChange={(e) => setTitle(e.target.value)} />

                    <label htmlFor="queue-card-for">For</label>
                    <input type="text" id="queue-card-for" placeholder="@handle or name" value={forWhom} onChange={(e) => setForWhom(e.target.value)} />

                    <label htmlFor="queue-card-target-date">Target date (optional)</label>
                    <input type="date" id="queue-card-target-date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />

                    <button type="submit">Add Card</button>
                </form>
                <button type="button" id="queue-save" disabled={loadError} onClick={saveQueue}>Save Queue</button>
                <p className={`admin-status ${status.isError ? 'error' : 'success'}`}>{status.message}</p>
            </section>
        </>
    );
}
```

- [ ] **Step 2: Finalize `src/pages/Admin.jsx`** — insert `<AdminQueue />` after `<AdminTos />`, remove the placeholder comment.

- [ ] **Step 3: Write `tests/admin-queue.test.js`** (SSR assertion: "Add Card"/"Save Queue" buttons present, `queue-card-title` required field present).

- [ ] **Step 4: Build, test, manually verify: edit a column name/visibility, add a card, reorder within a column, move a card between columns via the select, save, confirm `/queue/` reflects it.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: migrate admin queue section to React, completing Admin page"
```

---

## Task 16: Clean up old admin shell, update `head-parity` and `redirects-module-paths` tests

**Files:**
- Delete: `admin/index.html`, `admin/admin.js`, `shared/enlargeable.js`, `nsfw-reveal.js`
- Modify: `tests/head-parity.test.js`, `tests/redirects-module-paths.test.js`

**Interfaces:**
- None new — this task retires the last vanilla-JS files and points the two structural tests at the new SSG output instead of the old template files.

- [ ] **Step 1: Delete superseded files**

```bash
git rm admin/index.html admin/admin.js shared/enlargeable.js nsfw-reveal.js
```

Confirm nothing still imports `shared/enlargeable.js` or `nsfw-reveal.js` first:

```bash
grep -rln "enlargeable\.js\|nsfw-reveal\.js" --include="*.js" --include="*.jsx" . | grep -v node_modules | grep -v dist
```

Expected: no matches (Task 4's `EnlargeableImage.jsx`/`NsfwBlurImage.jsx` fully replaced them by this point).

- [ ] **Step 2: Rewrite `tests/head-parity.test.js` to assert against built SSG output instead of source templates**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const ROUTABLE_PAGES = [
    'dist/client/index.html',
    'dist/client/gallery/index.html',
    'dist/client/commissions/index.html',
    'dist/client/tos/index.html',
    'dist/client/queue/index.html',
];

function extractCsp(html) {
    const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    return match ? match[1] : null;
}

function extractStylesheetHosts(html) {
    const hosts = new Set();
    for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
        const href = match[1];
        if (href.startsWith('http')) hosts.add(new URL(href).host);
    }
    return [...hosts].sort();
}

test('all routable built pages share an identical CSP', () => {
    const csps = ROUTABLE_PAGES.map((path) => ({ path, csp: extractCsp(readFileSync(join(projectRoot, path), 'utf8')) }));
    const [first, ...rest] = csps;
    for (const entry of rest) {
        assert.equal(entry.csp, first.csp, `${entry.path}'s CSP differs from ${first.path}'s`);
    }
});

test('all routable built pages load the same external stylesheet hosts', () => {
    const hostSets = ROUTABLE_PAGES.map((path) => ({ path, hosts: extractStylesheetHosts(readFileSync(join(projectRoot, path), 'utf8')) }));
    const [first, ...rest] = hostSets;
    for (const entry of rest) {
        assert.deepEqual(entry.hosts, first.hosts, `${entry.path} loads different external stylesheets than ${first.path}`);
    }
});

test('the admin page intentionally uses a stricter CSP than public pages', () => {
    const adminCsp = extractCsp(readFileSync(join(projectRoot, 'dist/client/admin/index.html'), 'utf8'));
    const publicCsp = extractCsp(readFileSync(join(projectRoot, 'dist/client/index.html'), 'utf8'));
    assert.notEqual(adminCsp, publicCsp);
    assert.doesNotMatch(adminCsp, /cdnjs\.cloudflare\.com/);
});
```

This test now depends on `npm run build` having already run — add a `test:build` npm script or document in this test file's header comment that `npm run build` must precede `npm test` in CI (check whether `tests/render-pages.test.js`'s Step 11 build-triggering test, which runs first alphabetically, already guarantees this ordering under Node's default test-file execution order; if `node --test` doesn't guarantee file ordering, add an explicit `npm run build` step to whatever CI/pretest script invokes `npm test`).

- [ ] **Step 3: Rewrite `tests/redirects-module-paths.test.js`** — the entire premise (scanning `.html` files for `<script type="module">` entries and following static `import` chains) no longer applies now that there's one Vite-bundled client entry per page rather than many hand-written ES modules. Replace it with a much simpler check: since Vite bundles everything reachable from `src/entry-client.jsx` into hashed `dist/client/assets/*.js` files that `_redirects` has no rules matching (`_redirects` only targets `/docs/*`, `/tests/*`, `/scripts/*`, `/templates/*`, `/shared/slugify.js`, `/MANUAL_SETUP.md`, `/package.json`, `/wrangler.toml`), assert none of `_redirects`'s rules would shadow anything under `/assets/` or the static routes:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('_redirects rules do not shadow the built client bundle or any known route', () => {
    const content = readFileSync(join(projectRoot, '_redirects'), 'utf8');
    const prefixes = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.split(/\s+/)[0])
        .filter((source) => source.endsWith('/*'))
        .map((source) => source.slice(0, -1));

    const protectedPaths = ['/assets/entry-client.js', '/', '/gallery/', '/commissions/', '/tos/', '/queue/', '/admin/'];
    for (const path of protectedPaths) {
        const shadow = prefixes.find((prefix) => path.startsWith(prefix));
        assert.equal(shadow, undefined, `${path} is shadowed by _redirects rule "${shadow}*"`);
    }
});
```

Since `template/`, `scripts/`, and `shared/slugify.js` are still real paths this repo serves at their literal names (`shared/slugify.js` is fetched by nothing client-side, only imported server-side by Functions — confirm no test or route needs it reachable over HTTP; if it never was reachable over HTTP even before this migration, the existing `_redirects` rule blocking it was already just defense-in-depth, not a live requirement — leave `_redirects` itself unchanged in this task, only the test simplifies).

- [ ] **Step 4: Run full suite**

```bash
npm run build && npm test
```

Expected: all tests pass, including the rewritten two.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: retire legacy admin/vanilla-JS files, update structural tests for SSG output"
```

---

## Task 17: `wrangler.toml`, final `_redirects` review, CSP consolidation check

**Files:**
- Modify: `wrangler.toml`, `.gitignore` (add `dist/`, `dist-server/`, `node_modules/` if not already present)

**Interfaces:** None new — deployment configuration only.

- [ ] **Step 1: Update `wrangler.toml`**

```toml
name = "vyphir-directory"
pages_build_output_dir = "dist/client"
compatibility_date = "2026-07-28"
```

- [ ] **Step 2: Update `.gitignore`**

```bash
grep -qxF 'dist/' .gitignore || echo 'dist/' >> .gitignore
grep -qxF 'dist-server/' .gitignore || echo 'dist-server/' >> .gitignore
grep -qxF 'node_modules/' .gitignore || echo 'node_modules/' >> .gitignore
```

- [ ] **Step 3: Review `_redirects` for any rule referencing now-deleted paths** (`/templates/*` — `templates/` directory is now fully empty/deleted by Task 9; decide whether to drop that rule or leave it as a no-op safety net; leaving it is harmless and requires no code change, so leave it unless it now causes a test failure)

```bash
ls templates/ 2>/dev/null
```

If empty or missing, no action needed — `_redirects` rules for nonexistent paths are inert.

- [ ] **Step 4: Full local production-mode verification**

```bash
npm run build
npx wrangler pages dev dist/client
```

Manually click through every route listed in the spec's rollout checklist (`/`, `/gallery/`, at least 2 character pages, `/commissions/`, `/tos/`, `/queue/`, `/admin/`) in a real browser at the `wrangler pages dev` URL.

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml .gitignore
git commit -m "chore: point Cloudflare Pages build output at dist/client"
```

---

## Task 18: Full parity verification (spec rollout checklist)

**Files:** None modified — verification only, per the spec's "Rollout / parity checkpoint" section.

- [ ] **Step 1: Run the full test suite one final time**

```bash
npm test
```

Expected: all tests green (this now includes every test file created/modified across Tasks 1-17).

- [ ] **Step 2: Verify every route's content/forms/links against production, side-by-side**

Deploy to a Cloudflare Pages preview branch (or run `npx wrangler pages dev dist/client` locally against production `vyphir.com` in a second tab) and manually confirm, for each of `/`, `/gallery/`, 2-3 individual character pages, `/commissions/`, `/tos/`, `/queue/`, `/admin/`:
- Visual appearance matches (same `styles.css`, same layout, no missing sections).
- Every link/button present and pointing to the same target.
- Starfield background renders.

- [ ] **Step 3: Verify all `POST /api/publish-*` flows end-to-end** through the new React admin forms (this repeats Tasks 12-15's per-section manual checks as one final combined pass): add character, edit character, delete character, save commission info with a new tier image, add/reorder/edit/delete past work, save TOS with a reorder, add/edit/save queue.

- [ ] **Step 4: Verify Discord/Twitter unfurls are unchanged** — paste the live commissions page URL and a character page URL into a Discord channel (or use a link-preview debugger) and confirm the OG image/description/title render as they did before this migration. This is the specific regression class flagged throughout the spec (2026-08-20 incident) — do not skip.

- [ ] **Step 5: Confirm the starfield survives the hydration boundary** — load a page with JS initially disabled/throttled (or check the SSR HTML directly) to confirm the `<canvas id="webgl-canvas">` markup is present pre-hydration, then confirm animation starts after hydration completes.

- [ ] **Step 6: Record completion** — no code change in this task; once every check above passes, this sub-project (Foundation) is complete and ready for sub-project 2 (design system) to build on top of it.
