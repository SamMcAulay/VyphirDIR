import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { GIFEncoder, quantize, applyPalette } from 'gifenc/dist/gifenc.esm.js';

const MAX_IMAGES = 9;
const FRAME_SIZE = 720;
const FRAME_DELAY_MS = 1750;
const PAD_COLOR = '#120a0d';
const FALLBACK_IMAGE = 'https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401';

export function selectPreviewPieces(pastWork) {
    return (pastWork || []).filter((item) => !item.nsfw).slice(0, MAX_IMAGES);
}

export async function renderFrame(imageBuffer) {
    const { data } = await sharp(imageBuffer)
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: PAD_COLOR })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    return data;
}

export function encodeGif(frameBuffers, { delay = FRAME_DELAY_MS } = {}) {
    const gif = GIFEncoder();
    for (const rgba of frameBuffers) {
        const palette = quantize(rgba, 256);
        const index = applyPalette(rgba, palette);
        gif.writeFrame(index, FRAME_SIZE, FRAME_SIZE, { palette, delay, repeat: 0 });
    }
    gif.finish();
    return Buffer.from(gif.bytes());
}

export async function generateCommissionsPreviewImage({ dataPath, outDir, fetchImage = fetch }) {
    const dataRaw = await readFile(dataPath, 'utf8');
    const data = JSON.parse(dataRaw);
    const pieces = selectPreviewPieces(data.pastWork);

    if (pieces.length === 0) {
        return { pieceCount: 0, ogImage: FALLBACK_IMAGE };
    }

    const frames = [];
    for (const piece of pieces) {
        const response = await fetchImage(piece.url);
        if (!response.ok) throw new Error(`Failed to fetch preview image: ${piece.url}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        frames.push(await renderFrame(buffer));
    }
    const gifBytes = encodeGif(frames);
    const hash = createHash('sha1').update(gifBytes).digest('hex').slice(0, 10);
    await writeFile(join(outDir, 'preview.gif'), gifBytes);

    return { pieceCount: pieces.length, ogImage: `https://vyphir.com/commissions/preview.gif?v=${hash}` };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    generateCommissionsPreviewImage({
        dataPath: join(projectRoot, 'data', 'commissions.json'),
        outDir: join(projectRoot, 'dist', 'client', 'commissions'),
    }).then(({ pieceCount, ogImage }) => {
        console.log(`Generated commissions preview (${pieceCount} piece(s)): ${ogImage}`);
    });
}
