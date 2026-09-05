import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Tos from '../src/pages/Tos.jsx';

const html = renderToStaticMarkup(<Tos />);

test('renders the Terms of Service heading', () => {
    assert.match(html, /<h1>.*Terms of Service<\/h1>/);
});

test('renders the wide datapad wrapper variant', () => {
    assert.match(html, /class="datapad-wrapper datapad-wrapper--wide"/);
});

test('renders a back-link to the directory', () => {
    assert.match(html, /<a href="\/" class="back-link">/);
});

test('renders the tos points mount point server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="tos-points"/);
});
