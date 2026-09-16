import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLandingPools, pickPreviews } from '../shared/landing-previews.js';

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
        { url: 'p6.png' },
        { url: 'p7.png' },
        { url: 'p8.png' },
        { url: 'p9-too-old.png' },
        { url: 'p10-too-old.png' },
    ],
};

test('the gallery pool is every character\'s first non-NSFW image', () => {
    const { gallery } = selectLandingPools(characters, commissions);
    assert.deepEqual(gallery, ['a1.png', 'b2.png', 'e1.png', 'f1.png', 'g1.png']);
});

test('the commissions pool is the non-NSFW work among the nine most recent', () => {
    // pastWork[0] is the newest; an NSFW item still uses up one of the nine slots.
    const { commissions: got } = selectLandingPools(characters, commissions);
    assert.deepEqual(got, ['p1.png', 'p2.png', 'p3.png', 'p4.png', 'p5.png', 'p6.png', 'p7.png', 'p8.png']);
});

test('the pools never contain an NSFW url', () => {
    const { gallery, commissions: got } = selectLandingPools(characters, commissions);
    for (const url of [...gallery, ...got]) assert.doesNotMatch(url, /nsfw/);
});

test('the pools are empty for missing or empty data', () => {
    assert.deepEqual(selectLandingPools(null, null), { gallery: [], commissions: [] });
    assert.deepEqual(selectLandingPools({}, {}), { gallery: [], commissions: [] });
    assert.deepEqual(
        selectLandingPools({ characters: [{ name: 'X', images: [{ url: 'x.png', nsfw: true }] }] }, { pastWork: [] }),
        { gallery: [], commissions: [] }
    );
});

test('pickPreviews takes four from each pool in shuffled order', () => {
    const pools = { gallery: ['g1', 'g2', 'g3', 'g4', 'g5'], commissions: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] };
    // random() -> 0 always swaps with index 0, which rotates the array left by one.
    const picked = pickPreviews(pools, () => 0);
    assert.deepEqual(picked, { gallery: ['g2', 'g3', 'g4', 'g5'], commissions: ['c2', 'c3', 'c4', 'c5'] });
});

test('pickPreviews draws differently for different random sources', () => {
    const pools = { gallery: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'], commissions: [] };
    const low = pickPreviews(pools, () => 0).gallery;
    const high = pickPreviews(pools, () => 0.999).gallery;
    assert.notDeepEqual(low, high);
    for (const url of [...low, ...high]) assert.ok(pools.gallery.includes(url));
});

test('pickPreviews never repeats an image and does not mutate the pools', () => {
    const pools = { gallery: ['g1', 'g2', 'g3'], commissions: ['c1'] };
    const picked = pickPreviews(pools, Math.random);
    assert.equal(new Set(picked.gallery).size, 3);
    assert.deepEqual(picked.commissions, ['c1']);
    assert.deepEqual(pools, { gallery: ['g1', 'g2', 'g3'], commissions: ['c1'] });
});

test('pickPreviews tolerates missing pools', () => {
    assert.deepEqual(pickPreviews(null), { gallery: [], commissions: [] });
    assert.deepEqual(pickPreviews({}), { gallery: [], commissions: [] });
});
