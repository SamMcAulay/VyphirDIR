import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTION, motionFor, step, decompose } from '../src/transitions/physics.js';

test('motionFor is deterministic for a given index', () => {
    assert.deepEqual(motionFor(7), motionFor(7));
    assert.notDeepEqual(motionFor(7), motionFor(8));
});

test('motionFor stays inside the tuned ranges', () => {
    for (let i = 0; i < 200; i++) {
        const m = motionFor(i);
        assert.ok(m.vy >= MOTION.vy0Min && m.vy <= MOTION.vy0Max, `vy ${m.vy}`);
        assert.ok(m.vx >= MOTION.vxMin && m.vx <= MOTION.vxMax, `vx ${m.vx}`);
        assert.ok(m.omega >= MOTION.omegaMin && m.omega <= MOTION.omegaMax, `omega ${m.omega}`);
    }
});

test('motionFor staggers pieces and caps the total stagger', () => {
    assert.equal(motionFor(0).delay, 0);
    assert.equal(motionFor(1).delay, MOTION.stagger);
    assert.equal(motionFor(149).delay, MOTION.staggerCap);
});

test('step accelerates downward and integrates position', () => {
    const state = { x: 0, y: 0, vy: 0, vx: 100, rot: 0, omega: 90 };
    step(state, 0.5);
    assert.equal(state.vy, MOTION.gravity * 0.5);
    assert.equal(state.y, MOTION.gravity * 0.5 * 0.5);
    assert.equal(state.x, 50);
    assert.equal(state.rot, 45);
});

test('decompose reads rotation and scale out of a matrix', () => {
    const half = Math.SQRT1_2;
    const { rotation, scaleX, scaleY } = decompose(`matrix(${half}, ${half}, ${-half}, ${half}, 10, 20)`);
    assert.ok(Math.abs(rotation - 45) < 1e-6);
    assert.ok(Math.abs(scaleX - 1) < 1e-6);
    assert.ok(Math.abs(scaleY - 1) < 1e-6);
});

test('decompose treats none and unparseable values as identity', () => {
    assert.deepEqual(decompose('none'), { rotation: 0, scaleX: 1, scaleY: 1 });
    assert.deepEqual(decompose(''), { rotation: 0, scaleX: 1, scaleY: 1 });
    assert.deepEqual(decompose('matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)'), { rotation: 0, scaleX: 1, scaleY: 1 });
});
