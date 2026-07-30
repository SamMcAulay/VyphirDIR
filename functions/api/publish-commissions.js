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
    if (entry.nsfw !== undefined && typeof entry.nsfw !== 'boolean') {
        errors.push('NSFW flag must be a boolean');
    }
    return { valid: errors.length === 0, errors };
}

export function validatePastWorkEdit(meta) {
    const errors = [];
    if (!meta || !meta.url || typeof meta.url !== 'string') {
        errors.push('URL is required to identify the past-work entry');
    }
    if (meta && meta.caption !== undefined && typeof meta.caption !== 'string') {
        errors.push('Caption must be a string');
    }
    if (meta && meta.nsfw !== undefined && typeof meta.nsfw !== 'boolean') {
        errors.push('NSFW flag must be a boolean');
    }
    return { valid: errors.length === 0, errors };
}

export function validatePastWorkDelete(meta) {
    const errors = [];
    if (!meta || !meta.url || typeof meta.url !== 'string') {
        errors.push('URL is required to identify the past-work entry');
    }
    return { valid: errors.length === 0, errors };
}

export function validatePastWorkReorder(meta) {
    const errors = [];
    if (!meta || !Array.isArray(meta.order) || meta.order.length === 0 || meta.order.some((u) => typeof u !== 'string')) {
        errors.push('Order must be a non-empty array of URLs');
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

export async function editPastWork(url, updates, githubConfig) {
    const path = 'data/commissions.json';
    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);
        const index = (data.pastWork || []).findIndex((entry) => entry.url === url);
        if (index === -1) {
            const error = new Error(`Past work entry with url "${url}" not found`);
            error.notFound = true;
            throw error;
        }
        const existing = data.pastWork[index];
        data.pastWork[index] = {
            ...existing,
            caption: updates.caption !== undefined ? updates.caption : existing.caption || '',
            nsfw: updates.nsfw !== undefined ? Boolean(updates.nsfw) : Boolean(existing.nsfw),
        };
        await putFile(path, JSON.stringify(data, null, 2), sha, 'content: edit past commission work', githubConfig);
    });
}

export async function reorderPastWork(order, githubConfig) {
    const path = 'data/commissions.json';
    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);
        const current = data.pastWork || [];
        const byUrl = new Map(current.map((entry) => [entry.url, entry]));
        const reordered = order.filter((url) => byUrl.has(url)).map((url) => byUrl.get(url));
        if (reordered.length !== current.length) {
            const error = new Error('Order must include exactly the current set of past-work entries');
            error.notFound = true;
            throw error;
        }
        data.pastWork = reordered;
        await putFile(path, JSON.stringify(data, null, 2), sha, 'content: reorder past commission work', githubConfig);
    });
}

export async function deletePastWork(url, githubConfig) {
    const path = 'data/commissions.json';
    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);
        const index = (data.pastWork || []).findIndex((entry) => entry.url === url);
        if (index === -1) {
            const error = new Error(`Past work entry with url "${url}" not found`);
            error.notFound = true;
            throw error;
        }
        data.pastWork.splice(index, 1);
        await putFile(path, JSON.stringify(data, null, 2), sha, 'content: delete past commission work', githubConfig);
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
            if (meta.action === 'edit') {
                const { valid, errors } = validatePastWorkEdit(meta);
                if (!valid) {
                    return new Response(JSON.stringify({ error: errors.join(', ') }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                await editPastWork(meta.url, { caption: meta.caption, nsfw: meta.nsfw }, githubConfig);
                return new Response(JSON.stringify({ ok: true }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            if (meta.action === 'reorder') {
                const { valid, errors } = validatePastWorkReorder(meta);
                if (!valid) {
                    return new Response(JSON.stringify({ error: errors.join(', ') }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                await reorderPastWork(meta.order, githubConfig);
                return new Response(JSON.stringify({ ok: true }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            if (meta.action === 'delete') {
                const { valid, errors } = validatePastWorkDelete(meta);
                if (!valid) {
                    return new Response(JSON.stringify({ error: errors.join(', ') }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
                await deletePastWork(meta.url, githubConfig);
                return new Response(JSON.stringify({ ok: true }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const file = formData.get('image');
            if (!file || file.size === 0) {
                return new Response(JSON.stringify({ error: 'Image file is required' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            const url = await uploadImage(file, cloudinaryConfig);
            const entry = { url, caption: meta.caption || '', nsfw: Boolean(meta.nsfw) };
            const { valid, errors } = validatePastWorkEntry(entry);
            if (!valid) {
                return new Response(JSON.stringify({ error: errors.join(', ') }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            await appendPastWork(entry, githubConfig);
            return new Response(JSON.stringify({ ok: true, entry }), {
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
        return new Response(JSON.stringify({ ok: true, tiers: payload.tiers }), {
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
