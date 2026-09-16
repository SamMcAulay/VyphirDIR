import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionScope } from '../src/transitions/scope.js';
import { pageRoot } from '../src/transitions/collect-pieces.js';

test('navigation between two inner pages is page-scoped', () => {
    assert.equal(transitionScope('/gallery/', '/queue/'), 'page');
    assert.equal(transitionScope('/tos/', '/commissions/'), 'page');
});

test('gallery to character and back is page-scoped', () => {
    assert.equal(transitionScope('/gallery/', '/gallery/vyphir/'), 'page');
    assert.equal(transitionScope('/gallery/vyphir/', '/gallery/'), 'page');
    assert.equal(transitionScope('/gallery/vyphir/', '/gallery/pharron/'), 'page');
});

test('to or from the hub is document-scoped', () => {
    assert.equal(transitionScope('/gallery/', '/'), 'document');
    assert.equal(transitionScope('/', '/commissions/'), 'document');
});

test('anything involving admin is document-scoped', () => {
    assert.equal(transitionScope('/admin/', '/gallery/'), 'document');
    assert.equal(transitionScope('/queue/', '/admin/'), 'document');
});

const node = (tagName, children = []) => ({ tagName, children });

function withDocument(doc, run) {
    const original = globalThis.document;
    globalThis.document = doc;
    try {
        run();
    } finally {
        if (original === undefined) delete globalThis.document;
        else globalThis.document = original;
    }
}

test('document scope starts at the first rendered child of #root', () => {
    const layout = node('DIV');
    const root = node('DIV', [node('LINK'), layout]);
    withDocument({ getElementById: (id) => (id === 'root' ? root : null), querySelector: () => null }, () => {
        assert.equal(pageRoot('document'), layout);
        assert.equal(pageRoot(), layout);
    });
});

test('page scope starts at the first rendered child of main.site-page', () => {
    const page = node('DIV');
    const main = node('MAIN', [page]);
    const root = node('DIV', [node('DIV', [node('HEADER'), main])]);
    withDocument({
        getElementById: (id) => (id === 'root' ? root : null),
        querySelector: (selector) => (selector === 'main.site-page' ? main : null),
    }, () => {
        assert.equal(pageRoot('page'), page);
    });
});

test('page scope falls back to the document root when there is no site page', () => {
    const hub = node('DIV');
    const root = node('DIV', [hub]);
    withDocument({ getElementById: (id) => (id === 'root' ? root : null), querySelector: () => null }, () => {
        assert.equal(pageRoot('page'), hub);
    });
});
