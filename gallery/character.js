import { setupNsfwReveal } from '../nsfw-reveal.js';
import { setupEnlargeableImages } from '../shared/enlargeable.js';
import { initScrollMotion } from '../shared/scroll-motion.js';

document.addEventListener('DOMContentLoaded', () => {
    setupEnlargeableImages();
    setupNsfwReveal();
    initScrollMotion();
});
