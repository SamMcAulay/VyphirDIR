import { setupNsfwReveal } from '../nsfw-reveal.js';
import { setupEnlargeableImages } from '../shared/enlargeable.js';

export function init() {
    setupEnlargeableImages();
    setupNsfwReveal();
}
