import test from 'node:test';
import assert from 'node:assert/strict';
import { act, create } from 'react-test-renderer';
import { usePopClick } from '../src/hooks/usePopClick.js';

function TestComponent({ onRender }) {
    const pop = usePopClick(50);
    onRender(pop);
    return null;
}

test('starts with no pop-active class', () => {
    let latest;
    act(() => {
        create(<TestComponent onRender={(pop) => { latest = pop; }} />);
    });
    assert.equal(latest.className, '');
});

test('sets pop-active immediately after onPointerUp', () => {
    let latest;
    act(() => {
        create(<TestComponent onRender={(pop) => { latest = pop; }} />);
    });
    act(() => {
        latest.onPointerUp();
    });
    assert.equal(latest.className, 'pop-active');
});

test('clears pop-active after the duration elapses', async () => {
    let latest;
    act(() => {
        create(<TestComponent onRender={(pop) => { latest = pop; }} />);
    });
    act(() => {
        latest.onPointerUp();
    });
    await new Promise((resolve) => {
        act(() => {
            setTimeout(resolve, 80);
        });
    });
    assert.equal(latest.className, '');
});
