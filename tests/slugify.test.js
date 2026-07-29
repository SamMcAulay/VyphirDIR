import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, uniqueSlug } from '../shared/slugify.js';

test('slugify lowercases and hyphenates', () => {
    assert.equal(slugify('Drasil'), 'drasil');
    assert.equal(slugify('Sir Reginald Fluffington'), 'sir-reginald-fluffington');
});

test('slugify strips special characters', () => {
    assert.equal(slugify("D'ra'sil!!"), 'd-ra-sil');
    assert.equal(slugify('  spaced  '), 'spaced');
});

test('slugify falls back for empty/symbol-only names', () => {
    assert.equal(slugify(''), 'character');
    assert.equal(slugify('!!!'), 'character');
});

test('uniqueSlug returns the base slug when unused', () => {
    assert.equal(uniqueSlug('Vyphir', ['drasil', 'pharron']), 'vyphir');
});

test('uniqueSlug appends a counter on collision', () => {
    assert.equal(uniqueSlug('Vyphir', ['vyphir']), 'vyphir-2');
    assert.equal(uniqueSlug('Vyphir', ['vyphir', 'vyphir-2']), 'vyphir-3');
});

test('uniqueSlug handles repeated empty-name fallback collisions', () => {
    assert.equal(uniqueSlug('', ['character']), 'character-2');
});
