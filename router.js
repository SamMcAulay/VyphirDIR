import { matchRoute } from './shared/route-table.js';
import './background.js';

let activeModulePath = null;
let navToken = 0;

function currentPanel() {
    return document.querySelector('.datapad-screen');
}

function currentWrapper() {
    return document.querySelector('.datapad-wrapper');
}

async function runInit(modulePath) {
    const mod = await import(modulePath);
    if (typeof mod.init === 'function') {
        mod.init();
    }
    activeModulePath = modulePath;
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

    try {
        const response = await fetch(url.pathname);
        if (!response.ok) throw new Error(`bad status ${response.status}`);
        html = await response.text();
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
        await runInit(route.module);
    };

    if (document.startViewTransition) {
        await document.startViewTransition(applySwap).finished;
    } else {
        await applySwap();
    }
}

function matchRoutableClick(event) {
    if (event.defaultPrevented || event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

    const link = event.target.closest('a');
    if (!link || link.target || link.hasAttribute('download')) return null;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return null;

    const route = matchRoute(url.pathname);
    if (!route) return null;

    return { url, route };
}

document.addEventListener('click', (event) => {
    const match = matchRoutableClick(event);
    if (!match) return;

    const { url, route } = match;

    if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return; // already on this page — leave the click alone entirely
    }

    event.preventDefault();
    navigate(url, route, { push: true });
});

window.addEventListener('popstate', () => {
    const route = matchRoute(window.location.pathname);
    if (!route) return;
    navigate(new URL(window.location.href), route, { push: false });
});

const initialRoute = matchRoute(window.location.pathname);
if (initialRoute) {
    runInit(initialRoute.module);
}
