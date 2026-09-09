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
    assert.match(html, /class="wave-text-letter" aria-hidden="true"/);
});

/*
 * The site's CSP is `style-src 'self'` with no 'unsafe-inline' and no
 * style-src-attr, so the browser silently discards every inline style
 * attribute. WaveText used to carry each letter's index in one
 * (style="--i:3"), which meant `animation-delay: calc(var(--i) * .04s)`
 * was invalid at computed-value time and every letter fell back to 0s --
 * the heading bounced all at once instead of waving. The stagger now
 * lives in public/styles.css keyed by :nth-child(), so nothing here may
 * emit a style attribute again.
 */
test('emits no inline style attribute, which the CSP would silently drop', () => {
    const html = renderToStaticMarkup(<WaveText text="Hello there" as="h1" />);
    assert.doesNotMatch(html, /style=/);
});

test('exposes the full string via aria-label for multi-word text', () => {
    const html = renderToStaticMarkup(<WaveText text="a b" />);
    assert.match(html, /aria-label="a b"/);
});

test('appends an extra className', () => {
    const html = renderToStaticMarkup(<WaveText text="Hi" className="section-title" />);
    assert.match(html, /class="wave-text section-title"/);
});
