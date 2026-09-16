import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCoverImage } from '../src/components/cover-image.js';

test('prefers a safe image flagged as the thumbnail', () => {
    const images = [{ url: 'a' }, { url: 'b', thumbnail: true }];
    assert.equal(selectCoverImage(images).url, 'b');
});

test('skips an NSFW thumbnail and falls back to the first safe image', () => {
    const images = [{ url: 'a', nsfw: true }, { url: 'b', thumbnail: true, nsfw: true }, { url: 'c' }];
    assert.equal(selectCoverImage(images).url, 'c');
});

test('returns null when every image is NSFW or there are none', () => {
    assert.equal(selectCoverImage([{ url: 'a', nsfw: true }]), null);
    assert.equal(selectCoverImage([]), null);
    assert.equal(selectCoverImage(undefined), null);
});
