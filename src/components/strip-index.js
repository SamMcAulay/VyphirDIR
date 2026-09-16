/*
 * Which item of a horizontal snap strip is "current" for the dots
 * (page-layouts spec 6.3). Offsets are each item's left edge relative to the
 * first item. Once the strip is scrolled to its end, the last item is current
 * even if its edge never reaches the scroll position, which happens whenever
 * the final items fit on screen together.
 */
export function nearestIndex(scrollLeft, offsets, maxScroll = Infinity) {
    if (offsets.length === 0) return 0;
    if (maxScroll > 0 && scrollLeft >= maxScroll - 1) return offsets.length - 1;
    let best = 0;
    for (let i = 1; i < offsets.length; i += 1) {
        if (Math.abs(offsets[i] - scrollLeft) < Math.abs(offsets[best] - scrollLeft)) best = i;
    }
    return best;
}
