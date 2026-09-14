import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { routes } from '../routes.js';
import { buildEligiblePaths, isEligiblePath, normalizePath, titleForPath } from './paths.js';
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
    // Which normalised pathname the next arrival should settle for, or null
    // if the next arrival should not settle at all (reduced motion, or no
    // intercepted navigation happened). Keyed on the *target* path rather
    // than a bare boolean so a stray arrival -- Back/Forward, or a click that
    // bailed out below -- can never latch a settle that was never earned:
    // the arrival effect only fires settle() when its own pathname is the
    // one this ref recorded, and it clears the ref unconditionally either
    // way, so nothing can carry over into a later, unrelated arrival.
    const pendingSettleFor = useRef(null);
    // Whether the next arrival should reset scroll. Separate from the ref
    // above because scroll-to-top happens on every intercepted navigation
    // regardless of reduced motion, while settle only happens when motion is
    // not reduced (controller ruling: settle is skipped entirely, not
    // shortened, under prefers-reduced-motion).
    const pendingScroll = useRef(false);

    useEffect(() => {
        function onClick(event) {
            const described = describeClick(event, window.location);
            if (!described) return;
            described.isEligible = isEligiblePath(described.url.pathname, ELIGIBLE);
            if (!shouldIntercept(described)) return;

            // A link back to the page already showing (the landing hub's
            // centre photo links to "/" while rendered on "/") must not
            // start a fall: there is no distinct arrival to settle it, so
            // the clones would drop over a page that never goes anywhere.
            const targetPath = normalizePath(described.url.pathname);
            if (targetPath === normalizePath(described.currentPathname)) return;

            event.preventDefault();

            // Read at transition time, never cached at load.
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!reduced) {
                // A measurement or clone failure must not swallow the click:
                // fall through to a plain navigation instead.
                try {
                    const root = pageRoot();
                    if (root) {
                        const pieces = collectPieces(root, domContext());
                        if (pieces.length > 0) runFall(pieces);
                    }
                } catch {
                    // Ignored -- the navigation below still happens.
                }
            }

            pendingScroll.current = true;
            pendingSettleFor.current = reduced ? null : targetPath;
            navigate(`${described.url.pathname}${described.url.search}${described.url.hash}`);
        }

        document.addEventListener('click', onClick, true);
        return () => {
            document.removeEventListener('click', onClick, true);
        };
    }, [navigate]);

    /*
     * Cancelling the fall belongs to unmount, and only to unmount, so it has
     * an effect of its own. React Router's useNavigate is memoised on the
     * current location, so it returns a fresh function identity on every
     * navigation and the listener effect above re-subscribes each time. When
     * cancelFall() lived in that cleanup, React ran it in the same commit as
     * the navigation the click had just started: the overlay was built,
     * appended and removed again before the first animation frame, so the
     * fall never drew anything. Keyed on [] it fires only when the component
     * genuinely goes away, which is the case it was written for -- an inert
     * overlay must never be left sitting on top of a live page.
     */
    useEffect(() => cancelFall, []);

    useEffect(() => {
        const title = titleForPath(location.pathname, routes);
        if (title) document.title = title;

        // Only an intercepted navigation resets scroll -- not mount (which
        // would fight the browser's own scroll restoration on reload) and
        // not Back/Forward (which the seam deliberately does not touch).
        if (pendingScroll.current) {
            pendingScroll.current = false;
            window.scrollTo(0, 0);
        }

        // Keyboard users must not be left holding focus on a detached clone.
        // Unconditional, like the title: it is correct on every arrival,
        // intercepted or not.
        if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.blur();
        }

        const expected = pendingSettleFor.current;
        pendingSettleFor.current = null;
        if (expected !== null && normalizePath(location.pathname) === expected) {
            const root = pageRoot();
            if (root) settle(collectPieces(root, domContext()));
        }
    }, [location.pathname]);

    return null;
}
