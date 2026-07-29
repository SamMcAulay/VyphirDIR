function setupNsfwReveal() {
    document.querySelectorAll('.char-image-wrap.nsfw-blur').forEach((wrap) => {
        const warning = document.createElement('div');
        warning.className = 'nsfw-warning';
        warning.textContent = 'NSFW — click to reveal';
        wrap.appendChild(warning);

        const reveal = () => wrap.classList.add('revealed');
        warning.addEventListener('click', reveal);
    });
}

document.addEventListener('DOMContentLoaded', setupNsfwReveal);
