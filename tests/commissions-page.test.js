import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Commissions from '../src/pages/Commissions.jsx';

const html = renderToStaticMarkup(<Commissions />);

test('wraps the page in the honey page shell and wide Panel', () => {
    assert.match(html, /<div class="page-honey">/);
    assert.match(html, /<div class="panel-wrapper panel--wide"><div class="panel">/);
});

test('renders a back-link to the directory', () => {
    assert.match(html, /<a href="\/" class="back-link">/);
});

test('renders the Commissions heading with WaveText letter-wave markup', () => {
    assert.match(html, /<h1 class="wave-text" aria-label="[^"]*">.*<span class="wave-text-letter"/s);
});

test('renders the Queue and Terms of Service nav links', () => {
    assert.match(html, /href="\/queue"[^>]*>.*Queue/);
    assert.match(html, /href="\/tos"[^>]*>.*Terms of Service/);
});

test('does not render the data-dependent sections server-side (populated client-side via fetch)', () => {
    assert.doesNotMatch(html, /section-title/);
    assert.doesNotMatch(html, /commission-status/);
});
