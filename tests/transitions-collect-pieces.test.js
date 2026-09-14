import test from 'node:test';
import assert from 'node:assert/strict';
import { paints, collectPieces, firstRenderedChild } from '../src/transitions/collect-pieces.js';

const BLANK = {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    backgroundImage: 'none',
    borderTopWidth: '0px', borderRightWidth: '0px', borderBottomWidth: '0px', borderLeftWidth: '0px',
    borderTopStyle: 'none', borderRightStyle: 'none', borderBottomStyle: 'none', borderLeftStyle: 'none',
    boxShadow: 'none',
    outlineStyle: 'none', outlineWidth: '0px',
};

function el(tagName, children = [], style = {}, rect = { left: 0, top: 0, width: 100, height: 100 }) {
    return { tagName, children, _style: { ...BLANK, ...style }, _rect: rect };
}

function ctx(overrides = {}) {
    return {
        getStyle: (node) => node._style,
        getRect: (node) => node._rect,
        viewportWidth: 1000,
        viewportHeight: 800,
        ...overrides,
    };
}

test('paints is false for a bare wrapper', () => {
    assert.equal(paints(BLANK, 'DIV'), false);
});

test('paints is true for a background colour with alpha', () => {
    assert.equal(paints({ ...BLANK, backgroundColor: 'rgb(255, 246, 233)' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, backgroundColor: 'rgba(255, 246, 233, 0.5)' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, backgroundColor: 'rgba(255, 246, 233, 0)' }, 'DIV'), false);
});

test('paints is true for a border, a shadow, an outline or a background image', () => {
    assert.equal(paints({ ...BLANK, borderTopWidth: '3px', borderTopStyle: 'solid' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, borderTopWidth: '3px', borderTopStyle: 'none' }, 'DIV'), false);
    assert.equal(paints({ ...BLANK, boxShadow: '6px 6px 0 #000' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, outlineStyle: 'solid', outlineWidth: '2px' }, 'DIV'), true);
    assert.equal(paints({ ...BLANK, backgroundImage: 'url(a.png)' }, 'DIV'), true);
});

test('paints is always true for replaced and drawn elements, in either tag case', () => {
    for (const tag of ['IMG', 'SVG', 'CANVAS', 'VIDEO', 'svg']) {
        assert.equal(paints(BLANK, tag), true, tag);
    }
});

test('a childless element is a whole piece', () => {
    const root = el('DIV', [el('SPAN')]);
    const pieces = collectPieces(root, ctx());
    assert.equal(pieces.length, 1);
    assert.equal(pieces[0].mode, 'whole');
    assert.equal(pieces[0].el.tagName, 'SPAN');
});

test('a painting container yields a shell and its children separately', () => {
    const heading = el('H1');
    const image = el('IMG');
    const panel = el('DIV', [heading, image], { backgroundColor: 'rgb(255,255,255)' });
    const pieces = collectPieces(el('DIV', [panel]), ctx());
    assert.deepEqual(pieces.map((p) => [p.el.tagName, p.mode]), [
        ['DIV', 'shell'],
        ['H1', 'whole'],
        ['IMG', 'whole'],
    ]);
});

test('a non-painting wrapper contributes nothing and lets its children fall separately', () => {
    const wrapper = el('DIV', [el('A'), el('A'), el('A')]);
    const pieces = collectPieces(el('DIV', [wrapper]), ctx());
    assert.equal(pieces.length, 3);
    assert.ok(pieces.every((p) => p.el.tagName === 'A'));
});

test('the page root itself is a piece when it paints', () => {
    const root = el('DIV', [el('SPAN')], { backgroundColor: 'rgb(1,2,3)' });
    const pieces = collectPieces(root, ctx());
    assert.equal(pieces[0].el, root);
    assert.equal(pieces[0].mode, 'shell');
});

test('zero-area elements are dropped but still descended into', () => {
    const child = el('SPAN', [], {}, { left: 0, top: 0, width: 50, height: 50 });
    const empty = el('DIV', [child], { backgroundColor: 'rgb(1,2,3)' }, { left: 0, top: 0, width: 0, height: 0 });
    const pieces = collectPieces(el('DIV', [empty]), ctx());
    assert.deepEqual(pieces.map((p) => p.el.tagName), ['SPAN']);
});

test('elements entirely outside the viewport are dropped along with their subtree', () => {
    const offscreen = el('DIV', [el('SPAN')], {}, { left: 0, top: 2000, width: 100, height: 100 });
    const onscreen = el('SPAN', [], {}, { left: 0, top: 10, width: 100, height: 100 });
    const pieces = collectPieces(el('DIV', [offscreen, onscreen]), ctx());
    assert.deepEqual(pieces.map((p) => p.el.tagName), ['SPAN']);
    assert.equal(pieces[0].el, onscreen);
});

test('exceeding the ceiling re-walks shallower until the count fits', () => {
    // 10 wrappers, each holding 10 leaves: 100 leaves at full depth, 10 at depth 1.
    const wrappers = Array.from({ length: 10 }, () =>
        el('DIV', Array.from({ length: 10 }, () => el('SPAN')))
    );
    const root = el('DIV', wrappers);
    const deep = collectPieces(root, ctx({ maxPieces: 150 }));
    assert.equal(deep.length, 100);
    const shallow = collectPieces(root, ctx({ maxPieces: 50 }));
    assert.equal(shallow.length, 10);
    assert.ok(shallow.every((p) => p.mode === 'whole'));
});

test('the shallowest walk still returns the top-level children when nothing fits', () => {
    const root = el('DIV', Array.from({ length: 20 }, () => el('SPAN')));
    const pieces = collectPieces(root, ctx({ maxPieces: 5 }));
    assert.equal(pieces.length, 20);
});

/*
 * React 19 emits hoistable elements into the app's own subtree during SSR --
 * an <img src> on the landing hub produces a <link rel="preload" as="image">
 * as #root's first element child. Starting the walk there collects nothing,
 * so the fall silently never runs.
 */
test('firstRenderedChild skips hoisted elements that never render', () => {
    const page = { tagName: 'DIV', children: [] };
    const parent = { children: [{ tagName: 'LINK', children: [] }, page] };
    assert.equal(firstRenderedChild(parent), page);
});

test('firstRenderedChild returns the first child when it already renders', () => {
    const page = { tagName: 'DIV', children: [] };
    const parent = { children: [page, { tagName: 'SPAN', children: [] }] };
    assert.equal(firstRenderedChild(parent), page);
});

test('firstRenderedChild returns null when no child renders', () => {
    const parent = { children: [{ tagName: 'LINK', children: [] }, { tagName: 'SCRIPT', children: [] }] };
    assert.equal(firstRenderedChild(parent), null);
});
