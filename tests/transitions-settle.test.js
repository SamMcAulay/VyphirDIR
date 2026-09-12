import test from 'node:test';
import assert from 'node:assert/strict';
import { settleTargets } from '../src/transitions/settle.js';

test('settleTargets keeps only the whole pieces, in order', () => {
    const shell = { el: { tag: 'panel' }, mode: 'shell' };
    const first = { el: { tag: 'h1' }, mode: 'whole' };
    const second = { el: { tag: 'img' }, mode: 'whole' };
    const targets = settleTargets([shell, first, second]);
    assert.deepEqual(targets, [first.el, second.el]);
});

test('settleTargets returns nothing when every piece is a shell', () => {
    assert.deepEqual(settleTargets([{ el: {}, mode: 'shell' }]), []);
});

test('settleTargets tolerates an empty list', () => {
    assert.deepEqual(settleTargets([]), []);
});
