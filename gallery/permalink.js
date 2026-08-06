import { setupNsfwReveal } from '../nsfw-reveal.js';

function setupCopyLink() {
    const button = document.getElementById('copy-link-btn');
    if (!button) return;

    button.addEventListener('click', async () => {
        await navigator.clipboard.writeText(window.location.href);
        const original = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = original;
        }, 1500);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupNsfwReveal();
    setupCopyLink();
});
