import { getFile, putFile, withRetryOn409 } from './_shared/github.js';
import { uploadImage } from './_shared/cloudinary.js';

export function validateCommissionsInfo(payload) {
    const errors = [];
    if (typeof payload.status !== 'boolean') errors.push('Status must be true or false');
    if (typeof payload.intro !== 'string') errors.push('Intro must be a string');
    if (payload.specialOffer !== undefined && typeof payload.specialOffer !== 'string') {
        errors.push('Special offer must be a string');
    }
    if (!Array.isArray(payload.tiers)) {
        errors.push('Tiers must be an array');
    } else {
        payload.tiers.forEach((tier, i) => {
            if (!tier.name || typeof tier.name !== 'string') errors.push(`Tier ${i + 1} needs a name`);
        });
    }
    return { valid: errors.length === 0, errors };
}

export function validatePastWorkEntry(entry) {
    const errors = [];
    if (!entry.url || typeof entry.url !== 'string') errors.push('Image URL is required');
    if (entry.caption !== undefined && typeof entry.caption !== 'string') {
        errors.push('Caption must be a string');
    }
    return { valid: errors.length === 0, errors };
}

async function updateInfo(payload, githubConfig) {
    const path = 'data/commissions.json';
    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);
        data.status = payload.status;
        data.intro = payload.intro;
        data.specialOffer = payload.specialOffer || '';
        data.tiers = payload.tiers;
        await putFile(path, JSON.stringify(data, null, 2), sha, 'content: update commissions info', githubConfig);
    });
}

async function appendPastWork(entry, githubConfig) {
    const path = 'data/commissions.json';
    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);
        data.pastWork = [...(data.pastWork || []), entry];
        await putFile(path, JSON.stringify(data, null, 2), sha, 'content: add past commission work', githubConfig);
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
        const cloudinaryConfig = {
            cloudName: env.CLOUDINARY_CLOUD_NAME,
            apiKey: env.CLOUDINARY_API_KEY,
            apiSecret: env.CLOUDINARY_API_SECRET,
            folder: 'vyphir/commissions',
        };

        if (meta.type === 'past-work') {
            const file = formData.get('image');
            if (!file || file.size === 0) {
                return new Response(JSON.stringify({ error: 'Image file is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            const url = await uploadImage(file, cloudinaryConfig);
            const entry = { url, caption: meta.caption || '' };
            const { valid, errors } = validatePastWorkEntry(entry);
            if (!valid) {
                return new Response(JSON.stringify({ error: errors.join(', ') }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            await appendPastWork(entry, githubConfig);
            return new Response(JSON.stringify({ ok: true }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const tierFiles = formData.getAll('tierImages');
        const tiers = [];
        for (let i = 0; i < (meta.tiers || []).length; i += 1) {
            const tier = meta.tiers[i];
            let example = tier.example || '';
            if (tierFiles[i] && tierFiles[i].size > 0) {
                example = await uploadImage(tierFiles[i], cloudinaryConfig);
            }
            tiers.push({ name: tier.name, price: tier.price || '', description: tier.description || '', example });
        }

        const payload = {
            status: Boolean(meta.status),
            intro: meta.intro || '',
            specialOffer: meta.specialOffer || '',
            tiers,
        };

        const { valid, errors } = validateCommissionsInfo(payload);
        if (!valid) {
            return new Response(JSON.stringify({ error: errors.join(', ') }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        await updateInfo(payload, githubConfig);
        return new Response(JSON.stringify({ ok: true }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
