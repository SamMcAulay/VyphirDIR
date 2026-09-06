import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Blob from '../src/components/decor/Blob.jsx';

test('renders an svg with the requested size', () => {
    const html = renderToStaticMarkup(<Blob size={150} />);
    assert.match(html, /width="150"/);
    assert.match(html, /height="150"/);
});

test('defaults to variant 1 path data', () => {
    const html = renderToStaticMarkup(<Blob />);
    assert.match(html, /d="M45,10 C80,0/);
});

test('renders a different path for variant 3', () => {
    const html = renderToStaticMarkup(<Blob variant={3} />);
    assert.match(html, /d="M90,5 C130,0/);
});

test('falls back to variant 1 for an unknown variant number', () => {
    const html = renderToStaticMarkup(<Blob variant={99} />);
    assert.match(html, /d="M45,10 C80,0/);
});

test('applies the given fill color', () => {
    const html = renderToStaticMarkup(<Blob color="#ff0000" />);
    assert.match(html, /fill="#ff0000"/);
});

test('appends an extra className alongside decor-blob', () => {
    const html = renderToStaticMarkup(<Blob className="hero-blob-1" />);
    assert.match(html, /class="decor-blob hero-blob-1"/);
});

test('is marked aria-hidden', () => {
    const html = renderToStaticMarkup(<Blob />);
    assert.match(html, /aria-hidden="true"/);
});
