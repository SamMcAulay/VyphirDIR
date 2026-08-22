import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const ROUTABLE_TEMPLATES = [
    'index.html',
    'gallery/index.html',
    'templates/commissions.html',
    'templates/character.html',
    'tos/index.html',
];

function extractCsp(html) {
    const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
    return match ? match[1] : null;
}

function extractStylesheetHosts(html) {
    const hosts = new Set();
    for (const match of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
        const href = match[1];
        if (href.startsWith('http')) {
            hosts.add(new URL(href).host);
        }
    }
    return [...hosts].sort();
}

test('all routable page templates share an identical CSP', () => {
    const csps = ROUTABLE_TEMPLATES.map((path) => ({
        path,
        csp: extractCsp(readFileSync(join(projectRoot, path), 'utf8')),
    }));

    const [first, ...rest] = csps;
    for (const entry of rest) {
        assert.equal(
            entry.csp,
            first.csp,
            `${entry.path}'s CSP differs from ${first.path}'s — since router.js never reloads <head> on a client-side navigation, whichever page a visitor lands on first permanently governs CSP for the whole session, so every routable template must share an identical policy`
        );
    }
});

test('all routable page templates load the same external stylesheet hosts', () => {
    const hostSets = ROUTABLE_TEMPLATES.map((path) => ({
        path,
        hosts: extractStylesheetHosts(readFileSync(join(projectRoot, path), 'utf8')),
    }));

    const [first, ...rest] = hostSets;
    for (const entry of rest) {
        assert.deepEqual(
            entry.hosts,
            first.hosts,
            `${entry.path} loads different external stylesheets than ${first.path} — since <head> is never re-fetched on a client-side navigation, a stylesheet missing from one template (e.g. Font Awesome) will silently fail to render if a visitor's session started on a different page`
        );
    }
});
