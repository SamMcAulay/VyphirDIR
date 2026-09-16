import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Tos from '../src/pages/Tos.jsx';

const html = renderToStaticMarkup(<Tos />);

test('wraps the page in the lavender page frame with a hidden heading', () => {
    assert.match(html, /^<div class="page-lavender page-frame"><h1 class="sr-only">Terms of Service<\/h1>/);
});

test('renders no panel, back link or visible title', () => {
    assert.doesNotMatch(html, /panel-wrapper|back-link|wave-text/);
});
