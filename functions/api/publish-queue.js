import { getFile, putFile, withRetryOn409 } from './_shared/github.js';

const REQUIRED_COLUMN_COUNT = 5;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateColumn(column, index) {
    const errors = [];
    if (!column.id || typeof column.id !== 'string') errors.push(`Column ${index + 1} needs an id`);
    if (!column.name || typeof column.name !== 'string') errors.push(`Column ${index + 1} needs a name`);
    if (typeof column.enabled !== 'boolean') errors.push(`Column ${index + 1} needs an enabled flag`);
    return errors;
}

export function validateCard(card, index, columnIds) {
    const errors = [];
    const label = `Card ${index + 1}`;
    if (!card.id || typeof card.id !== 'string') errors.push(`${label} needs an id`);
    if (!card.title || typeof card.title !== 'string') errors.push(`${label} needs a title`);
    if (!card.columnId || !columnIds.has(card.columnId)) errors.push(`${label} has an unknown column`);
    if (card.for !== undefined && typeof card.for !== 'string') errors.push(`${label} "for" must be a string`);
    if (card.targetDate && !DATE_PATTERN.test(card.targetDate)) {
        errors.push(`${label} target date must be in YYYY-MM-DD format`);
    }
    if (!card.createdAt || typeof card.createdAt !== 'string') errors.push(`${label} needs a createdAt`);
    return errors;
}

export function validateQueuePayload(payload) {
    const errors = [];
    if (!Array.isArray(payload.columns) || payload.columns.length !== REQUIRED_COLUMN_COUNT) {
        errors.push(`Columns must be an array of exactly ${REQUIRED_COLUMN_COUNT}`);
        return { valid: false, errors };
    }
    payload.columns.forEach((column, index) => errors.push(...validateColumn(column, index)));
    if (errors.length > 0) return { valid: false, errors };

    const columnIds = new Set(payload.columns.map((column) => column.id));
    if (!Array.isArray(payload.cards)) {
        errors.push('Cards must be an array');
        return { valid: false, errors };
    }
    payload.cards.forEach((card, index) => errors.push(...validateCard(card, index, columnIds)));
    return { valid: errors.length === 0, errors };
}

function normalizeColumn(column) {
    return { id: column.id, name: column.name, enabled: Boolean(column.enabled) };
}

function normalizeCard(card) {
    return {
        id: card.id,
        columnId: card.columnId,
        title: card.title,
        for: card.for || '',
        targetDate: card.targetDate || '',
        createdAt: card.createdAt,
    };
}

export async function updateQueue(payload, githubConfig) {
    const path = 'data/queue.json';
    return withRetryOn409(async () => {
        const { sha } = await getFile(path, githubConfig);
        const columns = payload.columns.map(normalizeColumn);
        const cards = payload.cards.map(normalizeCard);
        await putFile(path, JSON.stringify({ columns, cards }, null, 2), sha, 'content: update commission queue', githubConfig);
        return { columns, cards };
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const payload = await request.json();
        const { valid, errors } = validateQueuePayload(payload);
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

        const result = await updateQueue(payload, githubConfig);
        return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
