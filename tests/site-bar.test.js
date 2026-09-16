import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import SiteBar from '../src/site/SiteBar.jsx';
import SiteLayout from '../src/site/SiteLayout.jsx';
import { PHOTO_URL } from '../src/site/photo.js';

function renderBarAt(path) {
    return renderToStaticMarkup(
        <StaticRouter location={path}>
            <SiteBar />
        </StaticRouter>
    );
}

test('renders one bead link per section', () => {
    const html = renderBarAt('/gallery/');
    assert.equal((html.match(/<a class="site-bead site-bead--/g) || []).length, 4);
    for (const href of ['/gallery/', '/commissions/', '/queue/', '/tos/']) {
        assert.match(html, new RegExp(`href="${href}"`));
    }
});

test('marks exactly the current section with aria-current and is-active', () => {
    const html = renderBarAt('/queue/');
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.match(html, /<a class="site-bead site-bead--tabby pop-clickable is-active" href="\/queue\/" aria-label="Queue" aria-current="page">/);
});

test('highlights Gallery on a character page', () => {
    const html = renderBarAt('/gallery/vyphir/');
    assert.match(html, /href="\/gallery\/" aria-label="Gallery" aria-current="page"/);
});

test('tints the ribbon with the current section colour', () => {
    assert.match(renderBarAt('/commissions/'), /<header class="site-bar site-bar--honey">/);
    assert.match(renderBarAt('/tos/'), /<header class="site-bar site-bar--lavender">/);
});

test('falls back to teal with nothing active outside the sections', () => {
    const html = renderBarAt('/');
    assert.match(html, /<header class="site-bar site-bar--teal">/);
    assert.doesNotMatch(html, /aria-current/);
});

test('gives Terms its full accessible name and both visible labels', () => {
    const html = renderBarAt('/gallery/');
    assert.match(html, /href="\/tos\/" aria-label="Terms of Service"/);
    assert.match(html, /site-bead__label--short" aria-hidden="true">Comms<\/span>/);
});

test('links the photo home', () => {
    const html = renderBarAt('/gallery/');
    assert.match(html, /<a class="site-bar__photo" href="\/" aria-label="Home"><img src="[^"]+" alt=""\/?><\/a>/);
    assert.ok(html.includes(PHOTO_URL.replace(/&/g, '&amp;')));
});

test('names the nav landmark', () => {
    assert.match(renderBarAt('/gallery/'), /<nav class="site-bar__nav" aria-label="Site">/);
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(renderBarAt('/gallery/vyphir/'), /style=/);
});

test('SiteLayout renders the bar and wraps children in main.site-page', () => {
    const html = renderToStaticMarkup(
        <StaticRouter location="/queue/">
            <SiteLayout><p>child</p></SiteLayout>
        </StaticRouter>
    );
    assert.match(html, /<div class="site">.*<header class="site-bar site-bar--tabby">.*<main class="site-page"><p>child<\/p><\/main><\/div>/s);
});
