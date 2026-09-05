import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Queue from '../src/pages/Queue.jsx';

const html = renderToStaticMarkup(<Queue />);

test('renders the Commission Queue heading', () => {
    assert.match(html, /<h1>.*Commission Queue<\/h1>/);
});

test('renders the xwide datapad wrapper variant', () => {
    assert.match(html, /class="datapad-wrapper datapad-wrapper--xwide"/);
});

test('renders a back-link to the directory', () => {
    assert.match(html, /<a href="\/" class="back-link">/);
});

test('renders the queue board mount point server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="queue-board"/);
});
