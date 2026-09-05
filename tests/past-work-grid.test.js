import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import PastWorkGrid from '../src/components/PastWorkGrid.jsx';

const items = [
    { url: 'https://example.com/a.jpg', caption: 'A caption', nsfw: false },
    { url: 'https://example.com/b.jpg', caption: '', nsfw: false, giftArt: true },
];

const html = renderToStaticMarkup(<PastWorkGrid items={items} />);

test('renders the commission-past-work grid mount point id', () => {
    assert.match(html, /id="commission-past-work"/);
});

test('renders a past-work-card for each item', () => {
    assert.equal((html.match(/class="past-work-card"/g) || []).length, 2);
});

test('renders the caption paragraph when present', () => {
    assert.match(html, /<p>A caption<\/p>/);
});
