import { getFile, putFile } from './_shared/github.js';
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

async function updateCharactersFile(payload, existingSlug, githubConfig) {
    const path = 'data/characters.json';

    const attempt = async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);

        let slug = existingSlug;
        if (slug) {
            const index = data.characters.findIndex((c) => c.slug === slug);
            if (index === -1) throw new Error(`Character with slug "${slug}" not found`);
            data.characters[index] = { ...data.characters[index], ...payload, slug };
        } else {
            const existingSlugs = data.characters.map((c) => c.slug);
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
    };

    try {
        return await attempt();
    } catch (error) {
        if (error.status === 409) return attempt();
        throw error;
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const formData = await request.formData();
        const meta = JSON.parse(formData.get('meta') || '{}');
        const files = formData.getAll('images');

        const images = [];
        for (let i = 0; i < files.length; i += 1) {
            const url = await uploadImage(files[i], {
                cloudName: env.CLOUDINARY_CLOUD_NAME,
                apiKey: env.CLOUDINARY_API_KEY,
                apiSecret: env.CLOUDINARY_API_SECRET,
                folder: 'vyphir/characters',
            });
            images.push({ url, nsfw: Boolean(meta.nsfwFlags && meta.nsfwFlags[i]) });
        }

        const payload = {
            name: meta.name,
            species: meta.species || '',
            bio: meta.bio || '',
            images,
        };

        const { valid, errors } = validateCharacterPayload(payload);
        if (!valid) {
            return new Response(JSON.stringify({ error: errors.join(', ') }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const githubConfig = {
            owner: env.GITHUB_OWNER,
            repo: env.GITHUB_REPO,
            branch: env.GITHUB_BRANCH || 'main',
            token: env.GITHUB_TOKEN,
        };

        const { slug } = await updateCharactersFile(payload, meta.slug, githubConfig);
        return new Response(JSON.stringify({ ok: true, slug }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
