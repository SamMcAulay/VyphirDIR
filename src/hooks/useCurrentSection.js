import { useEffect, useState } from 'react';
import { firstVisible } from '../components/first-visible.js';

/*
 * The Terms index highlight (page-layouts spec 6.5). The observer's bottom
 * margin trims the lower 40% of the viewport, so a point counts as current
 * once it reaches the upper part of the screen rather than the moment its top
 * edge peeks in at the bottom.
 */
export function useCurrentSection(ids) {
    const [current, setCurrent] = useState(ids[0] ?? null);
    const key = ids.join('|');

    useEffect(() => {
        if (typeof IntersectionObserver !== 'function') return undefined;
        const list = key ? key.split('|') : [];
        const visible = new Set();
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) visible.add(entry.target.id);
                else visible.delete(entry.target.id);
            }
            const next = firstVisible(list, visible);
            if (next) setCurrent(next);
        }, { rootMargin: '0px 0px -40% 0px' });

        for (const id of list) {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, [key]);

    return current;
}
