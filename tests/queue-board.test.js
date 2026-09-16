import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueueCards } from '../src/components/QueueBoard.jsx';

const DATA = {
    columns: [
        { id: 'c1', name: 'In Queue', enabled: true },
        { id: 'c2', name: 'Sketch Provided', enabled: true },
        { id: 'c4', name: 'WIP', enabled: true },
        { id: 'c5', name: 'Complete', enabled: true },
    ],
    cards: [
        { id: 'a', columnId: 'c1', title: 'Rusko gift art', for: 'personal', targetDate: '', createdAt: '' },
        { id: 'b', columnId: 'c4', title: 'Train art!', for: 'evby', targetDate: '2026-08-27', createdAt: '' },
        { id: 'd', columnId: 'c5', title: 'Icon', for: '@owenmcn', targetDate: '', createdAt: '' },
    ],
};

const html = renderToStaticMarkup(<QueueCards data={DATA} />);

test('lists active commissions furthest along first', () => {
    assert.ok(html.indexOf('Train art!') < html.indexOf('Rusko gift art'));
});

test('renders each title as an h2 with a joined meta line', () => {
    assert.match(html, /<h2 class="queue-card__title">Train art!<\/h2><p class="queue-card__meta">For: evby · target 27\/08\/2026<\/p>/);
    assert.match(html, /<p class="queue-card__meta">For: personal<\/p>/);
});

test('states the stage in text for active cards', () => {
    assert.match(html, /<p class="queue-card__stage">WIP · stage 3 of 4<\/p>/);
    assert.match(html, /<p class="queue-card__stage">In Queue · stage 1 of 4<\/p>/);
});

test('draws one bead per stage with exactly one current bead per card', () => {
    const cards = html.split('<li class="queue-card').slice(1);
    assert.equal(cards.length, 3);
    for (const card of cards) {
        assert.equal((card.match(/queue-track__bead/g) || []).length, 4);
        assert.equal((card.match(/is-current/g) || []).length, 1);
    }
    assert.match(html, /<span class="queue-track" aria-hidden="true">/);
});

test('groups finished commissions under a count label', () => {
    assert.match(html, /<p class="queue-finished-label">Finished · 1<\/p>/);
    assert.match(html, /<li class="queue-card queue-card--finished">.*<p class="queue-card__stage">Complete<\/p>/s);
});

test('omits the finished label when nothing is finished', () => {
    const none = renderToStaticMarkup(<QueueCards data={{ ...DATA, cards: DATA.cards.slice(0, 2) }} />);
    assert.doesNotMatch(none, /queue-finished-label/);
});

test('shows a plain message when the queue is empty', () => {
    assert.equal(
        renderToStaticMarkup(<QueueCards data={{ ...DATA, cards: [] }} />),
        '<p class="page-message">The queue is empty right now.</p>'
    );
});

test('emits no inline style attribute', () => {
    assert.doesNotMatch(html, /style=/);
});
