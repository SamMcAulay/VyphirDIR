import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import PastWorkGrid from '../src/components/PastWorkGrid.jsx';

const items = [
    { url: 'https://example.com/a.jpg', caption: 'A caption', nsfw: false },
    { url: 'https://example.com/b.jpg', caption: '', nsfw: false, giftArt: true },
    { url: 'https://example.com/c.jpg', caption: '', nsfw: true },
];

const html = renderToStaticMarkup(<PastWorkGrid items={items} />);

test('renders a square grid list with one item per piece', () => {
    assert.match(html, /^<ul class="square-grid past-work-grid">/);
    assert.equal((html.match(/<li>/g) || []).length, 3);
});

test('no longer displays captions', () => {
    assert.doesNotMatch(html, /<p>/);
});

test('keeps the caption as alt text, with the existing fallbacks', () => {
    assert.match(html, /alt="A caption"/);
    assert.match(html, /alt="Past gift art"/);
    assert.match(html, /alt="Past commission work"/);
});

test('keeps tap to reveal for NSFW pieces', () => {
    assert.match(html, /data-nsfw="true"/);
});
