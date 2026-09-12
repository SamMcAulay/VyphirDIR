import { MOTION, motionFor, step, decompose } from './physics.js';

/*
 * Clone preparation, the overlay and the animation loop (spec section 5).
 *
 * CSP: the site ships no 'unsafe-inline' for styles, and setAttribute('style')
 * is the one write the policy blocks. Everything here goes through the CSSOM
 * property setter. Do not "simplify" any of this into setAttribute.
 */

/*
 * A clone is lifted out of its ancestors, so every contextual rule that
 * styled it through a descendant selector stops matching. Copying the
 * computed value of these properties onto the clone's root element keeps it
 * looking like what it replaced. Descendants inside a whole clone still have
 * their ancestors, so they need nothing.
 */
const COPIED = [
    'color', 'background-color', 'background-image', 'background-position',
    'background-size', 'background-repeat', 'background-clip',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-right-radius', 'border-bottom-left-radius',
    'box-shadow', 'opacity', 'filter', 'clip-path', 'overflow',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
    'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line',
    'text-decoration-color', 'white-space', 'word-break',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'display', 'box-sizing', 'fill', 'stroke', 'object-fit', 'object-position',
];

let active = null;

/*
 * Ids are rewritten rather than stripped. Landing's preview blobs are
 * <clipPath id> referenced by clipPath="url(#id)"; stripping the id leaves a
 * dangling reference and the art falls unclipped. Rewriting keeps the
 * reference working and still leaves no duplicate id in the document.
 */
function rekeyIds(clone, index) {
    const nodes = [clone, ...clone.querySelectorAll('[id]')];
    const mapping = new Map();
    let n = 0;
    for (const node of nodes) {
        const id = node.id;
        if (!id) continue;
        const replacement = `gd-${index}-${n++}`;
        mapping.set(id, replacement);
        node.id = replacement;
    }
    if (mapping.size === 0) return;

    const all = [clone, ...clone.querySelectorAll('*')];
    for (const node of all) {
        for (const attr of Array.from(node.attributes)) {
            if (attr.name === 'id' || attr.name === 'style') continue;
            let value = attr.value;
            let changed = false;
            for (const [from, to] of mapping) {
                const url = `url(#${from})`;
                if (value.includes(url)) {
                    value = value.split(url).join(`url(#${to})`);
                    changed = true;
                }
                if (value === `#${from}`) {
                    value = `#${to}`;
                    changed = true;
                }
            }
            if (changed) node.setAttribute(attr.name, value);
        }
    }
}

function scrub(clone) {
    const all = [clone, ...clone.querySelectorAll('*')];
    for (const node of all) {
        node.removeAttribute('style');
        if (node.hasAttribute('name')) node.removeAttribute('name');
    }
}

/*
 * getComputedStyle(el).width/.height always report the content-box size,
 * regardless of box-sizing -- but this site's `* { box-sizing: border-box }`
 * means the clone (an ordinary border-box element) must be sized in
 * border-box terms to match, or every padded/bordered piece clones smaller
 * than the original. Built from computed padding/border rather than
 * offsetWidth/offsetHeight so it also works for the SVG pieces the walk can
 * emit (.hub-blob) -- offsetWidth is undefined on SVGElement.
 */
function borderBoxSize(computed) {
    const width =
        (parseFloat(computed.width) || 0) +
        (parseFloat(computed.paddingLeft) || 0) +
        (parseFloat(computed.paddingRight) || 0) +
        (parseFloat(computed.borderLeftWidth) || 0) +
        (parseFloat(computed.borderRightWidth) || 0);
    const height =
        (parseFloat(computed.height) || 0) +
        (parseFloat(computed.paddingTop) || 0) +
        (parseFloat(computed.paddingBottom) || 0) +
        (parseFloat(computed.borderTopWidth) || 0) +
        (parseFloat(computed.borderBottomWidth) || 0);
    return { width, height };
}

/*
 * The axis-aligned box that a `width` x `height` rectangle produces once
 * rotated by `rotation` degrees and scaled by (scaleX, scaleY) about its own
 * centre -- the standard rotated-bounding-box formula. Used to find how much
 * of the measured rect's size is the element's own transform versus
 * whatever its ancestors contributed.
 */
function ownAabbSize(width, height, rotation, scaleX, scaleY) {
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return {
        width: width * scaleX * cos + height * scaleY * sin,
        height: width * scaleX * sin + height * scaleY * cos,
    };
}

