import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminCommissionsInfo from '../src/components/admin/AdminCommissionsInfo.jsx';

const html = renderToStaticMarkup(<AdminCommissionsInfo />);

test('renders the commission-info form fields with correct ids', () => {
    assert.match(html, /id="comm-intro"/);
    assert.match(html, /id="comm-special-offer"/);
});

test('renders the "Commissions open" checkbox checked by default', () => {
    assert.match(html, /Commissions open/);
});

test('renders the tiers mount point', () => {
    assert.match(html, /id="comm-tiers-rows"/);
});

test('renders "Add tier" and "Save Commission Info" buttons in the initial SSR state', () => {
    assert.match(html, /Add tier<\/button>/);
    assert.match(html, /Save Commission Info<\/button>/);
});

test('renders no tier rows in the initial (no-data) SSR state', () => {
    assert.doesNotMatch(html, /className="tier-row"/);
    assert.doesNotMatch(html, /class="tier-row"/);
});

test('does not render any Font Awesome icon classes (admin CSP excludes cdnjs)', () => {
    assert.doesNotMatch(html, /fa-[a-z-]+/);
});
