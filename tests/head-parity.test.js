import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// Character pages go through the same renderShell() as the static routes, so they
// belong in the CSP/stylesheet parity comparison — a real prior incident was about
// exactly this page class drifting from the rest of the site.
const firstCharacterSlug = JSON.parse(
    readFileSync(join(projectRoot, 'data/characters.json'), 'utf8')
).characters[0].slug;

const ROUTABLE_PAGES = [
    'dist/client/index.html',
    'dist/client/gallery/index.html',
    'dist/client/commissions/index.html',
    'dist/client/tos/index.html',
    'dist/client/queue/index.html',
    `dist/client/gallery/${firstCharacterSlug}/index.html`,
];

const SITE_ORIGIN = 'https://vyphir.com';

function extractCsp(html) {
    const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    return match ? match[1] : null;
}

// Match the whole <link> tag first, then check rel/href independently: the built
// Google Fonts link emits href *before* rel, so an order-sensitive regex silently
// dropped that host from the comparison.
function extractStylesheetHosts(html) {
    const hosts = new Set();
    for (const [tag] of html.matchAll(/<link\b[^>]*>/g)) {
        if (!/\brel="stylesheet"/.test(tag)) continue;
        const href = tag.match(/\bhref="([^"]+)"/)?.[1];
        if (href && href.startsWith('http')) hosts.add(new URL(href).host);
    }
    return [...hosts].sort();
}

function extractMeta(html, property) {
    const attr = property.startsWith('og:') ? 'property' : 'name';
    const match = html.match(new RegExp(`<meta ${attr}="${property}" content="([^"]*)">`));
    return match ? match[1] : null;
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

test('share-card pages carry a complete, non-empty set of OG tags', () => {
    const OG_PAGES = [
        { path: 'dist/client/index.html', route: '/' },
        { path: 'dist/client/commissions/index.html', route: '/commissions/' },
    ];

    for (const { path, route } of OG_PAGES) {
        const html = readFileSync(join(projectRoot, path), 'utf8');
        for (const property of ['og:url', 'og:title', 'og:description', 'og:image']) {
            const content = extractMeta(html, property);
            assert.ok(content, `${path} is missing a <meta property="${property}"> tag`);
            assert.notEqual(content.trim(), '', `${path}'s ${property} is empty`);
        }
        assert.equal(extractMeta(html, 'og:url'), `${SITE_ORIGIN}${route}`, `${path} has the wrong og:url`);
    }
});

test('every routable built page declares a favicon', () => {
    for (const path of ROUTABLE_PAGES) {
        const html = readFileSync(join(projectRoot, path), 'utf8');
        assert.match(html, /<link rel="icon" href="data:image\/svg\+xml,/, `${path} is missing its favicon link`);
    }
});

test('the admin page intentionally uses a stricter CSP than public pages', () => {
    const adminCsp = extractCsp(readFileSync(join(projectRoot, 'dist/client/admin/index.html'), 'utf8'));
    const publicCsp = extractCsp(readFileSync(join(projectRoot, 'dist/client/index.html'), 'utf8'));
    assert.notEqual(adminCsp, publicCsp);
    assert.doesNotMatch(adminCsp, /cdnjs\.cloudflare\.com/);
});
