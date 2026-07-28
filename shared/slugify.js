export function slugify(name) {
    const base = String(name)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return base || 'character';
}

export function uniqueSlug(name, existingSlugs) {
    const base = slugify(name);
    if (!existingSlugs.includes(base)) return base;

    let counter = 2;
    let candidate = `${base}-${counter}`;
    while (existingSlugs.includes(candidate)) {
        counter += 1;
        candidate = `${base}-${counter}`;
    }
    return candidate;
}
