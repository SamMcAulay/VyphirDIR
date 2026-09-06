import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Queue from '../src/pages/Queue.jsx';

const html = renderToStaticMarkup(<Queue />);

test('renders the Commission Queue heading with WaveText letter-wave markup', () => {
    assert.match(html, /<h1 class="wave-text">.*<span class="wave-text-letter"/s);
});

test('renders the page-tabby with xwide panel', () => {
    assert.match(html, /class="page-tabby"/);
    assert.match(html, /class="panel-wrapper panel--xwide"/);
});

test('renders a back-link to the directory', () => {
    assert.match(html, /<a href="\/" class="back-link">/);
});

test('renders the queue board mount point server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="queue-board"/);
});
