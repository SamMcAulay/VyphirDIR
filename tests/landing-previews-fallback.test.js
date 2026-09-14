import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from 'react-test-renderer';
import Landing from '../src/pages/Landing.jsx';

const CHARACTERS = { characters: [{ slug: 'a', name: 'A', images: [{ url: 'https://img/a.png', nsfw: false }] }] };
const COMMISSIONS = { pastWork: [{ url: 'https://img/c.png', nsfw: false }] };

function withFetch(run) {
    const originalFetch = globalThis.fetch;
    const originalDocument = globalThis.document;
    const calls = [];

    globalThis.document = { getElementById: () => null };
    globalThis.fetch = async (url) => {
        calls.push(url);
        const body = url.includes('characters') ? CHARACTERS : COMMISSIONS;
        return new Response(JSON.stringify(body), { status: 200 });
    };

    return Promise.resolve(run(calls)).finally(() => {
        globalThis.fetch = originalFetch;
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    });
}

test('fetches preview art when there is no prop and no embedded data', async () => {
    await withFetch(async (calls) => {
        let tree;
        act(() => {
            tree = create(<Landing />);
        });
        await act(async () => {});
        assert.deepEqual(calls.sort(), ['/data/characters.json', '/data/commissions.json']);
        assert.match(JSON.stringify(tree.toJSON()), /https:\/\/img\/a\.png/);
    });
});

test('does not fetch when previews were passed as a prop', async () => {
    await withFetch(async (calls) => {
        act(() => {
            create(<Landing previews={{ gallery: ['https://img/p.png'], commissions: [] }} />);
        });
        await act(async () => {});
        assert.deepEqual(calls, []);
    });
});
