import { MOTION } from './physics.js';

/*
 * The incoming settle (spec section 6). The arriving page is already in its
 * final position, so this animates the real elements rather than clones:
 * a short drift down from 24px above with a fade, staggered in DOM order,
 * over 320ms. That is comfortably shorter than the fall, so the two overlap
 * and arrival reads as one gesture rather than a second animation.
 */
const DISTANCE = 24;   // px
const DURATION = 320;  // ms

/*
 * Only the whole pieces. A transform on a real element moves its descendants
 * too, so animating an element and its ancestor would shift the same pixels
 * twice; whole pieces are mutually disjoint, shells are not.
 */
export function settleTargets(pieces) {
    return pieces.filter((piece) => piece.mode === 'whole').map((piece) => piece.el);
}

export function settle(pieces) {
    const targets = settleTargets(pieces);
    targets.forEach((el, index) => {
        if (typeof el.animate !== 'function') return;
        el.animate(
            [
                { opacity: 0, transform: `translateY(-${DISTANCE}px)` },
                { opacity: 1, transform: 'translateY(0)' },
            ],
            {
                duration: DURATION,
                delay: Math.min(index * MOTION.stagger, MOTION.staggerCap),
                easing: 'cubic-bezier(.2, .7, .3, 1)',
                fill: 'backwards',
            }
        );
    });
}
