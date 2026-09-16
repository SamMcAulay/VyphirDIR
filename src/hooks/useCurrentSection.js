import { useEffect, useState } from 'react';
import { currentSection } from '../components/current-section.js';

/*
 * The Terms index highlight (page-layouts spec 6.5, finding F2). The
 * IntersectionObserver's bottom margin trims the lower 40% of the viewport,
 * so a point counts as visible once it reaches the upper part of the screen
 * rather than the moment its top edge peeks in at the bottom -- which means
 * a short final point can never become the topmost-visible one. This hook
 * also tracks whether the page is scrolled to the bottom, and whether the
 * user just followed an index link or arrived on a #tos-N deep link, and
 * hands all three to the pure
 * currentSection() decision (src/components/current-section.js).
 *
 * Browser APIs only run inside the effect, guarded by typeof checks, so this
 * stays SSR-safe and safe to mount without a DOM (no jsdom in this repo's
 * test setup).
 */
export function useCurrentSection(ids) {
    const [current, setCurrent] = useState(ids[0] ?? null);
    const key = ids.join('|');

    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
        const list = key ? key.split('|') : [];
        const visible = new Set();
        let atBottom = false;
        let hashTarget = null;

        const isAtBottom = () => {
            const doc = document.documentElement;
            return window.innerHeight + window.scrollY >= doc.scrollHeight - 1;
        };

        const recompute = () => {
            const next = currentSection(list, { visible, atBottom, hashTarget });
            if (next) setCurrent(next);
        };

        const readHash = () => {
            const id = window.location.hash.slice(1);
            return list.includes(id) ? id : null;
        };

        /*
         * A followed link keeps its point highlighted until that point has
         * left the screen. Comparing scroll positions instead is fragile: late
         * layout (fonts settling) shortens the page and the browser clamps the
         * scroll, which would look like the user scrolling away.
         */
        const targetOnScreen = () => {
            const el = document.getElementById(hashTarget);
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.bottom > 0 && rect.top < window.innerHeight;
        };

        const onScroll = () => {
            atBottom = isAtBottom();
            if (hashTarget !== null && !targetOnScreen()) hashTarget = null;
            recompute();
        };

        const onHashChange = () => {
            const id = readHash();
            if (id === null) return;
            hashTarget = id;
            atBottom = isAtBottom();
            recompute();
        };

        let observer;
        if (typeof IntersectionObserver === 'function') {
            observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                recompute();
            }, { rootMargin: '0px 0px -40% 0px' });

            for (const id of list) {
                const el = document.getElementById(id);
                if (el) observer.observe(el);
            }
        }

        /*
         * A direct load of /tos/#tos-3 doesn't land on the point on its own,
         * because the points only exist once the fetch-driven content has
         * rendered. Scroll the named point into view once.
         */
        hashTarget = readHash();
        if (hashTarget !== null) {
            const el = document.getElementById(hashTarget);
            if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'instant' });
        }
        atBottom = isAtBottom();
        recompute();

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('hashchange', onHashChange);

        return () => {
            observer?.disconnect();
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('hashchange', onHashChange);
        };
    }, [key]);

    return current;
}
