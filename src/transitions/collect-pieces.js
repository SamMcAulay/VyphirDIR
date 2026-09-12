/*
 * The piece walk (spec section 4). DOM-dependent, but every accessor is
 * injected through `ctx` so the walk itself is exercised by fake nodes in
 * tests -- this repo has no jsdom and deliberately adds none.
 */

export const MAX_PIECES = 150;
const MAX_DEPTH = 12;
const ALWAYS_PAINTS = new Set(['IMG', 'SVG', 'CANVAS', 'VIDEO']);
const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

function hasOpaqueBackground(color) {
    if (!color || color === 'transparent') return false;
    const match = /^rgba?\(([^)]+)\)$/.exec(color.trim());
    if (!match) return true;
    const parts = match[1].split(',').map((p) => parseFloat(p));
    return parts.length < 4 || parts[3] > 0;
}

function hasBorder(style) {
    return SIDES.some((side) => {
        const width = parseFloat(style[`border${side}Width`]) || 0;
        const lineStyle = style[`border${side}Style`];
        return width > 0 && lineStyle !== 'none' && lineStyle !== 'hidden';
    });
}

/*
 * An element paints if it puts pixels on the page by itself. A panel has a
 * background, a border and a shadow, so it paints and therefore falls as its
 * own empty shell while its contents fall separately -- that is what stops
 * the whole page sliding away as one slab.
 */
export function paints(style, tagName) {
    if (ALWAYS_PAINTS.has(String(tagName).toUpperCase())) return true;
    if (hasOpaqueBackground(style.backgroundColor)) return true;
    if (style.backgroundImage && style.backgroundImage !== 'none') return true;
    if (hasBorder(style)) return true;
    if (style.boxShadow && style.boxShadow !== 'none') return true;
    const outlineStyle = style.outlineStyle;
    if (outlineStyle && outlineStyle !== 'none' && (parseFloat(style.outlineWidth) || 0) > 0) return true;
    return false;
}

/*
 * Two different exclusions, handled differently on purpose. An element
 * entirely outside the viewport would fall unseen, and so would everything
 * inside it, so its whole subtree is dropped. A zero-area element is merely
 * not worth cloning -- a wrapper collapsed to nothing can still hold visible
 * children -- so it is skipped but descended into.
 */
function walk(el, ctx, depth, out) {
    const rect = ctx.getRect(el);
    const hasArea = rect.width > 0 && rect.height > 0;
    const onscreen = rect.top < ctx.viewportHeight && rect.left < ctx.viewportWidth
        && rect.top + rect.height > 0 && rect.left + rect.width > 0;
    if (hasArea && !onscreen) return;
    const emit = hasArea && onscreen;

    const children = Array.from(el.children || []);

    if (depth <= 0 || children.length === 0) {
        if (emit) out.push({ el, rect, mode: 'whole' });
        return;
    }

    if (emit && paints(ctx.getStyle(el), el.tagName)) {
        out.push({ el, rect, mode: 'shell' });
    }

    for (const child of children) {
        walk(child, ctx, depth - 1, out);
    }
}

/*
 * Animating several hundred cloned nodes drops frames on a phone, and a
 * stuttering transition looks worse than none. If a full-depth walk blows the
 * ceiling, re-walk one level shallower and try again; at depth 1 the page's
 * top-level children simply fall as they are.
 */
export function collectPieces(root, ctx) {
    const maxPieces = ctx.maxPieces ?? MAX_PIECES;
    const maxDepth = ctx.maxDepth ?? MAX_DEPTH;
    let pieces = [];
    for (let depth = maxDepth; depth >= 1; depth--) {
        pieces = [];
        walk(root, ctx, depth, pieces);
        if (pieces.length <= maxPieces) return pieces;
    }
    return pieces;
}

export function pageRoot() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('root')?.firstElementChild ?? null;
}

export function domContext() {
    return {
        getStyle: (el) => window.getComputedStyle(el),
        getRect: (el) => el.getBoundingClientRect(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
    };
}
