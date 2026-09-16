import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTIONS, sectionForPath, usesSiteLayout, sectionByKey } from '../src/site/sections.js';
import { routes } from '../src/routes.js';

test('lists the four sections in bar order with their colours and blobs', () => {
    assert.deepEqual(
        SECTIONS.map((s) => [s.key, s.href, s.colour, s.blob]),
        [
            ['gallery', '/gallery/', 'teal', 1],
            ['commissions', '/commissions/', 'honey', 3],
            ['queue', '/queue/', 'tabby', 2],
            ['tos', '/tos/', 'lavender', 4],
        ]
    );
});

test('carries a visible label, a phone label and an accessible name', () => {
    const commissions = sectionByKey('commissions');
    assert.equal(commissions.label, 'Commissions');
    assert.equal(commissions.shortLabel, 'Comms');
    assert.equal(sectionByKey('tos').label, 'Terms');
    assert.equal(sectionByKey('tos').name, 'Terms of Service');
});

test('maps each section path to its key, with or without a trailing slash', () => {
    assert.equal(sectionForPath('/gallery/'), 'gallery');
    assert.equal(sectionForPath('/gallery'), 'gallery');
    assert.equal(sectionForPath('/commissions/'), 'commissions');
    assert.equal(sectionForPath('/queue'), 'queue');
    assert.equal(sectionForPath('/tos/'), 'tos');
});

test('treats a character page as part of the gallery section', () => {
    assert.equal(sectionForPath('/gallery/vyphir/'), 'gallery');
    assert.equal(sectionForPath('/gallery/vyphir'), 'gallery');
});

test('returns null for paths outside the site layout', () => {
    for (const path of ['/', '/admin/', '/i/abc-123', '/gallery/a/b/', '/nope/']) {
        assert.equal(sectionForPath(path), null, path);
        assert.equal(usesSiteLayout(path), false, path);
    }
});

test('usesSiteLayout is true for every section path and character pages', () => {
    for (const path of ['/gallery/', '/commissions/', '/queue/', '/tos/', '/gallery/pharron/']) {
        assert.equal(usesSiteLayout(path), true, path);
    }
});

test('sectionByKey returns null for an unknown or null key', () => {
    assert.equal(sectionByKey('nope'), null);
    assert.equal(sectionByKey(null), null);
});

test('the route table flags exactly the section paths for the site layout', () => {
    const flagged = routes.filter((route) => route.siteLayout).map((route) => route.path).sort();
    assert.deepEqual(flagged, SECTIONS.map((section) => section.href).sort());
});
