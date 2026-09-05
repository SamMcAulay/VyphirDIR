import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminCharacters from '../src/components/admin/AdminCharacters.jsx';

const html = renderToStaticMarkup(<AdminCharacters />);

test('renders the character-list container server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="character-list"/);
});

test('renders the add-character form fields with correct ids', () => {
    assert.match(html, /id="char-name"/);
    assert.match(html, /id="char-species"/);
    assert.match(html, /id="char-bio"/);
    assert.match(html, /id="char-images"/);
});

test('renders the existing-images and nsfw-rows mount points', () => {
    assert.match(html, /id="char-existing-images"/);
    assert.match(html, /id="char-nsfw-rows"/);
});

test('renders "Publish Character" as the submit button text in the non-editing SSR state', () => {
    assert.match(html, /Publish Character<\/button>/);
});

test('does not render an edit-cancel button in the non-editing SSR state', () => {
    assert.doesNotMatch(html, /Cancel Edit/);
});

test('does not render any Font Awesome icon classes (admin CSP excludes cdnjs)', () => {
    assert.doesNotMatch(html, /fa-[a-z-]+/);
});
