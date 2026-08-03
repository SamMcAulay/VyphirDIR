import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from '../shared/escape-html.js';

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
        const html = template.replace(/__CHAR_NAME__|__CHAR_SPECIES__|__CHAR_BIO__|__CHAR_IMAGES__/g, (token) => {
            switch (token) {
                case '__CHAR_NAME__': return escapeHtml(char.name);
                case '__CHAR_SPECIES__': return escapeHtml(char.species);
                case '__CHAR_BIO__': return escapeHtml(char.bio);
                case '__CHAR_IMAGES__': return renderImages(char.images);
                default: return token;
            }
        });

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
