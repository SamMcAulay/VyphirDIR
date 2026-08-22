import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute } from '../shared/route-table.js';

test('matchRoute matches the home page', () => {
    assert.deepEqual(matchRoute('/'), { module: '/script.js' });
});

test('matchRoute matches the gallery index', () => {
    assert.deepEqual(matchRoute('/gallery/'), { module: '/gallery/gallery-index.js' });
});

test('matchRoute matches a character page', () => {
    assert.deepEqual(matchRoute('/gallery/vyphir/'), { module: '/gallery/character.js' });
    assert.deepEqual(matchRoute('/gallery/sir-reginald-fluffington/'), { module: '/gallery/character.js' });
});

test('matchRoute matches the commissions page', () => {
    assert.deepEqual(matchRoute('/commissions/'), { module: '/commissions/commissions.js' });
});

test('matchRoute matches the tos page', () => {
    assert.deepEqual(matchRoute('/tos/'), { module: '/tos/tos.js' });
});

test('matchRoute rejects the admin area', () => {
    assert.equal(matchRoute('/admin/'), null);
    assert.equal(matchRoute('/admin/index.html'), null);
});

test('matchRoute rejects permalink pages', () => {
    assert.equal(matchRoute('/i/abc123'), null);
});

test('matchRoute rejects paths missing a trailing slash', () => {
    assert.equal(matchRoute('/gallery'), null);
    assert.equal(matchRoute('/gallery/vyphir'), null);
    assert.equal(matchRoute('/commissions'), null);
    assert.equal(matchRoute('/tos'), null);
});

test('matchRoute rejects an empty character slug', () => {
    assert.equal(matchRoute('/gallery//'), null);
});

test('matchRoute rejects unknown paths', () => {
    assert.equal(matchRoute('/nonexistent/'), null);
    assert.equal(matchRoute(''), null);
});
