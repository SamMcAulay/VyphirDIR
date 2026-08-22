import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate } from '../shared/format-date.js';

test('formats a date string as dd/mm/yyyy, not mm/dd/yyyy', () => {
    // September 5th — a date that would visibly differ between dd/mm and mm/dd
    assert.equal(formatDate('2026-09-05T00:00:00'), '05/09/2026');
});

test('zero-pads single-digit day and month', () => {
    assert.equal(formatDate('2026-01-02T00:00:00'), '02/01/2026');
});

test('accepts a Date instance directly', () => {
    assert.equal(formatDate(new Date(2026, 8, 5)), '05/09/2026');
});

test('returns an empty string for an invalid date', () => {
    assert.equal(formatDate('not a date'), '');
    assert.equal(formatDate(''), '');
});
