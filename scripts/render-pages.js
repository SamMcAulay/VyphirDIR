import { readFile, writeFile, mkdir, cp, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../shared/escape-html.js';
import { generateCommissionsPreviewImage } from './generate-commissions-preview-image.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_OUT = join(projectRoot, 'dist', 'client');

const SITE_ORIGIN = 'https://vyphir.com';
const FAVICON = `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐱</text></svg>">`;

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

function renderShell({ path, title, description, ogImage, ogImageType, robotsNoIndex, csp, extraStylesheets, embeddedData, appHtml, script, css }) {
    const ogTags = description
        ? `
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtml(SITE_ORIGIN + path)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">${ogImage ? `
    <meta property="og:image" content="${escapeHtml(ogImage)}">${ogImageType ? `
    <meta property="og:image:type" content="${escapeHtml(ogImageType)}">` : ''}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ''}`
        : '';

    const effectiveCsp = csp || CSP;
    const allowsFontAwesome = effectiveCsp.includes('cdnjs.cloudflare.com');
    const rootAttrs = embeddedData ? ` data-character="${escapeHtml(JSON.stringify(embeddedData))}"` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">${robotsNoIndex ? '\n    <meta name="robots" content="noindex, nofollow">' : ''}${ogTags}
    <meta http-equiv="Content-Security-Policy" content="${effectiveCsp}">
    <title>${escapeHtml(title)}</title>
    ${FAVICON}
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">${allowsFontAwesome ? `
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer">` : ''}
    <link rel="stylesheet" href="/styles.css">${css.map((href) => `\n    <link rel="stylesheet" href="${href}">`).join('')}${(extraStylesheets || []).map((href) => `\n    <link rel="stylesheet" href="${href}">`).join('')}
</head>
<body>
    <div id="root"${rootAttrs}>${appHtml}</div>
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

async function renderCharacters({ script, css }) {
    const raw = await readFile(join(projectRoot, 'data', 'characters.json'), 'utf8');
    const { characters } = JSON.parse(raw);
    const { renderCharacter } = await import(join(projectRoot, 'dist-server', 'entry-server.js'));

    for (const character of characters) {
        const { html } = renderCharacter(character);
        const route = {
            path: `/gallery/${character.slug}/`,
            title: `${character.name} | Vyphir`,
            embeddedData: character,
        };
        await writeRoute({ route, html, script, css });
    }
}

// Vite only copies `public/` into the client build. These live outside it but are
// fetched at runtime by the deployed site, so they must be copied in explicitly.
async function copyRuntimeAssets() {
    await cp(join(projectRoot, 'data'), join(CLIENT_OUT, 'data'), { recursive: true });

    await copyFile(join(projectRoot, 'nsfw-reveal.js'), join(CLIENT_OUT, 'nsfw-reveal.js'));

    await mkdir(join(CLIENT_OUT, 'gallery'), { recursive: true });
    await copyFile(join(projectRoot, 'gallery', 'permalink.js'), join(CLIENT_OUT, 'gallery', 'permalink.js'));
}

async function main() {
    await copyRuntimeAssets();

    const manifest = await loadManifest();
    const { script, css } = entryAssets(manifest);
    const { render, routes } = await import(join(projectRoot, 'dist-server', 'entry-server.js'));

    await mkdir(join(CLIENT_OUT, 'commissions'), { recursive: true });
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

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}

export { renderShell, writeRoute };
