import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from '../src/App.jsx';
import PageTransitions from '../src/transitions/PageTransitions.jsx';
import { routes } from '../src/routes.js';

test('PageTransitions renders no markup at all', () => {
    const html = renderToStaticMarkup(
        <StaticRouter location="/gallery/">
            <PageTransitions />
        </StaticRouter>
    );
    assert.equal(html, '');
});

test('App still server-renders every route with PageTransitions mounted', () => {
    for (const route of routes) {
        const html = renderToStaticMarkup(
            <StaticRouter location={route.path}>
                <App />
            </StaticRouter>
        );
        assert.ok(html.length > 0, route.path);
    }
});

test('inner pages render inside the site layout under the bar', () => {
    for (const [path, colour] of [['/gallery/', 'teal'], ['/commissions/', 'honey'], ['/queue/', 'tabby'], ['/tos/', 'lavender']]) {
        const html = renderToStaticMarkup(
            <StaticRouter location={path}>
                <App />
            </StaticRouter>
        );
        assert.match(html, new RegExp(`<div class="site">.*<header class="site-bar site-bar--${colour}">`, 's'), path);
        assert.match(html, /<main class="site-page"><div class="page-/, path);
    }
});

test('the hub and admin render without the site bar', () => {
    for (const path of ['/', '/admin/']) {
        const html = renderToStaticMarkup(
            <StaticRouter location={path}>
                <App />
            </StaticRouter>
        );
        assert.doesNotMatch(html, /site-bar/, path);
    }
});

test('the admin route opts out of transitions', () => {
    const admin = routes.find((route) => route.path === '/admin/');
    assert.equal(admin.noTransition, true);
});
