import { usesSiteLayout } from '../site/sections.js';

/*
 * Where the fall and the settle start (page-layouts spec section 7). Between
 * two inner pages the site bar is shared and stays mounted, so only the page
 * below it may fall. Any navigation involving a page outside the layout (in
 * practice the hub) takes the whole tree, bar included.
 */
export function transitionScope(fromPath, toPath) {
    return usesSiteLayout(fromPath) && usesSiteLayout(toPath) ? 'page' : 'document';
}
