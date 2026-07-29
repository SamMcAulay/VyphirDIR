import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCharacterPayload } from '../functions/api/publish-character.js';

test('rejects a payload with no name', () => {
    const { valid, errors } = validateCharacterPayload({ name: '', images: [{ url: 'x' }] });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Name')));
});

test('rejects a payload with no images', () => {
    const { valid, errors } = validateCharacterPayload({ name: 'Test', images: [] });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('image')));
});

test('rejects non-string species/bio', () => {
    const { valid, errors } = validateCharacterPayload({
        name: 'Test',
        species: 42,
        images: [{ url: 'x' }],
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Species')));
});

test('accepts a minimal valid payload', () => {
    const { valid, errors } = validateCharacterPayload({
        name: 'Test',
        species: '',
        bio: '',
        images: [{ url: 'https://example.com/a.jpg', nsfw: false }],
    });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});