function prepare(piece, index) {
    const computed = window.getComputedStyle(piece.el);
    const clone = piece.el.cloneNode(true);

    if (piece.mode === 'shell') {
        while (clone.firstElementChild) clone.removeChild(clone.firstElementChild);
    }

    scrub(clone);
    rekeyIds(clone, index);
    clone.classList.add('gd-piece');

    for (const property of COPIED) {
        const value = computed.getPropertyValue(property);
        if (value) clone.style.setProperty(property, value);
    }

    const border = borderBoxSize(computed);
    const width = border.width || piece.rect.width;
    const height = border.height || piece.rect.height;
    const { rotation, scaleX, scaleY } = decompose(computed.transform);

    /*
     * decompose() reads only the element's own `transform`; it knows nothing
     * of ancestor transforms. piece.rect, from getBoundingClientRect, bakes
     * in every ancestor transform between this element and the viewport --
     * the landing hub scales .hub-anchor per breakpoint while its .hub-item
     * children are the pieces, so their measured rect is scaled well beyond
     * what their own transform accounts for. ownAabb is the box the
     * element's own rotation/scale alone would produce; the ratio of the
     * measured rect to that box is the residual ancestor scale. This
     * assumes ancestor scaling is uniform, the only kind this site uses --
     * width and height would disagree under non-uniform ancestor scaling,
     * and this does not attempt to detect that case.
     */
    const ownAabb = ownAabbSize(width, height, rotation, scaleX, scaleY);
    const ancestorScale =
        ownAabb.width > 0.01 && ownAabb.height > 0.01
            ? (piece.rect.width / ownAabb.width + piece.rect.height / ownAabb.height) / 2
            : 1;
    const finalScaleX = scaleX * ancestorScale;
    const finalScaleY = scaleY * ancestorScale;

    // Centre the untransformed box inside the measured bounding rect, then
    // put the original rotation and scale back (see physics.decompose).
    const left = piece.rect.left + (piece.rect.width - width) / 2;
    const top = piece.rect.top + (piece.rect.height - height) / 2;

    clone.style.position = 'absolute';
    clone.style.margin = '0';
    clone.style.left = `${left}px`;
    clone.style.top = `${top}px`;
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.willChange = 'transform';

    const base = `rotate(${rotation}deg) scale(${finalScaleX}, ${finalScaleY})`;
    clone.style.transform = base;

    return { clone, base, rect: { top, height } };
}

export function cancelFall() {
    if (active) active.cancel();
}

export function runFall(pieces, options = {}) {
    const raf = options.raf || window.requestAnimationFrame.bind(window);
    const now = options.now || (() => performance.now());

    cancelFall();

    const overlay = document.createElement('div');
    overlay.className = 'gd-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;

    const bodies = [];
    pieces.forEach((piece, index) => {
        const { clone, base, rect } = prepare(piece, index);
        const motion = motionFor(index);
        bodies.push({
            clone,
            base,
            bottom: rect.top + rect.height,
            state: { x: 0, y: 0, vy: motion.vy, vx: motion.vx, rot: 0, omega: motion.omega },
            delay: motion.delay,
            retired: false,
        });
        overlay.appendChild(clone);
    });

    document.body.appendChild(overlay);

    const started = now();
    let last = started;
    let frame = 0;
    let live = bodies.length;

    function destroy() {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        overlay.remove();
        if (active && active.overlay === overlay) active = null;
    }

    function tick() {
        const time = now();
        const dt = Math.min((time - last) / 1000, MOTION.maxDt);
        last = time;
        const elapsed = time - started;

        for (const body of bodies) {
            if (body.retired || elapsed < body.delay) continue;
            step(body.state, dt);
            body.clone.style.transform =
                `translate(${body.state.x}px, ${body.state.y}px) rotate(${body.state.rot}deg) ${body.base}`;
            if (body.bottom + body.state.y > window.innerHeight + 200) {
                body.retired = true;
                body.clone.remove();
                live -= 1;
            }
        }

        // The timeout is a safety net: a stuck loop must never leave an inert
        // overlay sitting on top of a live page.
        if (live <= 0 || elapsed > MOTION.timeout) {
            destroy();
            return;
        }
        frame = raf(tick);
    }

    frame = raf(tick);
    active = { overlay, cancel: destroy };
    return active;
}
