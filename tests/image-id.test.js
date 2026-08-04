import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImageId } from '../shared/image-id.js';

test('extracts the filename without extension', () => {
    assert.equal(
        extractImageId('https://res.cloudinary.com/l89vlr4i/image/upload/v123/vyphir/characters/392a6c2d-d49f-45fd-9b74-351e1e5cec69.png'),
        '392a6c2d-d49f-45fd-9b74-351e1e5cec69'
    );
});

test('strips query strings and hash fragments', () => {
    assert.equal(extractImageId('https://example.com/img/abc-123.jpg?w=200'), 'abc-123');
    assert.equal(extractImageId('https://example.com/img/abc-123.jpg#frag'), 'abc-123');
});

test('handles a url with no file extension', () => {
    assert.equal(extractImageId('https://example.com/img/abc-123'), 'abc-123');
});

test('returns an empty string for an empty or nullish url', () => {
    assert.equal(extractImageId(''), '');
    assert.equal(extractImageId(undefined), '');
});
