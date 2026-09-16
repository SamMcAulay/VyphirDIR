import test from 'node:test';
import assert from 'node:assert/strict';
import { currentSection } from '../src/components/current-section.js';

const IDS = ['tos-1', 'tos-2', 'tos-3'];

test('at the bottom of the page, the last id is current', () => {
    assert.equal(currentSection(IDS, { visible: new Set(), atBottom: true }), 'tos-3');
});

test('a hash target wins over at-bottom', () => {
    assert.equal(currentSection(IDS, { visible: new Set(), atBottom: true, hashTarget: 'tos-1' }), 'tos-1');
});

test('a hash target wins over the topmost-visible point', () => {
    assert.equal(
        currentSection(IDS, { visible: new Set(['tos-2', 'tos-3']), atBottom: false, hashTarget: 'tos-1' }),
        'tos-1'
    );
});

test('a hash target that names none of the ids is ignored', () => {
    assert.equal(
        currentSection(IDS, { visible: new Set(['tos-2']), atBottom: false, hashTarget: 'not-a-point' }),
        'tos-2'
    );
});

test('with no hash target and not at the bottom, falls back to firstVisible', () => {
    assert.equal(currentSection(IDS, { visible: new Set(['tos-3', 'tos-2']), atBottom: false }), 'tos-2');
});

test('with no hash target, not at the bottom and nothing visible, returns null', () => {
    assert.equal(currentSection(IDS, { visible: new Set(), atBottom: false }), null);
});

test('at the bottom with no ids returns null', () => {
    assert.equal(currentSection([], { visible: new Set(), atBottom: true }), null);
});
