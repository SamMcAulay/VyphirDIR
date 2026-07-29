import test from 'node:test';
import assert from 'node:assert/strict';
import { getFile, putFile, withRetryOn409 } from '../functions/api/_shared/github.js';

const githubConfig = { owner: 'o', repo: 'r', branch: 'main', token: 't' };

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

test('getFile decodes UTF-8 content (not mangled latin1)', async () => {
    const text = "Café — don't forget the 🐱";
    const base64 = Buffer.from(text, 'utf-8').toString('base64');
    // simulate GitHub's line-wrapped base64 response
    const wrapped = `${base64.slice(0, 10)}\n${base64.slice(10)}`;

    await withMockedFetch(
        async () =>
            new Response(JSON.stringify({ content: wrapped, sha: 'abc123' }), {
                status: 200,
            }),
        async () => {
            const { content, sha } = await getFile('data/x.json', githubConfig);
            assert.equal(content, text);
            assert.equal(sha, 'abc123');
        }
    );
});

test('putFile base64-encodes UTF-8 content and sends explicit Content-Type', async () => {
    const text = "Café — don't forget the 🐱";
    let capturedBody;
    let capturedHeaders;

    await withMockedFetch(
        async (url, options) => {
            capturedBody = JSON.parse(options.body);
            capturedHeaders = options.headers;
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
        async () => {
            await putFile('data/x.json', text, 'sha1', 'msg', githubConfig);
        }
    );

    assert.equal(capturedHeaders['Content-Type'], 'application/json');
    const decoded = Buffer.from(capturedBody.content, 'base64').toString('utf-8');
    assert.equal(decoded, text);
});

test('withRetryOn409 retries once on a 409 and succeeds', async () => {
    let calls = 0;
    const result = await withRetryOn409(async () => {
        calls += 1;
        if (calls === 1) {
            const error = new Error('conflict');
            error.status = 409;
            throw error;
        }
        return 'ok';
    });
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
});

test('withRetryOn409 rethrows non-409 errors without retrying', async () => {
    let calls = 0;
    await assert.rejects(
        withRetryOn409(async () => {
            calls += 1;
            throw new Error('boom');
        }),
        /boom/
    );
    assert.equal(calls, 1);
});

test('putFile/getFile round-trip a large (~200KB) string without a stack overflow', async () => {
    // Well past the 0x8000-byte chunk boundary used internally to avoid
    // `String.fromCharCode(...bytes)` blowing the call stack on big files.
    const base = "Café — don't forget the 🐱. ";
    const large = base.repeat(Math.ceil(200_000 / base.length));

    let capturedBody;
    await withMockedFetch(
        async (url, options) => {
            capturedBody = JSON.parse(options.body);
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
        },
        async () => {
            await putFile('data/x.json', large, 'sha1', 'msg', githubConfig);
        }
    );

    await withMockedFetch(
        async () =>
            new Response(JSON.stringify({ content: capturedBody.content, sha: 'abc' }), {
                status: 200,
            }),
        async () => {
            const { content } = await getFile('data/x.json', githubConfig);
            assert.equal(content, large);
            assert.equal(content.length, large.length);
        }
    );
});
