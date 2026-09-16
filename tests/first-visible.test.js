import test from 'node:test';
import assert from 'node:assert/strict';
import { firstVisible } from '../src/components/first-visible.js';

test('returns the first id, in document order, that is visible', () => {
    assert.equal(firstVisible(['tos-1', 'tos-2', 'tos-3'], new Set(['tos-3', 'tos-2'])), 'tos-2');
});

test('returns null when nothing is visible', () => {
    assert.equal(firstVisible(['tos-1'], new Set()), null);
});
