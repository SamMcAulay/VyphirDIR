import { extractImageId } from './image-id.js';

export function setupEnlargeableImages(root = document) {
    root.querySelectorAll('.char-image-wrap img').forEach((img) => {
        if (img.closest('a.enlarge-link')) return;

        const id = extractImageId(img.src);
        if (!id) return;

        const link = document.createElement('a');
        link.className = 'enlarge-link';
        link.href = `/i/${id}`;
        link.target = '_blank';
        link.rel = 'noopener';

        img.replaceWith(link);
        link.appendChild(img);
    });
}
