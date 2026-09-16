import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestIndex } from '../src/components/strip-index.js';

test('returns 0 when there are no items', () => {
    assert.equal(nearestIndex(120, []), 0);
});

test('picks the item whose left edge is closest to the scroll position', () => {
    assert.equal(nearestIndex(0, [0, 300, 600], 900), 0);
    assert.equal(nearestIndex(280, [0, 300, 600], 900), 1);
    assert.equal(nearestIndex(590, [0, 300, 600], 900), 2);
});

test('keeps the earlier item on an exact tie', () => {
    assert.equal(nearestIndex(150, [0, 300, 600], 900), 0);
});

test('reports the last item once the strip is scrolled to its end', () => {
    // Four thirds-width tiers: the last one can never reach the left edge.
    assert.equal(nearestIndex(345, [0, 345, 690, 1035], 345), 3);
});

test('does not jump to the last item when the strip cannot scroll at all', () => {
    assert.equal(nearestIndex(0, [0, 300], 0), 0);
});
