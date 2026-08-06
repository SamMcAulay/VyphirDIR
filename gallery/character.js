import { setupNsfwReveal } from '../nsfw-reveal.js';
import { setupEnlargeableImages } from '../shared/enlargeable.js';

document.addEventListener('DOMContentLoaded', () => {
    setupEnlargeableImages();
    setupNsfwReveal();
});
