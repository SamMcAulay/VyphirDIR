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
