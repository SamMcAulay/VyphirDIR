import { useEffect, useState } from 'react';
import { nearestIndex } from '../components/strip-index.js';

/*
 * Overflow, the current dot and the one-time nudge for a horizontal strip
 * (page-layouts spec 6.3). All three reach the DOM as class names only: the
 * CSP silently drops inline styles. The nudge itself is a CSS animation, which
 * the stylesheet switches off under prefers-reduced-motion.
 */
export function useScrollStrip(ref, count) {
    const [overflowing, setOverflowing] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [nudge, setNudge] = useState(false);

    useEffect(() => {
        const strip = ref.current;
        if (!strip) return undefined;
        let frame = 0;
        let nudged = false;

        const measure = () => {
            const over = strip.scrollWidth > strip.clientWidth + 1;
            setOverflowing(over);
            if (over && !nudged) {
                nudged = true;
                setNudge(true);
            }
        };

        const update = () => {
            frame = 0;
            const first = strip.firstElementChild;
            if (!first) return;
            const offsets = Array.from(strip.children, (child) => child.offsetLeft - first.offsetLeft);
            setActiveIndex(nearestIndex(strip.scrollLeft, offsets, strip.scrollWidth - strip.clientWidth));
        };

        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        measure();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        observer?.observe(strip);
        strip.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            observer?.disconnect();
            strip.removeEventListener('scroll', onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [ref, count]);

    return { overflowing, activeIndex, nudge };
}
