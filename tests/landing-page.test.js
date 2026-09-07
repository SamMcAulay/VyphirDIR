import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Landing from '../src/pages/Landing.jsx';

const html = renderToStaticMarkup(<Landing />);

// WaveText renders each character of a heading as its own
// <span class="wave-text-letter">, splitting words like "Character Archives"
// across tags. Stripping tags recovers the plain-text content so headings and
// copy can still be asserted on as whole strings.
const text = html.replace(/<[^>]+>/g, '');

test('renders every static outbound profile link', () => {
    assert.match(html, /href="https:\/\/www\.instagram\.com\/vyphir"/);
    assert.match(html, /href="https:\/\/x\.com\/Vyphirr"/);
    assert.match(html, /href="https:\/\/bsky\.app\/profile\/samisaderp\.bsky\.social"/);
    assert.match(html, /href="https:\/\/t\.me\/Samisaderp#?"/);
    assert.match(html, /href="https:\/\/toyhou\.se\/samisaderp\/characters"/);
    assert.match(html, /href="https:\/\/steamcommunity\.com\/profiles\/76561199191219060\/?"/);
});

test('renders the internal navigation links to the gallery and commissions pages', () => {
    assert.match(html, /href="\/gallery\/"/);
    assert.match(html, /href="\/commissions\/"/);
});

test('wraps the page in the pink page shell and Panel, and renders every section heading', () => {
    assert.match(html, /<div class="page-pink">/);
    assert.match(html, /<div class="panel-wrapper"><div class="panel">/);
    assert.match(text, /Character\sArchives/);
    assert.match(text, /Commissions/);
    assert.match(text, /Comms\sFeed/);
});

test('renders the profile header content with WaveText letter-wave markup on the h1', () => {
    assert.match(html, /<h1 class="wave-text" aria-label="[^"]*">.*<span class="wave-text-letter"/s);
    assert.match(text, /Sam/);
    assert.match(text, /Genius, billionaire, playboy, philanthropist, cat/);
});

test('renders empty gallery/commissions containers server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="character-gallery"/);
    assert.match(html, /id="commissions-preview"/);
});

test('renders the Bluesky feed heading and loading placeholder server-side', () => {
    assert.match(text, /Latest\sfrom\sBluesky/);
    assert.match(html, /id="bsky-feed"/);
    assert.match(html, /class="feed-loading-placeholder"/);
});
