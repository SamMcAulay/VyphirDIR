import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTos } from '../src/components/split-tos.js';

const POINTS = [
    { title: 'Payments', body: 'Pay first', bullets: [{ type: 'plain', text: 'Up front' }] },
    {
        title: 'What I draw',
        body: 'Backgrounds extra',
        bullets: [
            { type: 'yesno', text: 'Feral', value: true },
            { type: 'plain', text: 'Ask first' },
            { type: 'yesno', text: 'Humans', value: false },
        ],
    },
    { title: 'Extras', bullets: [{ type: 'yesno', text: 'Anthro', value: true }] },
    { title: 'Refunds', body: 'Maybe' },
];

test('collects yes/no bullets from every point, in order', () => {
    const { will, wont } = splitTos(POINTS);
    assert.deepEqual(will, ['Feral', 'Anthro']);
    assert.deepEqual(wont, ['Humans']);
});

test('removes yes/no bullets but keeps plain bullets, bodies and titles', () => {
    const { points } = splitTos(POINTS);
    assert.deepEqual(points[1], { title: 'What I draw', body: 'Backgrounds extra', bullets: [{ type: 'plain', text: 'Ask first' }] });
    assert.deepEqual(points[0].bullets, [{ type: 'plain', text: 'Up front' }]);
});

test('gives points left without bullets an empty array', () => {
    const { points } = splitTos(POINTS);
    assert.deepEqual(points[2].bullets, []);
    assert.deepEqual(points[3].bullets, []);
});

test('returns empty lists when there are no yes/no bullets or no points', () => {
    assert.deepEqual(splitTos([{ title: 'A', bullets: [] }]).will, []);
    assert.deepEqual(splitTos(undefined), { will: [], wont: [], points: [] });
});
