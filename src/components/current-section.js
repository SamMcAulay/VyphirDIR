import { firstVisible } from './first-visible.js';

/*
 * Terms index highlight decision (page-layouts spec 6.5, finding F2). Kept
 * pure and DOM-free so the controller's three rules are unit-testable on
 * their own. useCurrentSection wires scroll, hashchange and the
 * IntersectionObserver into these inputs:
 *   - atBottom: innerHeight + scrollY >= scrollHeight - 1
 *   - hashTarget: the id an index-link jump last landed on, which the hook
 *     clears once the user scrolls away from the position the jump landed at
 *   - visible: ids currently intersecting, as first-visible.js already uses
 *
 * Rule order: a live hashTarget wins over atBottom and over firstVisible --
 * at the bottom of the page, clicking "Delivery" must highlight Delivery,
 * not the last point. Otherwise atBottom picks the last id. Otherwise fall
 * back to firstVisible, as before this finding.
 */
export function currentSection(ids, { visible, atBottom, hashTarget } = {}) {
    if (hashTarget && ids.includes(hashTarget)) return hashTarget;
    if (atBottom) return ids.length ? ids[ids.length - 1] : null;
    return firstVisible(ids, visible ?? new Set());
}
