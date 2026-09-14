/*
 * Pure path logic for the transition seam (spec section 3). No DOM, no
 * imports: everything here is table-driven off the `routes` array so there is
 * never a second copy of the site's path list.
 */

const CHARACTER_PATH = /^\/gallery\/[^/]+\/$/;

export function normalizePath(pathname) {
    if (!pathname) return '/';
    return `${pathname.replace(/\/+$/, '')}/`;
}

export function buildEligiblePaths(routes) {
    const eligible = new Set();
    for (const route of routes) {
        if (route.noTransition) continue;
        eligible.add(normalizePath(route.path));
    }
    return eligible;
}

export function isEligiblePath(pathname, eligible) {
    const normalized = normalizePath(pathname);
    if (eligible.has(normalized)) return true;
    return CHARACTER_PATH.test(normalized);
}

/*
 * The browser used to set the title for free on every full page load. Static
 * routes take it from the route table; character pages only know their title
 * once the character data resolves, so they set it themselves and this
 * returns null for them (spec section 3).
 */
export function titleForPath(pathname, routes) {
    const normalized = normalizePath(pathname);
    const route = routes.find((r) => normalizePath(r.path) === normalized);
    return route ? route.title : null;
}
