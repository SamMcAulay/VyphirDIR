import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateCharacterPages } from '../scripts/generate-characters.js';

async function setupProject(characters) {
    const dir = await mkdtemp(join(tmpdir(), 'vyphir-gen-'));
    const dataPath = join(dir, 'characters.json');
    const templatePath = join(dir, 'character.html');
    const outDir = join(dir, 'out');
    await mkdir(outDir, { recursive: true });
    await writeFile(dataPath, JSON.stringify({ characters }));
    await writeFile(
        templatePath,
        '<title>__CHAR_NAME__</title><p>__CHAR_SPECIES__</p><p>__CHAR_BIO__</p><div>__CHAR_IMAGES__</div>'
    );
    return { dataPath, templatePath, outDir };
}

test('generates one index.html per character slug', async () => {
    const { dataPath, templatePath, outDir } = await setupProject([
        { slug: 'drasil', name: 'Drasil', species: 'Dragon', bio: 'Hi', images: [{ url: 'https://example.com/a.jpg', nsfw: false }] },
        { slug: 'vyphir', name: 'Vyphir', species: '', bio: '', images: [] },
    ]);

    const slugs = await generateCharacterPages({ dataPath, templatePath, outDir });

    assert.deepEqual(slugs.sort(), ['drasil', 'vyphir']);
    const drasilHtml = await readFile(join(outDir, 'drasil', 'index.html'), 'utf8');
    assert.match(drasilHtml, /<title>Drasil<\/title>/);
    assert.match(drasilHtml, /Dragon/);
    assert.match(drasilHtml, /example\.com\/a\.jpg/);
});

test('escapes HTML in name, species, and bio', async () => {
    const { dataPath, templatePath, outDir } = await setupProject([
        {
            slug: 'evil',
            name: '<script>alert(1)</script>',
            species: '"><img src=x onerror=alert(2)>',
            bio: 'safe & sound',
            images: [],
        },
    ]);

    await generateCharacterPages({ dataPath, templatePath, outDir });

    const html = await readFile(join(outDir, 'evil', 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(html, /onerror=alert\(2\)/);
    assert.match(html, /safe &amp; sound/);
});

test('marks nsfw images with a data attribute in the output', async () => {
    const { dataPath, templatePath, outDir } = await setupProject([
        { slug: 'x', name: 'X', species: '', bio: '', images: [{ url: 'https://example.com/b.jpg', nsfw: true }] },
    ]);

    await generateCharacterPages({ dataPath, templatePath, outDir });

    const html = await readFile(join(outDir, 'x', 'index.html'), 'utf8');
    assert.match(html, /data-nsfw="true"/);
});
