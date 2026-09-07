import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Tos from '../src/pages/Tos.jsx';

const html = renderToStaticMarkup(<Tos />);

test('renders the Terms of Service heading', () => {
    assert.match(html, /<h1 class="wave-text" aria-label="[^"]*"><span class="wave-text-letter"[^>]*>T<\/span>/);
    assert.match(html, /wave-text-letter.*e.*r.*m.*s/s);
});

test('renders the page-lavender container', () => {
    assert.match(html, /class="page-lavender"/);
});

test('renders a wide panel', () => {
    assert.match(html, /class="panel-wrapper panel--wide"/);
});

test('renders a back-link to the directory', () => {
    assert.match(html, /<a href="\/" class="back-link">/);
});

test('renders the tos points mount point server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="tos-points"/);
});
