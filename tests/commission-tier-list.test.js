import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import CommissionTierList from '../src/components/CommissionTierList.jsx';

const TIERS = [
    { name: 'Lined Headshots', price: '€10+', description: 'Line one\nLine two', example: 'https://example.com/a.png' },
    { name: 'Flat Colour Headshots', price: '€15+', description: 'Flat colour', example: '' },
];

const html = renderToStaticMarkup(<CommissionTierList tiers={TIERS} />);

test('renders a keyboard-scrollable, labelled strip', () => {
    assert.match(html, /<div class="tiers__strip" role="region" aria-label="Commission tiers" tabindex="0">/);
});

test('renders one article per tier with an h2 name', () => {
    assert.equal((html.match(/<article class="tier">/g) || []).length, 2);
    assert.match(html, /<h2 class="tier__name">Lined Headshots<\/h2>/);
});

test('renders the price blob, the description and the example image', () => {
    assert.match(html, /<p class="tier__price">€10\+<\/p>/);
    assert.match(html, /<p class="tier__description">Line one\nLine two<\/p>/);
    assert.match(html, /<img class="tier__image" src="https:\/\/example.com\/a.png" alt="Lined Headshots" loading="lazy"\/?>/);
    assert.equal((html.match(/tier__image/g) || []).length, 1);
});

test('renders the swipe hint and dots only once overflow is measured in the browser', () => {
    assert.doesNotMatch(html, /tiers__hint|tiers--overflowing|tiers__strip--nudge/);
});

test('renders nothing for an empty tier list', () => {
    assert.equal(renderToStaticMarkup(<CommissionTierList tiers={[]} />), '');
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
