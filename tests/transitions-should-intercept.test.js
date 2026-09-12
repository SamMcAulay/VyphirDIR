import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldIntercept, describeClick } from '../src/transitions/should-intercept.js';

const ORIGIN = 'https://vyphir.example';

function click(overrides = {}) {
    const { anchor = {}, href = '/gallery/', ...rest } = overrides;
    return {
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        anchor: { download: null, target: '', rel: '', ...anchor },
        url: new URL(href, `${ORIGIN}/`),
        currentOrigin: ORIGIN,
        currentPathname: '/',
        isEligible: true,
        ...rest,
    };
}

test('intercepts a plain left click on an internal link', () => {
    assert.equal(shouldIntercept(click()), true);
});

test('does not intercept when a modifier key is held', () => {
    for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
        assert.equal(shouldIntercept(click({ [key]: true })), false, key);
    }
});

test('does not intercept middle or right click', () => {
    assert.equal(shouldIntercept(click({ button: 1 })), false);
    assert.equal(shouldIntercept(click({ button: 2 })), false);
});

test('does not intercept an already-prevented event', () => {
    assert.equal(shouldIntercept(click({ defaultPrevented: true })), false);
});

test('does not intercept a download link', () => {
    assert.equal(shouldIntercept(click({ anchor: { download: '' } })), false);
});

test('does not intercept a link targeted at another browsing context', () => {
    assert.equal(shouldIntercept(click({ anchor: { target: '_blank' } })), false);
    assert.equal(shouldIntercept(click({ anchor: { target: '_self' } })), true);
    assert.equal(shouldIntercept(click({ anchor: { target: '' } })), true);
});

test('does not intercept a link marked rel=external', () => {
    assert.equal(shouldIntercept(click({ anchor: { rel: 'noopener external' } })), false);
});

test('does not intercept any of the hub social links', () => {
    const socials = [
        'https://www.instagram.com/vyphir',
        'https://x.com/Vyphirr',
        'https://bsky.app/profile/samisaderp.bsky.social',
        'https://t.me/Samisaderp#',
        'https://toyhou.se/samisaderp/characters',
        'https://steamcommunity.com/profiles/76561199191219060/',
    ];
    for (const href of socials) {
        assert.equal(shouldIntercept(click({ href, isEligible: false })), false, href);
    }
});

test('does not intercept a cross-origin link even when the path is eligible', () => {
    assert.equal(shouldIntercept(click({ href: 'https://evil.example/gallery/', isEligible: true })), false);
});

test('does not intercept an ineligible path such as /admin/ or /i/<id>', () => {
    assert.equal(shouldIntercept(click({ href: '/admin/', isEligible: false })), false);
    assert.equal(shouldIntercept(click({ href: '/i/abc123', isEligible: false })), false);
});

test('does not intercept an unknown path', () => {
    assert.equal(shouldIntercept(click({ href: '/nope/', isEligible: false })), false);
});

test('does not intercept a same-page fragment', () => {
    assert.equal(shouldIntercept(click({ href: '/#section', currentPathname: '/' })), false);
});

test('intercepts a hash link that also changes the pathname', () => {
    assert.equal(shouldIntercept(click({ href: '/gallery/#top', currentPathname: '/' })), true);
});

test('does not intercept when there is no anchor', () => {
    assert.equal(shouldIntercept(null), false);
});

test('describeClick finds the anchor from a nested target', () => {
    const anchor = {
        getAttribute: (name) => (name === 'href' ? '/queue' : null),
        hasAttribute: (name) => name === 'href',
        download: null,
        target: '',
        rel: '',
    };
    const nested = { closest: (selector) => (selector === 'a[href]' ? anchor : null) };
    const described = describeClick(
        { target: nested, defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
        { origin: ORIGIN, pathname: '/', href: `${ORIGIN}/` }
    );
    assert.equal(described.url.pathname, '/queue');
    assert.equal(described.currentOrigin, ORIGIN);
});

test('describeClick returns null when the click is not inside an anchor', () => {
    const described = describeClick(
        { target: { closest: () => null }, defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false },
        { origin: ORIGIN, pathname: '/', href: `${ORIGIN}/` }
    );
    assert.equal(described, null);
});
