import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import GalleryCharacter from '../src/pages/GalleryCharacter.jsx';

const CHARACTER = {
    slug: 'vyphir',
    name: 'Vyphir',
    species: 'Mainecoon Cat',
    bio: '20yo | She/Her\nLoves art',
    images: [
        { url: 'https://example.com/first.png' },
        { url: 'https://example.com/cover.png', thumbnail: true },
        { url: 'https://example.com/spicy.png', nsfw: true },
    ],
};

const html = renderToStaticMarkup(<GalleryCharacter character={CHARACTER} />);

test('wraps the page in the teal page frame with no panel', () => {
    assert.match(html, /^<div class="page-teal page-frame">/);
    assert.doesNotMatch(html, /panel-wrapper/);
});

test('renders the name as the visible wave-text h1', () => {
    assert.match(html, /<h1 class="wave-text character-name" aria-label="Vyphir">/);
});

test('links back to all characters', () => {
    assert.match(html, /<a class="character-back" href="\/gallery\/">← All characters<\/a>/);
});

test('shows species and the full bio', () => {
    assert.match(html, /<p class="character-species">Mainecoon Cat<\/p>/);
    assert.match(html, /<p class="character-bio">20yo \| She\/Her\nLoves art<\/p>/);
});

test('leads with the cover image and leaves it out of the grid', () => {
    const top = html.slice(0, html.indexOf('character-grid'));
    const grid = html.slice(html.indexOf('character-grid'));
    assert.match(top, /class="char-image-wrap character-hero"/);
    assert.ok(top.includes('cover.png'));
    assert.ok(!grid.includes('cover.png'));
});

test('puts every other image, NSFW included, in the square grid', () => {
    assert.match(html, /<ul class="square-grid character-grid">/);
    const grid = html.slice(html.indexOf('character-grid'));
    assert.equal((grid.match(/<li>/g) || []).length, 2);
    assert.match(grid, /data-nsfw="true"/);
});

test('drops the feature image when there is no safe image', () => {
    const noSafe = renderToStaticMarkup(
        <GalleryCharacter character={{ ...CHARACTER, images: [{ url: 'https://example.com/n.png', nsfw: true }] }} />
    );
    assert.match(noSafe, /<section class="character-top character-top--no-image">/);
    assert.doesNotMatch(noSafe, /character-hero/);
});

test('renders no grid when the only image is the cover', () => {
    const one = renderToStaticMarkup(
        <GalleryCharacter character={{ ...CHARACTER, images: [{ url: 'https://example.com/only.png' }] }} />
    );
    assert.doesNotMatch(one, /character-grid/);
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
