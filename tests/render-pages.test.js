import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readBuiltPage(path) {
    const relativeDir = path === '/' ? '' : path.replace(/^\//, '');
    return readFileSync(join(projectRoot, 'dist/client', relativeDir, 'index.html'), 'utf8');
}

test('build produces a static index.html that contains the hydrated root markup', () => {
    execSync('npm run build:client && npm run build:server', { cwd: projectRoot, stdio: 'inherit' });
    execSync('node scripts/render-pages.js', { cwd: projectRoot, stdio: 'inherit' });

    const outPath = join(projectRoot, 'dist/client/index.html');
    assert.ok(existsSync(outPath), 'dist/client/index.html should exist after build');
    const html = readFileSync(outPath, 'utf8');
    // Assert on markup the hub actually owns. The previous check looked for
    // "Sam" inside #root, which matched the old profile card's name text; the
    // only "Sam" left on this page is inside the samisaderp social hrefs, so
    // it no longer meant what it read as.
    assert.match(html, /<div id="root"[^>]*>.*<nav class="hub-nav">.*<\/div>/s);
    assert.match(html, /<a class="hub-photo" href="\/" aria-label="Home">/);
    assert.match(html, /<script type="module" src="\/assets\/entry-client[^"]*\.js">/);
});

test('build renders a static page per character with escaped bio/species/name', () => {
    const html = readFileSync(join(projectRoot, 'dist/client/gallery/vyphir/index.html'), 'utf8');
    assert.match(html, /<div class="page-teal">/);
    assert.match(html, /<div class="panel-wrapper"><div class="panel">/);
    // WaveText renders each character of the h1 as its own
    // <span class="wave-text-letter">, so strip tags to recover the plain text.
    const text = html.replace(/<[^>]+>/g, '');
    assert.match(html, /<h1 class="wave-text" aria-label="[^"]*">.*<span class="wave-text-letter"/s);
    assert.match(text, /Vyphir/);
    assert.match(html, /Mainecoon Cat/);
    // The character page's back-link goes to the gallery index, not '/':
    // the landing hub no longer lists any characters.
    assert.match(html, /<a href="\/gallery\/" class="back-link">/);
});

test('nsfw character images are marked in the SSG output', () => {
    // data/characters.json's "vyphir" entry has real nsfw:true images.
    const html = readFileSync(join(projectRoot, 'dist/client/gallery/vyphir/index.html'), 'utf8');
    assert.match(html, /data-nsfw="true"/);
});

test('the landing page embeds preview data on #root', () => {
    const html = readBuiltPage('/');
    assert.match(html, /<div id="root" data-previews="/);
});

test('the landing page bakes in preview image urls', () => {
    const html = readBuiltPage('/');
    assert.match(html, /res\.cloudinary\.com/);
});

test('no other routable page carries preview data', () => {
    for (const path of ['/gallery/', '/commissions/', '/tos/', '/queue/']) {
        assert.doesNotMatch(readBuiltPage(path), /data-previews=/);
    }
});

/*
 * Spec section 7, bullet 4: an end-to-end guard that the built front page is
 * NSFW-free. shared/landing-previews.js is unit-tested in
 * tests/landing-previews.test.js, but nothing there proves the filter
 * survived the build -- this reads the same source data the SSG reads and
 * asserts every nsfw:true URL is absent from dist/client/index.html.
 */
function nsfwUrlsFromSourceData() {
    const characters = JSON.parse(readFileSync(join(projectRoot, 'data/characters.json'), 'utf8'));
    const commissions = JSON.parse(readFileSync(join(projectRoot, 'data/commissions.json'), 'utf8'));
    const urls = new Set();
    for (const character of characters.characters || []) {
        for (const image of character.images || []) {
            if (image?.nsfw && image?.url) urls.add(image.url);
        }
    }
    for (const item of commissions.pastWork || []) {
        if (item?.nsfw && item?.url) urls.add(item.url);
    }
    return [...urls];
}

test('the built landing page contains no nsfw-flagged image url', () => {
    const html = readBuiltPage('/');
    const nsfwUrls = nsfwUrlsFromSourceData();
    assert.ok(nsfwUrls.length > 0, 'fixture data must contain at least one nsfw entry for this to mean anything');
    for (const url of nsfwUrls) {
        assert.doesNotMatch(html, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

/*
 * The CSP served with every page is `style-src 'self'` with no
 * 'unsafe-inline' and no style-src-attr, so the browser silently discards
 * inline style attributes -- they are dead weight that looks like working
 * code. This has already caused two real bugs: the landing hub's item
 * geometry, and WaveText's per-letter animation delay. Both moved into
 * public/styles.css. Admin is excluded: it is a separate, unmigrated
 * surface outside this stylesheet's scope.
 */
test('no built page carries an inline style attribute the CSP would drop', () => {
    const pages = [
        '/', '/gallery/', '/commissions/', '/tos/', '/queue/',
        '/gallery/vyphir/', '/gallery/pharron/',
    ];
    for (const path of pages) {
        const html = readBuiltPage(path);
        const offenders = html.match(/\sstyle="[^"]*"/g) || [];
        assert.deepEqual(offenders, [], `${path} carries inline style attributes: ${offenders.join(', ')}`);
    }
});
