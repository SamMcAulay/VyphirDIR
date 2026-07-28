import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\(/g, '&#40;')
        .replace(/\)/g, '&#41;');
}

function renderImages(images) {
    return (images || [])
        .map((img) => {
            const nsfwAttr = img.nsfw ? ' data-nsfw="true"' : '';
            const nsfwClass = img.nsfw ? ' nsfw-blur' : '';
            return `                <div class="char-image-wrap${nsfwClass}"${nsfwAttr}>\n                    <img src="${escapeHtml(img.url)}" alt="" loading="lazy">\n                </div>`;
        })
        .join('\n');
}

export async function generateCharacterPages({ dataPath, templatePath, outDir }) {
    const [dataRaw, template] = await Promise.all([
        readFile(dataPath, 'utf8'),
        readFile(templatePath, 'utf8'),
    ]);
    const { characters } = JSON.parse(dataRaw);
    const slugs = [];

    for (const char of characters) {
        const html = template
            .replaceAll('__CHAR_NAME__', escapeHtml(char.name))
            .replaceAll('__CHAR_SPECIES__', escapeHtml(char.species))
            .replaceAll('__CHAR_BIO__', escapeHtml(char.bio))
            .replaceAll('__CHAR_IMAGES__', renderImages(char.images));

        const charDir = join(outDir, char.slug);
        await mkdir(charDir, { recursive: true });
        await writeFile(join(charDir, 'index.html'), html);
        slugs.push(char.slug);
    }

    return slugs;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    generateCharacterPages({
        dataPath: join(projectRoot, 'data', 'characters.json'),
        templatePath: join(projectRoot, 'templates', 'character.html'),
        outDir: join(projectRoot, 'gallery'),
    }).then((slugs) => {
        console.log(`Generated ${slugs.length} character page(s): ${slugs.join(', ')}`);
    });
}
