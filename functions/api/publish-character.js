import { getFile, putFile, withRetryOn409 } from './_shared/github.js';
import { uploadImage } from './_shared/cloudinary.js';
import { uniqueSlug } from '../../shared/slugify.js';

export function validateCharacterPayload(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object') {
        return { valid: false, errors: ['Payload must be an object'] };
    }
    if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
        errors.push('Name is required');
    }
    if (payload.species !== undefined && typeof payload.species !== 'string') {
        errors.push('Species must be a string');
    }
    if (payload.bio !== undefined && typeof payload.bio !== 'string') {
        errors.push('Bio must be a string');
    }
    if (!Array.isArray(payload.images) || payload.images.length === 0) {
        errors.push('At least one image is required');
    }
    return { valid: errors.length === 0, errors };
}

export function validateDeleteRequest(meta) {
    const errors = [];
    if (!meta || typeof meta !== 'object' || !meta.slug || typeof meta.slug !== 'string') {
        errors.push('Slug is required to delete a character');
    }
    return { valid: errors.length === 0, errors };
}

export function mergeCharacterImages(existingImages, newImages) {
    const cleanExisting = (existingImages || [])
        .filter((img) => img && typeof img.url === 'string' && img.url)
        .map((img) => ({ url: img.url, nsfw: Boolean(img.nsfw) }));
    return [...cleanExisting, ...(newImages || [])];
}

async function updateCharactersFile(payload, existingSlug, githubConfig) {
    const path = 'data/characters.json';

    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);

        let slug = existingSlug;
        if (slug) {
            const index = (data.characters || []).findIndex((c) => c.slug === slug);
            if (index === -1) {
                const error = new Error(`Character with slug "${slug}" not found`);
                error.notFound = true;
                throw error;
            }
            data.characters[index] = { ...data.characters[index], ...payload, slug };
        } else {
            const existingSlugs = (data.characters || []).map((c) => c.slug);
            slug = uniqueSlug(payload.name, existingSlugs);
            data.characters.push({ ...payload, slug });
        }

        await putFile(
            path,
            JSON.stringify(data, null, 2),
            sha,
            `content: publish character "${payload.name}"`,
            githubConfig
        );
        return { slug };
    });
}

export async function deleteCharacter(slug, githubConfig) {
    const path = 'data/characters.json';

    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);

        const index = (data.characters || []).findIndex((c) => c.slug === slug);
        if (index === -1) {
            const error = new Error(`Character with slug "${slug}" not found`);
            error.notFound = true;
            throw error;
        }

        data.characters.splice(index, 1);

        await putFile(
            path,
            JSON.stringify(data, null, 2),
            sha,
            `content: delete character "${slug}"`,
            githubConfig
        );
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const formData = await request.formData();
        const meta = JSON.parse(formData.get('meta') || '{}');

        const githubConfig = {
            owner: env.GITHUB_OWNER,
            repo: env.GITHUB_REPO,
            branch: env.GITHUB_BRANCH || 'main',
            token: env.GITHUB_TOKEN,
        };

        if (meta.action === 'delete') {
            const { valid, errors } = validateDeleteRequest(meta);
            if (!valid) {
                return new Response(JSON.stringify({ error: errors.join(', ') }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            await deleteCharacter(meta.slug, githubConfig);
            return new Response(JSON.stringify({ ok: true, slug: meta.slug }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const files = formData.getAll('images');
        const newImages = [];
        for (let i = 0; i < files.length; i += 1) {
            const url = await uploadImage(files[i], {
                cloudName: env.CLOUDINARY_CLOUD_NAME,
                apiKey: env.CLOUDINARY_API_KEY,
                apiSecret: env.CLOUDINARY_API_SECRET,
                folder: 'vyphir/characters',
            });
            newImages.push({ url, nsfw: Boolean(meta.nsfwFlags && meta.nsfwFlags[i]) });
        }

        const payload = {
            name: meta.name,
            species: meta.species || '',
            bio: meta.bio || '',
            images: mergeCharacterImages(meta.existingImages, newImages),
        };

        const { valid, errors } = validateCharacterPayload(payload);
        if (!valid) {
            return new Response(JSON.stringify({ error: errors.join(', ') }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { slug } = await updateCharactersFile(payload, meta.slug, githubConfig);
        return new Response(JSON.stringify({ ok: true, slug, character: { ...payload, slug } }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        if (error.notFound) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
