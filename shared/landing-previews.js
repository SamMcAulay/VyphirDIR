const MAX_PREVIEWS = 4;
// The commissions page lists past work newest first, so the first nine
// entries are the nine most recent pieces.
const RECENT_WORK = 9;

function firstSafeImageUrl(character) {
    const image = (character?.images || []).find((img) => !img?.nsfw && img?.url);
    return image ? image.url : null;
}

/*
 * The images each hub preview blob may draw from. Built once (at build time,
 * or from the JSON on a client-side visit to '/'); the draw itself happens in
 * pickPreviews on every page load so the blobs show different art each time.
 * The recent-work window is cut before NSFW filtering, so the pool matches
 * exactly what sits at the top of the commissions page.
 */
export function selectLandingPools(charactersData, commissionsData) {
    const gallery = (charactersData?.characters || []).map(firstSafeImageUrl).filter(Boolean);
    const commissions = (commissionsData?.pastWork || [])
        .slice(0, RECENT_WORK)
        .filter((item) => !item?.nsfw && item?.url)
        .map((item) => item.url);
    return { gallery, commissions };
}

function shuffled(items, random) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function pickPreviews(pools, random = Math.random) {
    return {
        gallery: shuffled(pools?.gallery || [], random).slice(0, MAX_PREVIEWS),
        commissions: shuffled(pools?.commissions || [], random).slice(0, MAX_PREVIEWS),
    };
}
