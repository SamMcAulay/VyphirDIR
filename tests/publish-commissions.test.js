import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateCommissionsInfo,
    validatePastWorkEntry,
    validatePastWorkEdit,
    validatePastWorkDelete,
    editPastWork,
    deletePastWork,
} from '../functions/api/publish-commissions.js';

const githubConfig = { owner: 'o', repo: 'r', branch: 'main', token: 't' };

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

test('rejects non-boolean status', () => {
    const { valid, errors } = validateCommissionsInfo({ status: 'yes', intro: '', tiers: [] });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Status')));
});

test('rejects tiers missing a name', () => {
    const { valid, errors } = validateCommissionsInfo({
        status: true,
        intro: '',
        tiers: [{ name: '', price: '10' }],
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Tier 1')));
});

test('accepts a minimal valid info payload', () => {
    const { valid, errors } = validateCommissionsInfo({
        status: true,
        intro: 'Open!',
        specialOffer: '',
        tiers: [],
    });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('rejects a past-work entry with no url', () => {
    const { valid, errors } = validatePastWorkEntry({ caption: 'hi' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('URL')));
});

test('accepts a valid past-work entry', () => {
    const { valid, errors } = validatePastWorkEntry({ url: 'https://example.com/a.jpg', caption: 'hi' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('validatePastWorkEdit rejects a request with no url', () => {
    const { valid, errors } = validatePastWorkEdit({ caption: 'hi' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('URL')));
});

test('validatePastWorkEdit accepts a request with a url', () => {
    const { valid, errors } = validatePastWorkEdit({ url: 'https://example.com/a.jpg', caption: 'hi' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('validatePastWorkDelete rejects a request with no url', () => {
    const { valid, errors } = validatePastWorkDelete({});
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('URL')));
});

test('validatePastWorkDelete accepts a request with a url', () => {
    const { valid, errors } = validatePastWorkDelete({ url: 'https://example.com/a.jpg' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('editPastWork throws a notFound error when the url does not exist', async () => {
    await withMockedFetch(
        async () =>
            new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({ pastWork: [{ url: 'https://example.com/a.jpg', caption: 'hi' }] })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            ),
        async () => {
            await assert.rejects(
                editPastWork('https://example.com/missing.jpg', 'new caption', githubConfig),
                (error) => error.notFound === true
            );
        }
    );
});

test('deletePastWork throws a notFound error when the url does not exist', async () => {
    await withMockedFetch(
        async () =>
            new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({ pastWork: [{ url: 'https://example.com/a.jpg', caption: 'hi' }] })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            ),
        async () => {
            await assert.rejects(
                deletePastWork('https://example.com/missing.jpg', githubConfig),
                (error) => error.notFound === true
            );
        }
    );
});
