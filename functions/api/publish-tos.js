import { getFile, putFile, withRetryOn409 } from './_shared/github.js';

export function validateBullet(bullet, pointIndex, bulletIndex) {
    const errors = [];
    const label = `Point ${pointIndex + 1}, bullet ${bulletIndex + 1}`;
    if (!bullet.text || typeof bullet.text !== 'string') errors.push(`${label} needs text`);
    if (bullet.type !== 'plain' && bullet.type !== 'yesno') {
        errors.push(`${label} type must be "plain" or "yesno"`);
    }
    if (bullet.type === 'yesno' && typeof bullet.value !== 'boolean') {
        errors.push(`${label} needs a yes/no value`);
    }
    return errors;
}

export function validateTosPoint(point, index) {
    const errors = [];
    if (!point.title || typeof point.title !== 'string') errors.push(`Point ${index + 1} needs a title`);
    if (point.body !== undefined && typeof point.body !== 'string') {
        errors.push(`Point ${index + 1} body must be a string`);
    }
    if (point.bullets !== undefined) {
        if (!Array.isArray(point.bullets)) {
            errors.push(`Point ${index + 1} bullets must be an array`);
        } else {
            point.bullets.forEach((bullet, bulletIndex) => {
                errors.push(...validateBullet(bullet, index, bulletIndex));
            });
        }
    }
    return errors;
}

export function validateTosPayload(payload) {
    const errors = [];
    if (!Array.isArray(payload.points)) {
        errors.push('Points must be an array');
        return { valid: false, errors };
    }
    payload.points.forEach((point, index) => {
        errors.push(...validateTosPoint(point, index));
    });
    return { valid: errors.length === 0, errors };
}

function normalizeBullet(bullet) {
    return {
        type: bullet.type,
        text: bullet.text,
        ...(bullet.type === 'yesno' ? { value: Boolean(bullet.value) } : {}),
    };
}

function normalizePoint(point) {
    return {
        title: point.title,
        body: point.body || '',
        bullets: (point.bullets || []).map(normalizeBullet),
    };
}

export async function updateTos(payload, githubConfig) {
    const path = 'data/tos.json';
    return withRetryOn409(async () => {
        const { sha } = await getFile(path, githubConfig);
        const points = payload.points.map(normalizePoint);
        await putFile(path, JSON.stringify({ points }, null, 2), sha, 'content: update terms of service', githubConfig);
        return points;
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const payload = await request.json();
        const { valid, errors } = validateTosPayload(payload);
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

        const points = await updateTos(payload, githubConfig);
        return new Response(JSON.stringify({ ok: true, points }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
