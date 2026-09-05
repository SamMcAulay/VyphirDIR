import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminQueue from '../src/components/admin/AdminQueue.jsx';

const html = renderToStaticMarkup(<AdminQueue />);

test('renders the queue columns and cards mount points', () => {
    assert.match(html, /id="queue-columns-rows"/);
    assert.match(html, /id="queue-cards-list"/);
});

test('renders "Add Card" and "Save Queue" buttons in the initial SSR state', () => {
    assert.match(html, /Add Card<\/button>/);
    assert.match(html, /Save Queue<\/button>/);
});

test('renders the required queue-card-title field', () => {
    assert.match(html, /id="queue-card-title"/);
    assert.match(html, /required=""/);
});

test('renders no column or card rows in the initial (no-data) SSR state', () => {
    assert.doesNotMatch(html, /class="image-row"/);
    assert.doesNotMatch(html, /class="past-work-list-row"/);
});

test('does not render any Font Awesome icon classes (admin CSP excludes cdnjs)', () => {
    assert.doesNotMatch(html, /fa-[a-z-]+/);
});
