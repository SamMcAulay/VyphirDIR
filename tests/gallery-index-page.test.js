import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Gallery from '../src/pages/Gallery.jsx';

const html = renderToStaticMarkup(<Gallery />);

test('renders the Character Gallery heading', () => {
    assert.match(html, /<h1>.*Character Gallery<\/h1>/);
});

test('renders the wide datapad wrapper variant', () => {
    assert.match(html, /class="datapad-wrapper datapad-wrapper--wide"/);
});

test('renders a back-link to the directory', () => {
    assert.match(html, /<a href="\/" class="back-link">/);
});

test('renders the gallery index grid mount point server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="gallery-index"/);
});
