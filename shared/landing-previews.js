const MAX_PREVIEWS = 4;

function firstSafeImageUrl(character) {
    const image = (character?.images || []).find((img) => !img?.nsfw && img?.url);
    return image ? image.url : null;
}

export function selectLandingPreviews(charactersData, commissionsData) {
    const gallery = [];
    for (const character of charactersData?.characters || []) {
        if (gallery.length >= MAX_PREVIEWS) break;
        const url = firstSafeImageUrl(character);
        if (url) gallery.push(url);
    }

    const commissions = [];
    for (const item of commissionsData?.pastWork || []) {
        if (commissions.length >= MAX_PREVIEWS) break;
        if (!item?.nsfw && item?.url) commissions.push(item.url);
    }

    return { gallery, commissions };
}
