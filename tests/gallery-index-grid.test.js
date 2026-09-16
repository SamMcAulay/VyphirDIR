import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { GalleryTiles } from '../src/components/GalleryIndexGrid.jsx';

const CHARACTERS = [
    {
        slug: 'vyphir',
        name: 'Vyphir',
        bio: '20yo | She/Her | Female\nSecond line',
        images: [{ url: 'https://example.com/a.png' }, { url: 'https://example.com/cover.png', thumbnail: true }],
    },
    { slug: 'blair', name: 'Blair', bio: '19 | she/her', images: [{ url: 'https://example.com/n.png', nsfw: true }] },
];

const html = renderToStaticMarkup(<GalleryTiles characters={CHARACTERS} />);

test('renders one tile per character in a list', () => {
    assert.match(html, /^<ul class="gallery-grid">/);
    assert.equal((html.match(/<a class="gallery-tile /g) || []).length, 2);
});

test('links each tile to its character page and names it', () => {
    assert.match(html, /<a class="gallery-tile pop-clickable" href="\/gallery\/vyphir\/" aria-label="Vyphir">/);
    assert.match(html, /href="\/gallery\/blair\/" aria-label="Blair"/);
});

test('uses the cover image and only the first bio line', () => {
    assert.match(html, /<img class="gallery-tile__image" src="https:\/\/example.com\/cover.png" alt="" loading="lazy"\/?>/);
    assert.match(html, /<span class="gallery-tile__bio">20yo \| She\/Her \| Female<\/span>/);
    assert.doesNotMatch(html, /Second line/);
});

test('renders a tile without an image when a character has no safe image', () => {
    const blair = html.slice(html.indexOf('href="/gallery/blair/"'));
    assert.doesNotMatch(blair, /<img/);
});

test('renders the name with wave markup', () => {
    assert.match(html, /<span class="wave-text gallery-tile__name" aria-label="Vyphir">/);
});

test('shows a plain message when there are no characters', () => {
    assert.equal(renderToStaticMarkup(<GalleryTiles characters={[]} />), '<p class="page-message">No characters here yet.</p>');
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
