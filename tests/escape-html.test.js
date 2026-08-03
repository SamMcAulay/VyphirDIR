import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../shared/escape-html.js';

test('escapes the five HTML-sensitive characters', () => {
    assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

test('coerces null and undefined to an empty string', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
});

test('coerces non-string values to strings', () => {
    assert.equal(escapeHtml(42), '42');
});
