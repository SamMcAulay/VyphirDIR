import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateCharacterPayload,
    validateDeleteRequest,
    mergeCharacterImages,
    normalizeThumbnail,
    deleteCharacter,
} from '../functions/api/publish-character.js';

const githubConfig = { owner: 'o', repo: 'r', branch: 'main', token: 't' };

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

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

test('validateDeleteRequest rejects a request with no slug', () => {
    const { valid, errors } = validateDeleteRequest({});
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Slug')));
});

test('validateDeleteRequest accepts a request with a slug', () => {
    const { valid, errors } = validateDeleteRequest({ slug: 'drasil' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('mergeCharacterImages combines existing and newly uploaded images', () => {
    const existing = [{ url: 'https://example.com/a.jpg', nsfw: false }];
    const fresh = [{ url: 'https://example.com/b.jpg', nsfw: true }];
    assert.deepEqual(mergeCharacterImages(existing, fresh), [
        { url: 'https://example.com/a.jpg', nsfw: false },
        { url: 'https://example.com/b.jpg', nsfw: true },
    ]);
});

test('mergeCharacterImages drops existing entries with no url', () => {
    const existing = [{ nsfw: false }, { url: '', nsfw: true }, { url: 'https://example.com/a.jpg', nsfw: false }];
    assert.deepEqual(mergeCharacterImages(existing, []), [
        { url: 'https://example.com/a.jpg', nsfw: false },
    ]);
});

test('mergeCharacterImages returns an empty array when nothing is kept or added', () => {
    assert.deepEqual(mergeCharacterImages([], []), []);
});

test('mergeCharacterImages preserves a thumbnail flag on an existing image', () => {
    const existing = [{ url: 'https://example.com/a.jpg', nsfw: false, thumbnail: true }];
    const fresh = [{ url: 'https://example.com/b.jpg', nsfw: false }];
    assert.deepEqual(mergeCharacterImages(existing, fresh), [
        { url: 'https://example.com/a.jpg', nsfw: false, thumbnail: true },
        { url: 'https://example.com/b.jpg', nsfw: false },
    ]);
});

test('mergeCharacterImages strips a duplicate thumbnail flag, keeping only the first', () => {
    const existing = [{ url: 'https://example.com/a.jpg', nsfw: false, thumbnail: true }];
    const fresh = [{ url: 'https://example.com/b.jpg', nsfw: false, thumbnail: true }];
    assert.deepEqual(mergeCharacterImages(existing, fresh), [
        { url: 'https://example.com/a.jpg', nsfw: false, thumbnail: true },
        { url: 'https://example.com/b.jpg', nsfw: false },
    ]);
});

test('normalizeThumbnail leaves images unchanged when no thumbnail is flagged', () => {
    const images = [{ url: 'a', nsfw: false }, { url: 'b', nsfw: true }];
    assert.deepEqual(normalizeThumbnail(images), images);
});

test('normalizeThumbnail keeps only the first flagged thumbnail', () => {
    const images = [
        { url: 'a', nsfw: false, thumbnail: true },
        { url: 'b', nsfw: false, thumbnail: true },
    ];
    assert.deepEqual(normalizeThumbnail(images), [
        { url: 'a', nsfw: false, thumbnail: true },
        { url: 'b', nsfw: false },
    ]);
});

test('deleteCharacter throws a notFound error when the slug does not exist', async () => {
    await withMockedFetch(
        async () =>
            new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({ characters: [{ slug: 'drasil', name: 'Drasil', images: [] }] })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            ),
        async () => {
            await assert.rejects(
                deleteCharacter('nonexistent', githubConfig),
                (error) => error.notFound === true
            );
        }
    );
});
