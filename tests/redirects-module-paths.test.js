import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function toRootPath(diskPath) {
    return '/' + relative(projectRoot, diskPath).split(sep).join('/');
}

function readRedirectRules() {
    const content = readFileSync(join(projectRoot, '_redirects'), 'utf8');
    const prefixes = [];
    const exact = [];
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const source = trimmed.split(/\s+/)[0];
        if (source.endsWith('/*')) {
            prefixes.push(source.slice(0, -1));
        } else {
            exact.push(source);
        }
    }
    return { prefixes, exact };
}

function findAllHtmlFiles() {
    const htmlFiles = [];
    function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.html')) htmlFiles.push(full);
        }
    }
    walk(projectRoot);
    return htmlFiles;
}

function findEntryModules() {
    const entries = new Set();
    for (const file of findAllHtmlFiles()) {
        const html = readFileSync(file, 'utf8');
        const htmlRootDir = posix.dirname(toRootPath(file));
        for (const match of html.matchAll(/<script type="module" src="([^"]+)"/g)) {
            const src = match[1];
            const rootPath = src.startsWith('/') ? src : posix.normalize(posix.join(htmlRootDir, src));
            entries.add(rootPath);
        }
    }
    // functions/i/[id].js server-renders a page (not a static .html file, so the
    // scan above can't see it) that loads this module — add it explicitly.
    entries.add('/gallery/permalink.js');
    // router.js reaches these via dynamic import(route.module) with a variable
    // argument, which this regex-based static scan can't follow — add them explicitly.
    entries.add('/script.js');
    entries.add('/gallery/gallery-index.js');
    entries.add('/gallery/character.js');
    entries.add('/commissions/commissions.js');
    entries.add('/tos/tos.js');
    return [...entries];
}

function collectReachableModules(entryPaths) {
    const visited = new Set();
    const queue = [...entryPaths];
    while (queue.length > 0) {
        const rootPath = queue.pop();
        if (visited.has(rootPath)) continue;
        visited.add(rootPath);

        const diskPath = join(projectRoot, rootPath);
        if (!existsSync(diskPath)) continue;
        const source = readFileSync(diskPath, 'utf8');
        for (const match of source.matchAll(/import\s+[^'"]*from\s+['"](\.[^'"]+)['"]/g)) {
            const importerDir = posix.dirname(rootPath);
            queue.push(posix.normalize(posix.join(importerDir, match[1])));
        }
    }
    return [...visited];
}

test('no browser-loaded module path is shadowed by a _redirects rule', () => {
    const { prefixes, exact } = readRedirectRules();
    const reachable = collectReachableModules(findEntryModules());

    for (const modulePath of reachable) {
        const shadow = prefixes.find((prefix) => modulePath.startsWith(prefix))
            ?? (exact.includes(modulePath) ? modulePath : undefined);
        assert.equal(
            shadow,
            undefined,
            `${modulePath} is reachable from a <script type="module"> entry point but is shadowed by a _redirects rule matching "${shadow}"`
        );
    }
});
