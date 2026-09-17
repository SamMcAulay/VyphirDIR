import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import Landing, { PreviewBlob } from '../src/pages/Landing.jsx';

const POOLS = { gallery: ['g1.png', 'g2.png'], commissions: ['c1.png', 'c2.png'] };

test('renders exactly eight nav links in spec order', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    const hrefs = [...html.matchAll(/<a class="hub-item[^"]*"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, [
        '/gallery/',
        '/commissions/',
        'https://www.instagram.com/vyphir',
        'https://x.com/Vyphirr',
        'https://bsky.app/profile/samisaderp.bsky.social',
        'https://t.me/Samisaderp#',
        'https://toyhou.se/samisaderp/characters',
        'https://steamcommunity.com/profiles/76561199191219060/',
    ]);
});

test('wraps all eight nav links inside the nav element', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    const nav = html.match(/<nav class="hub-nav">([\s\S]*?)<\/nav>/);
    assert.ok(nav, 'expected a <nav class="hub-nav"> element');
    assert.equal((nav[1].match(/<a class="hub-item/g) || []).length, 8);
    // ...and none stranded outside it.
    assert.equal((html.match(/<a class="hub-item/g) || []).length, 8);
});

// The hub-item--<key> modifier is the ONLY link between this markup and the
// per-item geometry in public/styles.css (left/top/--rot/--fs/--c/--stroke/
// --blobw/--blobx). The site's CSP has no 'unsafe-inline', so inline style
// attributes are silently dropped and cannot be used instead. If this class
// ever stops being emitted, all eight items collapse onto the hub anchor
// with no other test noticing -- hence an exact, ordered assertion.
test('emits the geometry-keying hub-item modifier class for every item, in order', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    const classes = [...html.matchAll(/<a class="hub-item (hub-item--[a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(classes, [
        'hub-item--gallery',
        'hub-item--commissions',
        'hub-item--instagram',
        'hub-item--twitter',
        'hub-item--bluesky',
        'hub-item--telegram',
        'hub-item--toyhouse',
        'hub-item--steam',
    ]);
});

test('renders a single top-level heading naming the site', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    // Matches the <title> for '/' in src/routes.js.
    assert.match(html, /<h1 class="sr-only">Sam(&#x27;|')s Directory<\/h1>/);
});

test('the preview tints use the per-item opacity from the spec', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    const opacities = [...html.matchAll(/<rect [^>]*opacity="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(opacities, ['.34', '.32']);
});

test('external links open in a new tab with a safe rel', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    const externals = html.match(/<a class="hub-item[^"]*"[^>]*href="https:\/\/[^"]+"[^>]*>/g) || [];
    assert.equal(externals.length, 6);
    for (const tag of externals) {
        assert.match(tag, /target="_blank"/);
        assert.match(tag, /rel="noopener noreferrer"/);
    }
});

test('the photo is a link home labelled Home', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    assert.match(html, /<a class="hub-photo" href="\/" aria-label="Home">/);
});

/*
 * The four images per blob are drawn at random after mount, so the server
 * markup must not contain any: a draw during render would differ between the
 * server and the client and break hydration.
 */
test('server markup draws no preview art yet, but keeps the preview blobs', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    assert.doesNotMatch(html, /<image /);
    assert.equal((html.match(/<clipPath id="hub-clip-/g) || []).length, 2);
});

test('a preview blob tiles the images it is given', () => {
    const item = { key: 'gallery', blob: 1, tint: 'var(--slime-teal-light)', tintOpacity: '.34' };
    const html = renderToStaticMarkup(<PreviewBlob item={item} images={['g1.png', 'g2.png']} />);
    for (const url of ['g1.png', 'g2.png']) assert.match(html, new RegExp(`<image href="${url}"`));
});

test('falls back to a flat blob when a pool is empty', () => {
    const html = renderToStaticMarkup(<Landing pools={{ gallery: [], commissions: [] }} />);
    assert.doesNotMatch(html, /<image /);
    assert.doesNotMatch(html, /hub-clip-/);
});

test('decorative slabs and blobs are hidden from assistive tech', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    const slabs = html.match(/<div class="hub-slab[^"]*"[^>]*>/g) || [];
    assert.equal(slabs.length, 3);
    for (const tag of slabs) assert.match(tag, /aria-hidden="true"/);
    for (const tag of html.match(/<svg class="hub-blob"[^>]*>/g) || []) {
        assert.match(tag, /aria-hidden="true"/);
    }
});

test('no longer renders the Panel wrapper, the bluesky feed or the preview strips', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    assert.doesNotMatch(html, /panel-wrapper/);
    // Note: not a bare /bsky/i check — the required Bluesky nav link
    // (https://bsky.app/profile/samisaderp.bsky.social) legitimately contains
    // "bsky". These target BlueskyFeed's actual rendered output instead:
    // renderToStaticMarkup never runs its useEffect fetch, so mounting it
    // would always SSR the loading-placeholder markup.
    assert.doesNotMatch(html, /feed-loading-placeholder/);
    assert.doesNotMatch(html, /gallery-container/);
    assert.doesNotMatch(html, /commissions-preview-grid/);
});

/*
 * The nav words go through WaveText so they hop letter-by-letter on hover,
 * the same treatment the page headings get. Splitting a word into one span
 * per letter throws away its text node, so the link's accessible name now
 * rests entirely on the wrapper's aria-label -- WaveText marks every letter
 * span aria-hidden. If that label ever stops being emitted, all six external
 * links become unnamed to a screen reader and nothing else here would fail.
 */
test('renders every nav word as wave letters that keep the link its name', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    const labels = ['Gallery', 'Commissions', 'Instagram', 'Twitter', 'Bluesky', 'Telegram', 'Toyhouse', 'Steam'];

    const words = [...html.matchAll(/<span class="wave-text hub-word" aria-label="([^"]+)">/g)].map((m) => m[1]);
    assert.deepEqual(words, labels);

    for (const label of labels) {
        const word = html.match(new RegExp(`<span class="wave-text hub-word" aria-label="${label}">([\\s\\S]*?)</span></a>`));
        assert.ok(word, `expected a wave-text wrapper for ${label}`);
        const letters = word[1].match(/<span class="wave-text-letter" aria-hidden="true">/g) || [];
        assert.equal(letters.length, label.length, `${label} should split into ${label.length} letters`);
    }
});

/*
 * The stagger and the hover trigger both live in public/styles.css, keyed by
 * :nth-child() and .hub-item:hover. This site's CSP drops inline style
 * attributes silently, so a style prop here would read as working code and
 * do nothing in the browser -- which is exactly how the wave shipped broken
 * once before.
 */
test('emits no inline style attribute on the hub, which the CSP would silently drop', () => {
    const html = renderToStaticMarkup(<Landing pools={POOLS} />);
    assert.doesNotMatch(html, /style=/);
});
