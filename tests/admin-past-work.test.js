import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminPastWork from '../src/components/admin/AdminPastWork.jsx';

function noop() {}

const html = renderToStaticMarkup(
    <AdminPastWork pastWork={[]} setPastWork={noop} savedOrder={[]} setSavedOrder={noop} />
);

test('renders the past-work-list container server-side (populated client-side via props)', () => {
    assert.match(html, /id="past-work-list"/);
});

test('renders the "Save Order" button, disabled in the initial empty-list state', () => {
    assert.match(html, /id="past-work-save-order"[^>]*disabled/);
});

test('renders the add-past-work form fields with correct ids', () => {
    assert.match(html, /id="past-work-image"/);
    assert.match(html, /id="past-work-caption"/);
});

test('renders "Publish Past Work" as the submit button text', () => {
    assert.match(html, /Publish Past Work<\/button>/);
});

test('renders NSFW and gift-art checkboxes on the add-past-work form', () => {
    assert.match(html, /NSFW/);
    assert.match(html, /Gift art \(not commissioned\)/);
});

test('does not render any Font Awesome icon classes (admin CSP excludes cdnjs)', () => {
    assert.doesNotMatch(html, /fa-[a-z-]+/);
});
