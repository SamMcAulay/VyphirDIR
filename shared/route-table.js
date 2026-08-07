const ROUTES = [
    { pattern: /^\/$/, module: '/script.js' },
    { pattern: /^\/gallery\/$/, module: '/gallery/gallery-index.js' },
    { pattern: /^\/commissions\/$/, module: '/commissions/commissions.js' },
    { pattern: /^\/gallery\/[^/]+\/$/, module: '/gallery/character.js' },
];

export function matchRoute(pathname) {
    const route = ROUTES.find(({ pattern }) => pattern.test(pathname));
    return route ? { module: route.module } : null;
}
