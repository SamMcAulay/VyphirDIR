/*
 * The one image that represents a character: the gallery tile and the top of
 * the character page (page-layouts spec 6.1, 6.2). Never NSFW.
 */
export function selectCoverImage(images) {
    const list = images || [];
    return list.find((img) => img.thumbnail && !img.nsfw) || list.find((img) => !img.nsfw) || null;
}
