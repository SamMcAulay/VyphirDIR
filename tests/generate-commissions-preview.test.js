import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import {
    selectPreviewPieces,
    generateCommissionsPreview,
} from '../scripts/generate-commissions-preview.js';

const TEMPLATE = '<html><head><meta property="og:description" content="__OG_DESCRIPTION__"><meta property="og:image" content="__OG_IMAGE__"></head><body></body></html>';

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

async function tinyPngResponse() {
    const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ff00ff' } })
        .png()
        .toBuffer();
    return new Response(buffer, { status: 200 });
}

async function setupProject(commissionsData) {
    const dir = await mkdtemp(join(tmpdir(), 'vyphir-comm-preview-'));
    const dataPath = join(dir, 'commissions.json');
    const templatePath = join(dir, 'commissions.html');
    const outDir = join(dir, 'out');
    await mkdir(outDir, { recursive: true });
    await writeFile(dataPath, JSON.stringify(commissionsData));
    await writeFile(templatePath, TEMPLATE);
    return { dataPath, templatePath, outDir };
}

test('selectPreviewPieces excludes nsfw and caps at 9, preserving order', () => {
    const pastWork = Array.from({ length: 12 }, (_, i) => ({ url: `https://example.com/${i}.png`, nsfw: i === 2 }));
    const selected = selectPreviewPieces(pastWork);
    assert.equal(selected.length, 9);
    assert.ok(!selected.some((item) => item.url === 'https://example.com/2.png'));
    assert.equal(selected[0].url, 'https://example.com/0.png');
});

test('generateCommissionsPreview writes a gif and templated index.html for real past work', async () => {
    const { dataPath, templatePath, outDir } = await setupProject({
        pastWork: [
            { url: 'https://example.com/a.png', caption: 'Gift art for oreo!' },
            { url: 'https://example.com/b.png', caption: '' },
            { url: 'https://example.com/c.png', caption: 'Fanart for cambee!', nsfw: true },
        ],
    });

    const result = await withMockedFetch(
        () => tinyPngResponse(),
        () => generateCommissionsPreview({ dataPath, templatePath, outDir })
    );

    // nsfw entry excluded from the count/frames
    assert.equal(result.pieceCount, 2);
    assert.match(result.ogImage, /^https:\/\/vyphir\.com\/commissions\/preview\.gif\?v=[0-9a-f]{10}$/);

    const gifStat = await stat(join(outDir, 'preview.gif'));
    assert.ok(gifStat.size > 0);

    const html = await readFile(join(outDir, 'index.html'), 'utf8');
    assert.match(html, /content="https:\/\/vyphir\.com\/commissions\/preview\.gif\?v=[0-9a-f]{10}"/);
    assert.match(html, /Examples! See full catalogue on the site!/);
});

test('generateCommissionsPreview falls back gracefully when no eligible past work exists', async () => {
    const { dataPath, templatePath, outDir } = await setupProject({
        pastWork: [{ url: 'https://example.com/nsfw.png', caption: 'hidden', nsfw: true }],
    });

    const result = await generateCommissionsPreview({ dataPath, templatePath, outDir });

    assert.equal(result.pieceCount, 0);
    assert.match(result.ogImage, /^https:\/\/f2\.toyhou\.se\//);

    await assert.rejects(stat(join(outDir, 'preview.gif')));
    const html = await readFile(join(outDir, 'index.html'), 'utf8');
    assert.match(html, /Examples! See full catalogue on the site!/);
});
