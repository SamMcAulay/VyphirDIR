import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import WaveText from '../src/components/WaveText.jsx';

test('splits text into one span per character', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi!" />);
    const matches = html.match(/class="wave-text-letter"/g) || [];
    assert.equal(matches.length, 3);
});

test('renders spaces as non-breaking spaces so they do not collapse', () => {
    const html = renderToStaticMarkup(<WaveText text="a b" />);
    assert.match(html, / /);
});

test('renders with the given tag name', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi" as="h1" />);
    assert.match(html, /^<h1 class="wave-text" aria-label="Hi">/);
    assert.match(html, /<\/h1>$/);
});

test('defaults to a span wrapper', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi" />);
    assert.match(html, /^<span class="wave-text" aria-label="Hi">/);
});

test('marks letter spans as aria-hidden', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi" />);
    assert.match(html, /class="wave-text-letter" style="[^"]*" aria-hidden="true"/);
});

test('exposes the full string via aria-label for multi-word text', () => {
    const html = renderToStaticMarkup(<WaveText text="a b" />);
    assert.match(html, /aria-label="a b"/);
});

test('appends an extra className', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi" className="section-title" />);
    assert.match(html, /class="wave-text section-title"/);
});
