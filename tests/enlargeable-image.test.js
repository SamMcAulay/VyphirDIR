import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import EnlargeableImage from '../src/components/EnlargeableImage.jsx';

test('wraps the image in an enlarge link when an id can be extracted', () => {
    const html = renderToStaticMarkup(<EnlargeableImage src="https://example.com/img/abc-123.jpg" alt="Test" />);
    assert.match(html, /class="char-image-wrap"/);
    assert.match(html, /class="enlarge-link"/);
    assert.match(html, /href="\/i\/abc-123"/);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener"/);

    const pngHtml = renderToStaticMarkup(<EnlargeableImage src="https://example.com/img/xyz-789.png" alt="Test" />);
    assert.match(pngHtml, /href="\/i\/xyz-789"/);
});

test('renders a plain image with no wrapping link when no id can be extracted', () => {
    const html = renderToStaticMarkup(<EnlargeableImage src="https://example.com/" alt="Test" />);
    assert.doesNotMatch(html, /enlarge-link/);
    assert.doesNotMatch(html, /<a /);
    assert.match(html, /<img[^>]*src="https:\/\/example\.com\/"/);
});
