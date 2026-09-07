import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLandingPreviews } from '../shared/landing-previews.js';

const characters = {
    characters: [
        { name: 'A', images: [{ url: 'a1.png', nsfw: false }, { url: 'a2.png' }] },
        { name: 'B', images: [{ url: 'b-nsfw.png', nsfw: true }, { url: 'b2.png' }] },
        { name: 'C', images: [{ url: 'c-nsfw.png', nsfw: true }] },
        { name: 'D', images: [] },
        { name: 'E', images: [{ url: 'e1.png' }] },
        { name: 'F', images: [{ url: 'f1.png' }] },
        { name: 'G', images: [{ url: 'g1.png' }] },
    ],
};

const commissions = {
    pastWork: [
        { url: 'p1.png' },
        { url: 'p-nsfw.png', nsfw: true },
        { url: 'p2.png', nsfw: false },
        { url: 'p3.png' },
        { url: 'p4.png' },
        { url: 'p5.png' },
    ],
};

test('picks each character\'s first non-NSFW image, capped at four', () => {
    const { gallery } = selectLandingPreviews(characters, commissions);
    assert.deepEqual(gallery, ['a1.png', 'b2.png', 'e1.png', 'f1.png']);
});

test('picks the first four non-NSFW past-work images', () => {
    const { commissions: got } = selectLandingPreviews(characters, commissions);
    assert.deepEqual(got, ['p1.png', 'p2.png', 'p3.png', 'p4.png']);
});

test('never returns an NSFW url', () => {
    const { gallery, commissions: got } = selectLandingPreviews(characters, commissions);
    for (const url of [...gallery, ...got]) assert.doesNotMatch(url, /nsfw/);
});

test('returns empty arrays for missing or empty data', () => {
    assert.deepEqual(selectLandingPreviews(null, null), { gallery: [], commissions: [] });
    assert.deepEqual(selectLandingPreviews({}, {}), { gallery: [], commissions: [] });
    assert.deepEqual(
        selectLandingPreviews({ characters: [{ name: 'X', images: [{ url: 'x.png', nsfw: true }] }] }, { pastWork: [] }),
        { gallery: [], commissions: [] }
    );
});

test('returns fewer than four when that is all that is eligible', () => {
    const { gallery } = selectLandingPreviews(
        { characters: [{ name: 'A', images: [{ url: 'only.png' }] }] },
        { pastWork: [] }
    );
    assert.deepEqual(gallery, ['only.png']);
});
