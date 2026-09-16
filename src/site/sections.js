import { normalizePath } from '../transitions/paths.js';

/*
 * The site bar's sections (page-layouts spec section 3.1). The hrefs are
 * checked against the route table's `siteLayout` flags in
 * tests/site-sections.test.js, so the two lists cannot drift apart.
 */
export const SECTIONS = [
    { key: 'gallery', label: 'Gallery', shortLabel: 'Gallery', name: 'Gallery', href: '/gallery/', colour: 'teal', blob: 1 },
    { key: 'commissions', label: 'Commissions', shortLabel: 'Comms', name: 'Commissions', href: '/commissions/', colour: 'honey', blob: 3 },
    { key: 'queue', label: 'Queue', shortLabel: 'Queue', name: 'Queue', href: '/queue/', colour: 'tabby', blob: 2 },
    { key: 'tos', label: 'Terms', shortLabel: 'Terms', name: 'Terms of Service', href: '/tos/', colour: 'lavender', blob: 4 },
];

const CHARACTER_PATH = /^\/gallery\/[^/]+\/$/;

export function sectionForPath(pathname) {
    const normalized = normalizePath(pathname);
    if (CHARACTER_PATH.test(normalized)) return 'gallery';
    const section = SECTIONS.find((s) => s.href === normalized);
    return section ? section.key : null;
}

export function usesSiteLayout(pathname) {
    return sectionForPath(pathname) !== null;
}

export function sectionByKey(key) {
    return SECTIONS.find((s) => s.key === key) || null;
}
