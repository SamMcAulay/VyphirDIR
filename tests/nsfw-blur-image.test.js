import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import NsfwBlurImage from '../src/components/NsfwBlurImage.jsx';

test('non-nsfw image renders without a wrapper or warning', () => {
    const html = renderToStaticMarkup(<NsfwBlurImage src="https://example.com/a.jpg" alt="Test" />);
    assert.doesNotMatch(html, /nsfw-blur/);
    assert.doesNotMatch(html, /nsfw-warning/);
});

test('nsfw image renders exactly one char-image-wrap with a reveal warning', () => {
    const html = renderToStaticMarkup(<NsfwBlurImage src="https://example.com/a.jpg" alt="Test" nsfw />);
    assert.match(html, /class="char-image-wrap nsfw-blur"/);
    assert.match(html, /data-nsfw="true"/);
    assert.match(html, /nsfw-warning/);
    assert.equal((html.match(/char-image-wrap/g) || []).length, 1, 'should not double-wrap');
});
