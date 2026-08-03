import test from 'node:test';
import assert from 'node:assert/strict';
import { findImageById, onRequestGet } from '../functions/i/[id].js';

const characters = {
    characters: [
        {
            name: 'Vyphir',
            species: 'Mainecoon Cat',
            bio: 'A cat.\nSecond line.',
            slug: 'vyphir',
            images: [
                { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/aaa-111.png', nsfw: false },
                { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/characters/bbb-222.png', nsfw: true },
            ],
        },
    ],
};

const commissions = {
    pastWork: [
        { url: 'https://res.cloudinary.com/demo/image/upload/v1/vyphir/commissions/ccc-333.png', caption: 'Fanart' },
    ],
};

test('finds a character image by id', () => {
    const result = findImageById(characters, commissions, 'aaa-111');
    assert.equal(result.kind, 'character');
    assert.equal(result.title, 'Vyphir');
    assert.equal(result.nsfw, false);
    assert.equal(result.backHref, '/gallery/vyphir/');
});

test('finds an nsfw character image and marks it nsfw', () => {
    const result = findImageById(characters, commissions, 'bbb-222');
    assert.equal(result.nsfw, true);
});

test('finds a commission past-work image by id', () => {
    const result = findImageById(characters, commissions, 'ccc-333');
    assert.equal(result.kind, 'commission');
    assert.equal(result.description, 'Fanart');
    assert.equal(result.backHref, '/commissions/');
});

test('returns null when no image matches', () => {
    assert.equal(findImageById(characters, commissions, 'does-not-exist'), null);
});

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

function jsonResponse(data) {
    return new Response(JSON.stringify(data), { status: 200 });
}

function mockDataFetch(url) {
    const u = String(url);
    if (u.includes('characters.json')) return jsonResponse(characters);
    if (u.includes('commissions.json')) return jsonResponse(commissions);
    throw new Error(`unexpected fetch ${u}`);
}

test('onRequestGet returns a 200 page with og:image for an sfw character image', async () => {
    await withMockedFetch(mockDataFetch, async () => {
        const request = new Request('https://vyphir.com/i/aaa-111');
        const response = await onRequestGet({ request, params: { id: 'aaa-111' } });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /og:image/);
        assert.match(html, /Vyphir/);
    });
});

test('onRequestGet omits og:image for an nsfw image', async () => {
    await withMockedFetch(mockDataFetch, async () => {
        const request = new Request('https://vyphir.com/i/bbb-222');
        const response = await onRequestGet({ request, params: { id: 'bbb-222' } });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.doesNotMatch(html, /og:image/);
    });
});

test('onRequestGet returns 404 for an unknown id', async () => {
    await withMockedFetch(mockDataFetch, async () => {
        const request = new Request('https://vyphir.com/i/nope');
        const response = await onRequestGet({ request, params: { id: 'nope' } });
        assert.equal(response.status, 404);
    });
});

test('onRequestGet returns 500 when the data fetch fails', async () => {
    await withMockedFetch(async () => { throw new Error('network down'); }, async () => {
        const request = new Request('https://vyphir.com/i/aaa-111');
        const response = await onRequestGet({ request, params: { id: 'aaa-111' } });
        assert.equal(response.status, 500);
    });
});
