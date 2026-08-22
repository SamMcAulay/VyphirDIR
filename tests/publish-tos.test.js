import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateBullet,
    validateTosPoint,
    validateTosPayload,
    updateTos,
} from '../functions/api/publish-tos.js';

const githubConfig = { owner: 'o', repo: 'r', branch: 'main', token: 't' };

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

test('validateBullet rejects a bullet with no text', () => {
    const errors = validateBullet({ type: 'plain' }, 0, 0);
    assert.ok(errors.some((e) => e.includes('needs text')));
});

test('validateBullet rejects an unknown type', () => {
    const errors = validateBullet({ type: 'maybe', text: 'hi' }, 0, 0);
    assert.ok(errors.some((e) => e.includes('type must be')));
});

test('validateBullet requires a boolean value for yesno bullets', () => {
    const errors = validateBullet({ type: 'yesno', text: 'Humans' }, 0, 0);
    assert.ok(errors.some((e) => e.includes('yes/no value')));
});

test('validateBullet accepts a valid plain bullet', () => {
    assert.deepEqual(validateBullet({ type: 'plain', text: 'hi' }, 0, 0), []);
});

test('validateBullet accepts a valid yesno bullet', () => {
    assert.deepEqual(validateBullet({ type: 'yesno', text: 'Humans', value: false }, 0, 0), []);
});

test('validateTosPoint rejects a point with no title', () => {
    const errors = validateTosPoint({ body: 'hi' }, 0);
    assert.ok(errors.some((e) => e.includes('needs a title')));
});

test('validateTosPoint rejects a non-string body', () => {
    const errors = validateTosPoint({ title: 'T', body: 123 }, 0);
    assert.ok(errors.some((e) => e.includes('body must be a string')));
});

test('validateTosPoint rejects non-array bullets', () => {
    const errors = validateTosPoint({ title: 'T', bullets: 'nope' }, 0);
    assert.ok(errors.some((e) => e.includes('bullets must be an array')));
});

test('validateTosPoint aggregates bullet errors', () => {
    const errors = validateTosPoint({ title: 'T', bullets: [{ type: 'plain' }] }, 0);
    assert.ok(errors.some((e) => e.includes('Point 1, bullet 1')));
});

test('validateTosPoint accepts a minimal valid point', () => {
    assert.deepEqual(validateTosPoint({ title: 'Commission Rights' }, 0), []);
});

test('validateTosPayload rejects a non-array points field', () => {
    const { valid, errors } = validateTosPayload({ points: 'nope' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Points must be an array')));
});

test('validateTosPayload accepts an empty points array', () => {
    const { valid, errors } = validateTosPayload({ points: [] });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('validateTosPayload accepts a full valid payload', () => {
    const { valid, errors } = validateTosPayload({
        points: [
            {
                title: 'What I Will and Won\'t Draw',
                body: 'A quick breakdown.',
                bullets: [
                    { type: 'yesno', text: 'Anthro characters', value: true },
                    { type: 'yesno', text: 'Humans', value: false },
                    { type: 'plain', text: 'Ask if unsure' },
                ],
            },
        ],
    });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('updateTos normalizes points, defaulting body and stripping stray fields', async () => {
    let putBody;
    await withMockedFetch(
        async (url, options) => {
            if (options && options.method === 'PUT') {
                putBody = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString('utf8'));
                return new Response(JSON.stringify({ content: { sha: 'new-sha' } }), { status: 200 });
            }
            return new Response(
                JSON.stringify({
                    content: Buffer.from(JSON.stringify({ points: [] })).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            );
        },
        async () => {
            const points = await updateTos(
                {
                    points: [
                        {
                            title: 'Commission Rights',
                            extraField: 'should be dropped',
                            bullets: [
                                { type: 'plain', text: 'Some elaboration', extra: 'x' },
                                { type: 'yesno', text: 'Humans', value: false },
                            ],
                        },
                    ],
                },
                githubConfig
            );

            const expected = [
                {
                    title: 'Commission Rights',
                    body: '',
                    bullets: [
                        { type: 'plain', text: 'Some elaboration' },
                        { type: 'yesno', text: 'Humans', value: false },
                    ],
                },
            ];
            assert.deepEqual(points, expected);
            assert.deepEqual(putBody.points, expected);
        }
    );
});
