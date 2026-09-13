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

test('the gallery page still server-renders its panel with PageTransitions mounted', () => {
    const html = renderToStaticMarkup(
        <StaticRouter location="/gallery/">
            <App />
        </StaticRouter>
    );
    assert.match(html, /<div class="page-teal">/);
    assert.match(html, /<div class="panel-wrapper panel--wide"><div class="panel">/);
});

test('the admin route opts out of transitions', () => {
    const admin = routes.find((route) => route.path === '/admin/');
    assert.equal(admin.noTransition, true);
});
