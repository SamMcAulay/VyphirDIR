import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Commissions from '../src/pages/Commissions.jsx';

const html = renderToStaticMarkup(<Commissions />);

test('renders the wide datapad wrapper variant', () => {
    assert.match(html, /class="datapad-wrapper datapad-wrapper--wide"/);
});

test('renders a back-link to the directory', () => {
    assert.match(html, /<a href="\/" class="back-link">/);
});

test('renders the Commissions heading', () => {
    assert.match(html, /<h1>.*Commissions<\/h1>/);
});

test('renders the Queue and Terms of Service nav links', () => {
    assert.match(html, /href="\/queue"[^>]*>.*Queue/);
    assert.match(html, /href="\/tos"[^>]*>.*Terms of Service/);
});

test('does not render the data-dependent sections server-side (populated client-side via fetch)', () => {
    assert.doesNotMatch(html, /section-title/);
    assert.doesNotMatch(html, /commission-status/);
});
