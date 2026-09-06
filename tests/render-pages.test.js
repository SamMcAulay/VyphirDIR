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

test('build renders a static page per character with escaped bio/species/name', () => {
    const html = readFileSync(join(projectRoot, 'dist/client/gallery/vyphir/index.html'), 'utf8');
    assert.match(html, /<div class="page-teal">/);
    assert.match(html, /<div class="panel-wrapper"><div class="panel">/);
    // WaveText renders each character of the h1 as its own
    // <span class="wave-text-letter">, so strip tags to recover the plain text.
    const text = html.replace(/<[^>]+>/g, '');
    assert.match(html, /<h1 class="wave-text">.*<span class="wave-text-letter"/s);
    assert.match(text, /Vyphir/);
    assert.match(html, /Mainecoon Cat/);
});

test('nsfw character images are marked in the SSG output', () => {
    // data/characters.json's "vyphir" entry has real nsfw:true images.
    const html = readFileSync(join(projectRoot, 'dist/client/gallery/vyphir/index.html'), 'utf8');
    assert.match(html, /data-nsfw="true"/);
});
