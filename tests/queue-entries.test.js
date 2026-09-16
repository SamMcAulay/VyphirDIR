import test from 'node:test';
import assert from 'node:assert/strict';
import { queueEntries } from '../src/components/queue-entries.js';

const COLUMNS = [
    { id: 'c1', name: 'In Queue', enabled: true },
    { id: 'c2', name: 'Sketch Provided', enabled: true },
    { id: 'c3', name: 'Paid', enabled: false },
    { id: 'c4', name: 'WIP', enabled: true },
    { id: 'c5', name: 'Complete', enabled: true },
];

test('uses the enabled columns, in data order, as the stages', () => {
    const { stages } = queueEntries({ columns: COLUMNS, cards: [] });
    assert.deepEqual(stages.map((s) => s.name), ['In Queue', 'Sketch Provided', 'WIP', 'Complete']);
});

test('drops cards sitting in a disabled or unknown stage', () => {
    const { active, finished } = queueEntries({
        columns: COLUMNS,
        cards: [{ id: 'x', columnId: 'c3' }, { id: 'y', columnId: 'nope' }],
    });
    assert.deepEqual(active, []);
    assert.deepEqual(finished, []);
});

test('annotates each entry with its stage', () => {
    const { active } = queueEntries({ columns: COLUMNS, cards: [{ id: 'a', columnId: 'c4', title: 'Train art!' }] });
    assert.deepEqual(
        { stageIndex: active[0].stageIndex, stageCount: active[0].stageCount, stageName: active[0].stageName, title: active[0].title },
        { stageIndex: 2, stageCount: 4, stageName: 'WIP', title: 'Train art!' }
    );
});

test('orders active entries furthest along first, keeping data order within a stage', () => {
    const { active } = queueEntries({
        columns: COLUMNS,
        cards: [
            { id: 'q1', columnId: 'c1' },
            { id: 'w', columnId: 'c4' },
            { id: 'q2', columnId: 'c1' },
            { id: 's', columnId: 'c2' },
        ],
    });
    assert.deepEqual(active.map((e) => e.id), ['w', 's', 'q1', 'q2']);
});

test('treats the last stage as finished, keeping data order', () => {
    const { active, finished } = queueEntries({
        columns: COLUMNS,
        cards: [{ id: 'f1', columnId: 'c5' }, { id: 'a', columnId: 'c1' }, { id: 'f2', columnId: 'c5' }],
    });
    assert.deepEqual(finished.map((e) => e.id), ['f1', 'f2']);
    assert.deepEqual(active.map((e) => e.id), ['a']);
});

test('treats nothing as finished when there is only one stage', () => {
    const { active, finished } = queueEntries({
        columns: [{ id: 'only', name: 'Queue', enabled: true }],
        cards: [{ id: 'a', columnId: 'only' }],
    });
    assert.equal(finished.length, 0);
    assert.deepEqual(active.map((e) => e.id), ['a']);
});

test('handles missing data', () => {
    assert.deepEqual(queueEntries(undefined), { stages: [], active: [], finished: [] });
    assert.deepEqual(queueEntries({}), { stages: [], active: [], finished: [] });
});
