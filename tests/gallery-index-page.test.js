import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Gallery from '../src/pages/Gallery.jsx';

const html = renderToStaticMarkup(<Gallery />);

test('wraps the page in the teal page frame', () => {
    assert.match(html, /^<div class="page-teal page-frame">/);
});

test('keeps a visually hidden page heading', () => {
    assert.match(html, /<h1 class="sr-only">Character Gallery<\/h1>/);
});

test('renders no panel, back link or visible title', () => {
    assert.doesNotMatch(html, /panel-wrapper|back-link|wave-text/);
});
