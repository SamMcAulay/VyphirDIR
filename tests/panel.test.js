import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Panel from '../src/components/Panel.jsx';

test('renders default size with no modifier class', () => {
    const html = renderToStaticMarkup(<Panel>hi</Panel>);
    assert.match(html, /class="panel-wrapper\s*">/);
    assert.doesNotMatch(html, /panel--wide/);
    assert.doesNotMatch(html, /panel--xwide/);
});

test('renders the wide variant', () => {
    const html = renderToStaticMarkup(<Panel wide>hi</Panel>);
    assert.match(html, /class="panel-wrapper panel--wide"/);
});

test('renders the xwide variant', () => {
    const html = renderToStaticMarkup(<Panel xwide>hi</Panel>);
    assert.match(html, /class="panel-wrapper panel--xwide"/);
});

test('passes through an extra className on the inner panel', () => {
    const html = renderToStaticMarkup(<Panel className="extra">hi</Panel>);
    assert.match(html, /class="panel extra"/);
});

test('renders children inside the panel', () => {
    const html = renderToStaticMarkup(<Panel><p>content</p></Panel>);
    assert.match(html, /<p>content<\/p>/);
});
