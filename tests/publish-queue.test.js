import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateColumn,
    validateCard,
    validateQueuePayload,
    updateQueue,
} from '../functions/api/publish-queue.js';

const githubConfig = { owner: 'o', repo: 'r', branch: 'main', token: 't' };

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

function baseColumns() {
    return [
        { id: 'column-1', name: 'Waitlist', enabled: true },
        { id: 'column-2', name: 'In Queue', enabled: true },
        { id: 'column-3', name: 'Sketch Provided', enabled: true },
        { id: 'column-4', name: 'Paid', enabled: false },
        { id: 'column-5', name: 'WIP', enabled: true },
    ];
}

test('validateColumn rejects a column with no id', () => {
    const errors = validateColumn({ name: 'Waitlist', enabled: true }, 0);
    assert.ok(errors.some((e) => e.includes('needs an id')));
});

test('validateColumn rejects a column with no name', () => {
    const errors = validateColumn({ id: 'column-1', enabled: true }, 0);
    assert.ok(errors.some((e) => e.includes('needs a name')));
});

test('validateColumn rejects a non-boolean enabled flag', () => {
    const errors = validateColumn({ id: 'column-1', name: 'Waitlist', enabled: 'yes' }, 0);
    assert.ok(errors.some((e) => e.includes('enabled flag')));
});

test('validateCard rejects a card with no title', () => {
    const columnIds = new Set(['column-1']);
    const errors = validateCard({ id: 'c1', columnId: 'column-1', createdAt: 'now' }, 0, columnIds);
    assert.ok(errors.some((e) => e.includes('needs a title')));
});

test('validateCard rejects a card referencing an unknown column', () => {
    const columnIds = new Set(['column-1']);
    const errors = validateCard(
        { id: 'c1', columnId: 'column-9', title: 'Headshot', createdAt: 'now' },
        0,
        columnIds
    );
    assert.ok(errors.some((e) => e.includes('unknown column')));
});

test('validateCard rejects a malformed target date', () => {
    const columnIds = new Set(['column-1']);
    const errors = validateCard(
        { id: 'c1', columnId: 'column-1', title: 'Headshot', createdAt: 'now', targetDate: 'next week' },
        0,
        columnIds
    );
    assert.ok(errors.some((e) => e.includes('YYYY-MM-DD')));
});

test('validateCard accepts a minimal valid card with no target date', () => {
    const columnIds = new Set(['column-1']);
    const errors = validateCard({ id: 'c1', columnId: 'column-1', title: 'Headshot', createdAt: 'now' }, 0, columnIds);
    assert.deepEqual(errors, []);
});

test('validateQueuePayload rejects a payload without exactly 5 columns', () => {
    const { valid, errors } = validateQueuePayload({ columns: baseColumns().slice(0, 3), cards: [] });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('exactly 5')));
});

test('validateQueuePayload rejects a non-array cards field', () => {
    const { valid, errors } = validateQueuePayload({ columns: baseColumns(), cards: 'nope' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Cards must be an array')));
});

test('validateQueuePayload accepts a full valid payload', () => {
    const { valid, errors } = validateQueuePayload({
        columns: baseColumns(),
        cards: [
            { id: 'c1', columnId: 'column-1', title: 'Headshot', for: '@xyz', targetDate: '2026-09-15', createdAt: 'now' },
        ],
    });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('updateQueue normalizes columns and cards, defaulting optional fields', async () => {
    let putBody;
    await withMockedFetch(
        async (url, options) => {
            if (options && options.method === 'PUT') {
                putBody = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString('utf8'));
                return new Response(JSON.stringify({ content: { sha: 'new-sha' } }), { status: 200 });
            }
            return new Response(
                JSON.stringify({
                    content: Buffer.from(JSON.stringify({ columns: baseColumns(), cards: [] })).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            );
        },
        async () => {
            const result = await updateQueue(
                {
                    columns: baseColumns(),
                    cards: [
                        {
                            id: 'c1',
                            columnId: 'column-1',
                            title: 'Headshot',
                            extra: 'dropped',
                            createdAt: '2026-08-22T00:00:00.000Z',
                        },
                    ],
                },
                githubConfig
            );

            const expectedCards = [
                { id: 'c1', columnId: 'column-1', title: 'Headshot', for: '', targetDate: '', createdAt: '2026-08-22T00:00:00.000Z' },
            ];
            assert.deepEqual(result.cards, expectedCards);
            assert.deepEqual(putBody.cards, expectedCards);
            assert.deepEqual(putBody.columns, baseColumns());
        }
    );
});
