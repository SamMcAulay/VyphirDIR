export function extractImageId(url) {
    const path = String(url ?? '').split(/[?#]/)[0];
    const filename = path.split('/').pop() || '';
    return filename.replace(/\.[^./]+$/, '');
}
