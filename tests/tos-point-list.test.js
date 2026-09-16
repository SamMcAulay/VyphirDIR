import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { TosContent } from '../src/components/TosPointList.jsx';

const POINTS = [
    { title: 'Payments', body: 'Pay first\nThen wait', bullets: [{ type: 'plain', text: 'Up front' }] },
    {
        title: 'What I draw',
        body: 'Backgrounds extra',
        bullets: [{ type: 'yesno', text: 'Feral', value: true }, { type: 'yesno', text: 'Humans', value: false }],
    },
    { title: 'Refunds', body: 'Maybe' },
];

const html = renderToStaticMarkup(<TosContent points={POINTS} />);

test('renders a labelled index linking to every point', () => {
    assert.match(html, /<nav class="tos-index" aria-label="Terms">/);
    for (const [i, title] of [[1, 'Payments'], [2, 'What I draw'], [3, 'Refunds']]) {
        assert.match(html, new RegExp(`<a class="tos-index__link[^"]*" href="#tos-${i}"[^>]*><span class="tos-num" aria-hidden="true">${i}</span>${title}</a>`));
    }
});

test('marks the first point as current before any scrolling', () => {
    assert.match(html, /<a class="tos-index__link is-current" href="#tos-1" aria-current="true">/);
    assert.equal((html.match(/aria-current/g) || []).length, 1);
});

test('renders every point as a section with a matching id and h2', () => {
    for (const i of [1, 2, 3]) assert.match(html, new RegExp(`<section class="tos-point" id="tos-${i}">`));
    assert.match(html, /<h2 class="tos-point__title"><span class="tos-num" aria-hidden="true">1<\/span>Payments<\/h2>/);
    assert.match(html, /<p class="tos-point__body">Pay first\nThen wait<\/p>/);
});

test('pulls yes/no items into the draw panels and out of the points', () => {
    assert.match(html, /<section class="tos-draw__panel tos-draw__panel--will"><h2>Will draw<\/h2><ul><li>Feral<\/li><\/ul><\/section>/);
    assert.match(html, /<section class="tos-draw__panel tos-draw__panel--wont"><h2>Won&#x27;t draw<\/h2><ul><li>Humans<\/li><\/ul><\/section>/);
    assert.equal((html.match(/class="tos-point__bullets"/g) || []).length, 1);
});

test('omits the draw panels when there are no yes/no items', () => {
    const plain = renderToStaticMarkup(<TosContent points={[POINTS[0], POINTS[2]]} />);
    assert.doesNotMatch(plain, /tos-draw/);
});

test('omits a single empty draw panel', () => {
    const onlyYes = renderToStaticMarkup(
        <TosContent points={[{ title: 'Draw', bullets: [{ type: 'yesno', text: 'Feral', value: true }] }]} />
    );
    assert.match(onlyYes, /tos-draw__panel--will/);
    assert.doesNotMatch(onlyYes, /tos-draw__panel--wont/);
});

test('shows a plain message when there are no points', () => {
    assert.equal(renderToStaticMarkup(<TosContent points={[]} />), '<p class="page-message">No terms published yet.</p>');
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
