import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { routes } from '../routes.js';
import { buildEligiblePaths, isEligiblePath, titleForPath } from './paths.js';
import { describeClick, shouldIntercept } from './should-intercept.js';
import { collectPieces, domContext, pageRoot } from './collect-pieces.js';
import { runFall, cancelFall } from './fall.js';
import { settle } from './settle.js';

const ELIGIBLE = buildEligiblePaths(routes);

/*
 * The navigation seam (spec section 3).
 *
 * Every internal link on this site is a plain <a href>, so before this
 * component existed every click was a full document load and there was
 * nothing for the transition to hook into. A single capture-phase listener
 * on document turns an eligible click into a client-side navigation, and
 * takes over the two things the browser was doing for free: the title and
 * the scroll position. Both fail silently when wrong, so both are handled
 * here deliberately rather than left to be discovered later.
 *
 * Known limitation: back and forward navigate without the effect. This
 * catches clicks, and popstate ordering against React Router's own listener
 * is not guaranteed, so animating it would be racy.
 */
export default function PageTransitions() {
    const navigate = useNavigate();
    const location = useLocation();
    const transitioning = useRef(false);

    useEffect(() => {
        function onClick(event) {
            const described = describeClick(event, window.location);
            if (!described) return;
            described.isEligible = isEligiblePath(described.url.pathname, ELIGIBLE);
            if (!shouldIntercept(described)) return;

            event.preventDefault();

            // Read at transition time, never cached at load.
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!reduced) {
                const root = pageRoot();
                if (root) {
                    const pieces = collectPieces(root, domContext());
                    if (pieces.length > 0) runFall(pieces);
                }
            }

            transitioning.current = !reduced;
            navigate(`${described.url.pathname}${described.url.search}${described.url.hash}`);
        }

        document.addEventListener('click', onClick, true);
        return () => {
            document.removeEventListener('click', onClick, true);
            cancelFall();
        };
    }, [navigate]);

    useEffect(() => {
        const title = titleForPath(location.pathname, routes);
        if (title) document.title = title;

        window.scrollTo(0, 0);

        // Keyboard users must not be left holding focus on a detached clone.
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        if (!transitioning.current) return;
        transitioning.current = false;
        const root = pageRoot();
        if (root) settle(collectPieces(root, domContext()));
    }, [location.pathname]);

    return null;
}
