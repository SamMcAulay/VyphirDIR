import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Gallery from '../src/pages/Gallery.jsx';

const html = renderToStaticMarkup(<Gallery />);

// WaveText renders each character of a heading as its own
// <span class="wave-text-letter">, splitting words like "Character Gallery"
// across tags. Stripping tags recovers the plain-text content so headings and
// copy can still be asserted on as whole strings.
const text = html.replace(/<[^>]+>/g, '');

test('renders the Character Gallery heading with WaveText letter-wave markup', () => {
    assert.match(html, /<h1 class="wave-text">.*<span class="wave-text-letter"/s);
    assert.match(text, /Character\sGallery/);
});

test('wraps the page in the teal page shell and Panel', () => {
    assert.match(html, /<div class="page-teal">/);
    assert.match(html, /<div class="panel-wrapper panel--wide"><div class="panel">/);
});

test('renders a back-link to the directory', () => {
    assert.match(html, /<a href="\/" class="back-link">/);
});

test('renders the gallery index grid mount point server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="gallery-index"/);
});
