import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath, buildEligiblePaths, isEligiblePath, titleForPath } from '../src/transitions/paths.js';
import { routes } from '../src/routes.js';

test('normalizePath adds exactly one trailing slash', () => {
    assert.equal(normalizePath('/queue'), '/queue/');
    assert.equal(normalizePath('/queue/'), '/queue/');
    assert.equal(normalizePath('/queue//'), '/queue/');
    assert.equal(normalizePath('/'), '/');
    assert.equal(normalizePath(''), '/');
});

test('buildEligiblePaths includes every transitioning route', () => {
    const eligible = buildEligiblePaths(routes);
    assert.ok(eligible.has('/'));
    assert.ok(eligible.has('/gallery/'));
    assert.ok(eligible.has('/commissions/'));
    assert.ok(eligible.has('/tos/'));
    assert.ok(eligible.has('/queue/'));
});

test('buildEligiblePaths excludes routes flagged noTransition', () => {
    const eligible = buildEligiblePaths([
        { path: '/', title: 'Home' },
        { path: '/admin/', title: 'Admin', noTransition: true },
    ]);
    assert.ok(eligible.has('/'));
    assert.ok(!eligible.has('/admin/'));
});

test('isEligiblePath accepts a static route with or without its trailing slash', () => {
    const eligible = buildEligiblePaths(routes);
    assert.equal(isEligiblePath('/queue', eligible), true);
    assert.equal(isEligiblePath('/tos', eligible), true);
});

test('isEligiblePath accepts a single-segment character page', () => {
    const eligible = buildEligiblePaths(routes);
    assert.equal(isEligiblePath('/gallery/vyphir/', eligible), true);
    assert.equal(isEligiblePath('/gallery/vyphir', eligible), true);
});

test('isEligiblePath rejects deeper gallery paths, unknown paths and permalinks', () => {
    const eligible = buildEligiblePaths(routes);
    assert.equal(isEligiblePath('/gallery/vyphir/extra/', eligible), false);
    assert.equal(isEligiblePath('/nope/', eligible), false);
    assert.equal(isEligiblePath('/i/abc123', eligible), false);
});

test('isEligiblePath rejects the admin route', () => {
    const eligible = buildEligiblePaths([
        { path: '/', title: 'Home' },
        { path: '/admin/', title: 'Admin', noTransition: true },
    ]);
    assert.equal(isEligiblePath('/admin/', eligible), false);
});

test('titleForPath returns the route table title for every static route', () => {
    for (const route of routes) {
        assert.equal(titleForPath(route.path, routes), route.title);
    }
});

test('titleForPath returns null for a character page, which sets its own title', () => {
    assert.equal(titleForPath('/gallery/vyphir/', routes), null);
});
