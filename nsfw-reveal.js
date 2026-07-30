export function setupNsfwReveal(root = document) {
    root.querySelectorAll('.char-image-wrap.nsfw-blur').forEach((wrap) => {
        if (wrap.querySelector('.nsfw-warning')) return;

        const warning = document.createElement('div');
        warning.className = 'nsfw-warning';
        warning.textContent = 'NSFW — click to reveal';
        wrap.appendChild(warning);

        warning.addEventListener('click', () => wrap.classList.add('revealed'));
    });
}
