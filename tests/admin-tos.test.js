import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminTos from '../src/components/admin/AdminTos.jsx';

const html = renderToStaticMarkup(<AdminTos />);

test('renders the TOS points mount point', () => {
    assert.match(html, /id="tos-points-rows"/);
});

test('renders "Add point" and "Save TOS" buttons in the initial SSR state', () => {
    assert.match(html, /Add point<\/button>/);
    assert.match(html, /Save TOS<\/button>/);
});

test('renders no point rows in the initial (no-data) SSR state', () => {
    assert.doesNotMatch(html, /className="tos-point-row"/);
    assert.doesNotMatch(html, /class="tos-point-row"/);
});

test('does not render any Font Awesome icon classes (admin CSP excludes cdnjs)', () => {
    assert.doesNotMatch(html, /fa-[a-z-]+/);
});
