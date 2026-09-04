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
    const { render, routes } = await import(join(projectRoot, 'dist-server', 'entry-server.js'));

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
