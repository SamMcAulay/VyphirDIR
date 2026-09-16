import test from 'node:test';
import assert from 'node:assert/strict';
import { cx } from '../src/components/cx.js';

test('joins truthy class names with single spaces', () => {
    assert.equal(cx('a', false, 'b', '', null, undefined, 'c'), 'a b c');
});

test('returns an empty string when nothing is truthy', () => {
    assert.equal(cx(false, '', null), '');
});
