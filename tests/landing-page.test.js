import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Landing from '../src/pages/Landing.jsx';

const html = renderToStaticMarkup(<Landing />);

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

test('renders every section heading', () => {
    assert.match(html, /Character Archives/);
    assert.match(html, /Commissions/);
    assert.match(html, /Comms Feed/);
});

test('renders the profile header content', () => {
    assert.match(html, /<h1>Sam<\/h1>/);
    assert.match(html, /Genius, billionaire, playboy, philanthropist, cat/);
});

test('renders empty gallery/commissions containers server-side (populated client-side via fetch)', () => {
    assert.match(html, /id="character-gallery"/);
    assert.match(html, /id="commissions-preview"/);
});

test('renders the Bluesky feed loading placeholder server-side', () => {
    assert.match(html, /id="bsky-feed"/);
    assert.match(html, /class="feed-loading-placeholder"/);
});
