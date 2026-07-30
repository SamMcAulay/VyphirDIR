import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateCommissionsInfo,
    validatePastWorkEntry,
    validatePastWorkEdit,
    validatePastWorkDelete,
    validatePastWorkReorder,
    editPastWork,
    deletePastWork,
    reorderPastWork,
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

test('rejects a past-work entry with a non-boolean nsfw flag', () => {
    const { valid, errors } = validatePastWorkEntry({ url: 'https://example.com/a.jpg', nsfw: 'yes' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('NSFW')));
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

test('validatePastWorkReorder rejects a non-array order', () => {
    const { valid, errors } = validatePastWorkReorder({ order: 'nope' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Order')));
});

test('validatePastWorkReorder accepts an array of urls', () => {
    const { valid, errors } = validatePastWorkReorder({ order: ['https://example.com/a.jpg'] });
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
                editPastWork('https://example.com/missing.jpg', { caption: 'new caption' }, githubConfig),
                (error) => error.notFound === true
            );
        }
    );
});

test('editPastWork updates nsfw while leaving an unspecified caption untouched', async () => {
    let putBody;
    await withMockedFetch(
        async (url, options) => {
            if (options && options.method === 'PUT') {
                putBody = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString('utf8'));
                return new Response(JSON.stringify({ content: { sha: 'new-sha' } }), { status: 200 });
            }
            return new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({ pastWork: [{ url: 'https://example.com/a.jpg', caption: 'hi', nsfw: false }] })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            );
        },
        async () => {
            await editPastWork('https://example.com/a.jpg', { nsfw: true }, githubConfig);
            assert.deepEqual(putBody.pastWork, [{ url: 'https://example.com/a.jpg', caption: 'hi', nsfw: true }]);
        }
    );
});

test('reorderPastWork throws when the order is missing an existing entry', async () => {
    await withMockedFetch(
        async () =>
            new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({
                            pastWork: [
                                { url: 'https://example.com/a.jpg', caption: 'a' },
                                { url: 'https://example.com/b.jpg', caption: 'b' },
                            ],
                        })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            ),
        async () => {
            await assert.rejects(
                reorderPastWork(['https://example.com/a.jpg'], githubConfig),
                (error) => error.notFound === true
            );
        }
    );
});

test('reorderPastWork reorders entries to match the given url order', async () => {
    let putBody;
    await withMockedFetch(
        async (url, options) => {
            if (options && options.method === 'PUT') {
                putBody = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString('utf8'));
                return new Response(JSON.stringify({ content: { sha: 'new-sha' } }), { status: 200 });
            }
            return new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({
                            pastWork: [
                                { url: 'https://example.com/a.jpg', caption: 'a' },
                                { url: 'https://example.com/b.jpg', caption: 'b' },
                            ],
                        })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            );
        },
        async () => {
            await reorderPastWork(['https://example.com/b.jpg', 'https://example.com/a.jpg'], githubConfig);
            assert.deepEqual(putBody.pastWork, [
                { url: 'https://example.com/b.jpg', caption: 'b' },
                { url: 'https://example.com/a.jpg', caption: 'a' },
            ]);
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
