import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import BlueskyFeed from '../src/components/BlueskyFeed.jsx';

test('renders the loading placeholder on first (server) render', () => {
    const html = renderToStaticMarkup(<BlueskyFeed handle="samisaderp.bsky.social" />);
    assert.match(html, /class="feed-loading-placeholder"/);
    assert.match(html, /Loading data packets\.\.\./);
});
