/*
 * Closed-form motion for the fall (spec section 5). Pieces accelerate,
 * drift and tumble; they never collide, bounce or rest, so this is a handful
 * of numbers rather than a physics engine.
 *
 * Starting values from the spec's table. Tune here, not in fall.js.
 */
export const MOTION = {
    gravity: 2000,      // px/s^2
    vy0Min: -60,        // px/s, upward kick
    vy0Max: 0,
    vxMin: -40,         // px/s, horizontal drift
    vxMax: 40,
    omegaMin: -180,     // deg/s
    omegaMax: 180,
    stagger: 18,        // ms between pieces
    staggerCap: 250,    // ms, total
    maxDt: 0.032,       // s; a backgrounded tab must not teleport everything
    timeout: 3000,      // ms hard stop
};

/*
 * Per-piece randomness is seeded from the piece's index, so a given page
 * falls the same way every time and a visual regression is reproducible.
 * mulberry32, inlined -- no dependency for six numbers.
 */
function seeded(index) {
    let a = (index + 1) * 0x9e3779b9;
    return function next() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function between(random, min, max) {
    return min + random() * (max - min);
}

export function motionFor(index) {
    const random = seeded(index);
    return {
        vy: between(random, MOTION.vy0Min, MOTION.vy0Max),
        vx: between(random, MOTION.vxMin, MOTION.vxMax),
        omega: between(random, MOTION.omegaMin, MOTION.omegaMax),
        delay: Math.min(index * MOTION.stagger, MOTION.staggerCap),
    };
}

export function step(state, dt) {
    state.vy += MOTION.gravity * dt;
    state.y += state.vy * dt;
    state.x += state.vx * dt;
    state.rot += state.omega * dt;
}

/*
 * A clone placed at its measured bounding rect loses whatever transform the
 * stylesheet gave the original -- the hub items are rotated, so without this
 * every word snaps upright on the first frame. The rect is the axis-aligned
 * box of the rotated element, so the clone is sized from its untransformed
 * layout box, centred inside that rect, and re-rotated: exact for rotation
 * and scale about the default centre origin.
 */
export function decompose(matrix) {
    const identity = { rotation: 0, scaleX: 1, scaleY: 1 };
    const match = /^matrix\(([^)]+)\)$/.exec(String(matrix).trim());
    if (!match) return identity;
    const [a, b, c, d] = match[1].split(',').map((n) => parseFloat(n));
    if ([a, b, c, d].some((n) => !Number.isFinite(n))) return identity;
    return {
        rotation: (Math.atan2(b, a) * 180) / Math.PI,
        scaleX: Math.hypot(a, b),
        scaleY: Math.hypot(c, d),
    };
}
