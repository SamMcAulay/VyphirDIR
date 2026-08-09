import { matchRoute } from './shared/route-table.js';
import './background.js';

let activeModulePath = null;
let navToken = 0;
const prefetchCache = new Map();

function currentPanel() {
    return document.querySelector('.datapad-screen');
}

function currentWrapper() {
    return document.querySelector('.datapad-wrapper');
}

function prefetch(pathname) {
    if (prefetchCache.has(pathname)) return;

    const request = fetch(pathname)
        .then(async (response) => {
            if (!response.ok) throw new Error(`bad status ${response.status}`);
            return { html: await response.text() };
        })
        .catch((error) => {
            prefetchCache.delete(pathname); // let a later attempt retry instead of being stuck with a cached failure
            throw error;
        });

    prefetchCache.set(pathname, request);
}

async function runInit(modulePath) {
    const mod = await import(modulePath);
    activeModulePath = modulePath;
    if (typeof mod.init === 'function') {
        await mod.init();
    }
}

async function runCleanup() {
    if (!activeModulePath) return;
    const mod = await import(activeModulePath);
    if (typeof mod.cleanup === 'function') {
        mod.cleanup();
    }
}

async function navigate(url, route, { push }) {
    const token = ++navToken;
    let html;

    prefetch(url.pathname); // no-op if a hover/touchstart already started this fetch

    try {
        ({ html } = await prefetchCache.get(url.pathname));
    } catch (error) {
        console.error('router: fetch failed, falling back to a real navigation', error);
        window.location.href = url.href;
        return;
    }

    if (token !== navToken) return; // a newer navigation has since started; discard this one

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const newPanel = doc.querySelector('.datapad-screen');
    const newWrapper = doc.querySelector('.datapad-wrapper');
    const panel = currentPanel();
    const wrapper = currentWrapper();

    if (!newPanel || !newWrapper || !panel || !wrapper) {
        window.location.href = url.href;
        return;
    }

    if (push) {
        history.pushState({}, '', url.pathname);
    }

    const applySwap = async () => {
        await runCleanup();
        wrapper.className = newWrapper.className;
        panel.innerHTML = newPanel.innerHTML;
        document.title = doc.title;
        window.scrollTo(0, 0);
        try {
            await runInit(route.module);
        } catch (error) {
            console.error('router: page module failed to initialize', error);
        }
    };

    if (document.startViewTransition) {
        await document.startViewTransition(applySwap).finished;
    } else {
        await applySwap();
    }
}

function matchRoutableLink(link) {
    if (!link || link.target || link.hasAttribute('download')) return null;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return null;

    const route = matchRoute(url.pathname);
    if (!route) return null;

    return { url, route };
}

function matchRoutableClick(event) {
    if (event.defaultPrevented || event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

    return matchRoutableLink(event.target.closest('a'));
}

// Prefetch on hover/touch so the fetch is often already in flight (or done)
// by the time the click fires — without this, nothing visible happens
// between the click and the flip starting, which reads as a freeze on any
// connection slower than localhost.
document.addEventListener('mouseover', (event) => {
    const match = matchRoutableLink(event.target.closest('a'));
    if (match) prefetch(match.url.pathname);
});

document.addEventListener('touchstart', (event) => {
    const match = matchRoutableLink(event.target.closest('a'));
    if (match) prefetch(match.url.pathname);
}, { passive: true });

document.addEventListener('click', (event) => {
    const match = matchRoutableClick(event);
    if (!match) return;

    const { url, route } = match;

    if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return; // already on this page — leave the click alone entirely
    }

    event.preventDefault();
    navigate(url, route, { push: true }).catch((error) => {
        console.error('router: navigation failed', error);
    });
});

window.addEventListener('popstate', () => {
    const route = matchRoute(window.location.pathname);
    if (!route) return;
    navigate(new URL(window.location.href), route, { push: false }).catch((error) => {
        console.error('router: navigation failed', error);
    });
});

const initialRoute = matchRoute(window.location.pathname);
if (initialRoute) {
    runInit(initialRoute.module);
}
