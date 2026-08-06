const HERO_TILT_DEGREES = -4;

function initHeroTilt() {
    const hero = document.querySelector('.hero-tilt');
    if (!hero) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const scrollRoom = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollRoom < 40) return;

    const distance = Math.min(420, Math.max(120, scrollRoom * 0.6));
    let settled = false;
    let ticking = false;

    function update() {
        ticking = false;
        const progress = Math.min(window.scrollY / distance, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const angle = HERO_TILT_DEGREES * (1 - eased);
        hero.style.transform = `rotate(${angle}deg)`;

        if (progress >= 1) {
            settled = true;
            hero.style.transform = 'rotate(0deg)';
            window.removeEventListener('scroll', onScroll);
        }
    }

    function onScroll() {
        if (settled || ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
}

function initSectionReveal() {
    const sections = document.querySelectorAll('.reveal-section');
    if (sections.length === 0) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
        sections.forEach((el) => el.classList.add('revealed'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );

    sections.forEach((el) => observer.observe(el));
}

export function initScrollMotion() {
    initHeroTilt();
    initSectionReveal();
}
