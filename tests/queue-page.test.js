import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Queue from '../src/pages/Queue.jsx';

const html = renderToStaticMarkup(<Queue />);

test('wraps the page in the tabby page frame with a hidden heading', () => {
    assert.match(html, /^<div class="page-tabby page-frame"><h1 class="sr-only">Commission Queue<\/h1>/);
});

test('renders no panel, back link or visible title', () => {
    assert.doesNotMatch(html, /panel-wrapper|back-link|wave-text/);
});
