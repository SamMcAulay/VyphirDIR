/*
 * The interception predicate (spec section 3). Pure, imports nothing: it is
 * handed a plain descriptor so every branch is testable without a DOM.
 *
 * Every condition must hold. Any failure falls through to the browser
 * untouched, which is what keeps middle-click, ctrl-click, downloads and
 * external links behaving exactly as they do today.
 */
export function shouldIntercept(click) {
    if (!click) return false;
    if (click.defaultPrevented) return false;
    if (click.button !== 0) return false;
    if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;

    const { anchor, url } = click;
    if (!anchor || !url) return false;
    if (anchor.download !== null && anchor.download !== undefined) return false;
    if (anchor.target && anchor.target !== '_self') return false;
    if (/(^|\s)external(\s|$)/i.test(anchor.rel || '')) return false;

    if (url.origin !== click.currentOrigin) return false;
    if (url.hash && url.pathname === click.currentPathname) return false;

    return click.isEligible === true;
}

/*
 * DOM adapter. Duck-typed on purpose -- it reads `closest` off the target and
 * takes `location` as an argument, so a stub object exercises it in tests.
 */
export function describeClick(event, location) {
    const target = event.target;
    const anchor = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
    if (!anchor) return null;

    const href = anchor.getAttribute('href');
    if (href === null) return null;

    let url;
    try {
        url = new URL(href, location.href);
    } catch {
        return null;
    }

    return {
        defaultPrevented: event.defaultPrevented,
        button: event.button,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        anchor: {
            download: anchor.hasAttribute('download') ? anchor.getAttribute('download') : null,
            target: anchor.target,
            rel: anchor.rel,
        },
        url,
        currentOrigin: location.origin,
        currentPathname: location.pathname,
        isEligible: false,
    };
}
