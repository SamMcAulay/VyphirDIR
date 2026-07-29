# Admin CRUD Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the admin UI to support editing and deleting characters (including adding/removing individual images), a repeater UI for commission pricing tiers, and edit/delete for commission past-work entries — extending the existing two Cloudflare Pages Functions rather than adding new ones.

**Architecture:** `functions/api/publish-character.js` gains a `meta.action` discriminator (`'save'` default, `'delete'`) and merges kept-existing images with newly uploaded ones on save. `functions/api/publish-commissions.js` gains `meta.action` (`'edit'`, `'delete'`) for past-work entries, addressed by their already-unique `url`. The tiers repeater needs no backend change — `publish-commissions.js` already accepts an arbitrary `tiers` array. `admin/admin.js` gains list-with-edit/delete UIs for characters and past-work, and a tier-row repeater, all behind the same Cloudflare Access protection already in place.

**Tech Stack:** Plain HTML/CSS/JS (no framework), Cloudflare Pages Functions, Node's built-in `node:test` runner. No new dependencies.

## Global Constraints

- No framework or bundler beyond the existing Node build script — admin UI stays plain HTML/CSS/JS.
- No new npm dependencies anywhere.
- Single admin only — no multi-user/collaborator design.
- Cloudinary uploads must be signed (server-side secret) — never an unsigned public preset (unchanged by this plan; no new upload paths beyond what already exists).
- CSP meta tag on every page: no `'unsafe-inline'` in `script-src`; only allowlist CDN origins actually used by that page. This plan adds no new external origins to `admin/index.html` — no CSP changes are needed.
- All DOM rendering of dynamic data uses `textContent`/`createElement`, never `innerHTML` with interpolated data.
- NSFW handling is a content-warning UI (blur + click-to-reveal), not access control — documented limitation, not a bug.
- Target cost: $0/month.
- Tests: `node --test`, no new test framework/dependency.
- A character's `slug` never changes once created — this plan's edit flow always resends the character's original slug, never lets the admin UI regenerate one.
- Deleting a Cloudinary-hosted image (via character delete, image removal, or past-work delete) does not delete the underlying Cloudinary asset — this is an accepted, pre-existing trade-off in this codebase (same category as the orphaned-upload-on-invalid-submit gap already noted from the original implementation's final review), not something this plan fixes.

---

### Task 1: `publish-character.js` — edit (image merge) and delete

**Files:**
- Modify: `functions/api/publish-character.js`
- Modify: `tests/publish-character.test.js`

**Interfaces:**
- Consumes: `getFile`, `putFile`, `withRetryOn409` from `./_shared/github.js` (unchanged); `uploadImage` from `./_shared/cloudinary.js` (unchanged); `uniqueSlug` from `../../shared/slugify.js` (unchanged).
- Produces: `validateCharacterPayload(payload): {valid, errors}` (unchanged), `validateDeleteRequest(meta): {valid, errors}` (new), `mergeCharacterImages(existingImages, newImages): Array<{url, nsfw}>` (new, exported for testing), `deleteCharacter(slug, githubConfig): Promise<void>` (new, exported for testing), `onRequestPost(context)` — the Cloudflare Pages Function entrypoint. It now accepts `meta.action` (`'delete'`, or omitted/anything else for save), `meta.existingImages: Array<{url, nsfw}>` (images to keep on a save), and on success returns `{ok: true, slug, character: {slug, name, species, bio, images}}` for a save, or `{ok: true, slug}` for a delete. Consumed by Task 3 (admin UI).

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `tests/publish-character.test.js` with:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateCharacterPayload,
    validateDeleteRequest,
    mergeCharacterImages,
    deleteCharacter,
} from '../functions/api/publish-character.js';

const githubConfig = { owner: 'o', repo: 'r', branch: 'main', token: 't' };

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

test('rejects a payload with no name', () => {
    const { valid, errors } = validateCharacterPayload({ name: '', images: [{ url: 'x' }] });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Name')));
});

test('rejects a payload with no images', () => {
    const { valid, errors } = validateCharacterPayload({ name: 'Test', images: [] });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('image')));
});

test('rejects non-string species/bio', () => {
    const { valid, errors } = validateCharacterPayload({
        name: 'Test',
        species: 42,
        images: [{ url: 'x' }],
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Species')));
});

test('accepts a minimal valid payload', () => {
    const { valid, errors } = validateCharacterPayload({
        name: 'Test',
        species: '',
        bio: '',
        images: [{ url: 'https://example.com/a.jpg', nsfw: false }],
    });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('validateDeleteRequest rejects a request with no slug', () => {
    const { valid, errors } = validateDeleteRequest({});
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Slug')));
});

test('validateDeleteRequest accepts a request with a slug', () => {
    const { valid, errors } = validateDeleteRequest({ slug: 'drasil' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('mergeCharacterImages combines existing and newly uploaded images', () => {
    const existing = [{ url: 'https://example.com/a.jpg', nsfw: false }];
    const fresh = [{ url: 'https://example.com/b.jpg', nsfw: true }];
    assert.deepEqual(mergeCharacterImages(existing, fresh), [
        { url: 'https://example.com/a.jpg', nsfw: false },
        { url: 'https://example.com/b.jpg', nsfw: true },
    ]);
});

test('mergeCharacterImages drops existing entries with no url', () => {
    const existing = [{ nsfw: false }, { url: '', nsfw: true }, { url: 'https://example.com/a.jpg', nsfw: false }];
    assert.deepEqual(mergeCharacterImages(existing, []), [
        { url: 'https://example.com/a.jpg', nsfw: false },
    ]);
});

test('mergeCharacterImages returns an empty array when nothing is kept or added', () => {
    assert.deepEqual(mergeCharacterImages([], []), []);
});

test('deleteCharacter throws a notFound error when the slug does not exist', async () => {
    await withMockedFetch(
        async () =>
            new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({ characters: [{ slug: 'drasil', name: 'Drasil', images: [] }] })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            ),
        async () => {
            await assert.rejects(
                deleteCharacter('nonexistent', githubConfig),
                (error) => error.notFound === true
            );
        }
    );
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test tests/publish-character.test.js`
Expected: the 4 pre-existing tests PASS; `validateDeleteRequest`, `mergeCharacterImages`, and `deleteCharacter` tests FAIL with `does not provide an export named` errors (these don't exist in the source file yet).

- [ ] **Step 3: Implement**

Replace the entire contents of `functions/api/publish-character.js` with:

```javascript
import { getFile, putFile, withRetryOn409 } from './_shared/github.js';
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

export function validateDeleteRequest(meta) {
    const errors = [];
    if (!meta || typeof meta !== 'object' || !meta.slug || typeof meta.slug !== 'string') {
        errors.push('Slug is required to delete a character');
    }
    return { valid: errors.length === 0, errors };
}

export function mergeCharacterImages(existingImages, newImages) {
    const cleanExisting = (existingImages || [])
        .filter((img) => img && typeof img.url === 'string' && img.url)
        .map((img) => ({ url: img.url, nsfw: Boolean(img.nsfw) }));
    return [...cleanExisting, ...(newImages || [])];
}

async function updateCharactersFile(payload, existingSlug, githubConfig) {
    const path = 'data/characters.json';

    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);

        let slug = existingSlug;
        if (slug) {
            const index = data.characters.findIndex((c) => c.slug === slug);
            if (index === -1) {
                const error = new Error(`Character with slug "${slug}" not found`);
                error.notFound = true;
                throw error;
            }
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
    });
}

export async function deleteCharacter(slug, githubConfig) {
    const path = 'data/characters.json';

    return withRetryOn409(async () => {
        const { content, sha } = await getFile(path, githubConfig);
        const data = JSON.parse(content);

        const index = data.characters.findIndex((c) => c.slug === slug);
        if (index === -1) {
            const error = new Error(`Character with slug "${slug}" not found`);
            error.notFound = true;
            throw error;
        }

        data.characters.splice(index, 1);

        await putFile(
            path,
            JSON.stringify(data, null, 2),
            sha,
            `content: delete character "${slug}"`,
            githubConfig
        );
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

        if (meta.action === 'delete') {
            const { valid, errors } = validateDeleteRequest(meta);
            if (!valid) {
                return new Response(JSON.stringify({ error: errors.join(', ') }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            await deleteCharacter(meta.slug, githubConfig);
            return new Response(JSON.stringify({ ok: true, slug: meta.slug }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const files = formData.getAll('images');
        const newImages = [];
        for (let i = 0; i < files.length; i += 1) {
            const url = await uploadImage(files[i], {
                cloudName: env.CLOUDINARY_CLOUD_NAME,
                apiKey: env.CLOUDINARY_API_KEY,
                apiSecret: env.CLOUDINARY_API_SECRET,
                folder: 'vyphir/characters',
            });
            newImages.push({ url, nsfw: Boolean(meta.nsfwFlags && meta.nsfwFlags[i]) });
        }

        const payload = {
            name: meta.name,
            species: meta.species || '',
            bio: meta.bio || '',
            images: mergeCharacterImages(meta.existingImages, newImages),
        };

        const { valid, errors } = validateCharacterPayload(payload);
        if (!valid) {
            return new Response(JSON.stringify({ error: errors.join(', ') }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { slug } = await updateCharactersFile(payload, meta.slug, githubConfig);
        return new Response(JSON.stringify({ ok: true, slug, character: { ...payload, slug } }), {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/publish-character.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add functions/api/publish-character.js tests/publish-character.test.js
git commit -m "feat: support editing (with image add/remove) and deleting characters"
```

---

### Task 2: `publish-commissions.js` — past-work edit and delete

**Files:**
- Modify: `functions/api/publish-commissions.js`
- Modify: `tests/publish-commissions.test.js`

**Interfaces:**
- Consumes: `getFile`, `putFile`, `withRetryOn409` from `./_shared/github.js` (unchanged); `uploadImage` from `./_shared/cloudinary.js` (unchanged).
- Produces: `validateCommissionsInfo`, `validatePastWorkEntry` (unchanged), `validatePastWorkEdit(meta): {valid, errors}` (new), `validatePastWorkDelete(meta): {valid, errors}` (new), `editPastWork(url, caption, githubConfig): Promise<void>` (new, exported for testing), `deletePastWork(url, githubConfig): Promise<void>` (new, exported for testing), `onRequestPost(context)` — now accepts `meta.action` (`'edit'` or `'delete'`, identified by `meta.url`) when `meta.type === 'past-work'`. Responses: `{ok: true, entry: {url, caption}}` on add, `{ok: true}` on edit/delete, `{ok: true, tiers}` on info-save (the resolved tiers array, including any newly uploaded example-image URLs). Consumed by Task 4 (tiers UI) and Task 5 (past-work UI).

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `tests/publish-commissions.test.js` with:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateCommissionsInfo,
    validatePastWorkEntry,
    validatePastWorkEdit,
    validatePastWorkDelete,
    editPastWork,
    deletePastWork,
} from '../functions/api/publish-commissions.js';

const githubConfig = { owner: 'o', repo: 'r', branch: 'main', token: 't' };

function withMockedFetch(impl, run) {
    const original = globalThis.fetch;
    globalThis.fetch = impl;
    return Promise.resolve(run()).finally(() => {
        globalThis.fetch = original;
    });
}

test('rejects non-boolean status', () => {
    const { valid, errors } = validateCommissionsInfo({ status: 'yes', intro: '', tiers: [] });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Status')));
});

test('rejects tiers missing a name', () => {
    const { valid, errors } = validateCommissionsInfo({
        status: true,
        intro: '',
        tiers: [{ name: '', price: '10' }],
    });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('Tier 1')));
});

test('accepts a minimal valid info payload', () => {
    const { valid, errors } = validateCommissionsInfo({
        status: true,
        intro: 'Open!',
        specialOffer: '',
        tiers: [],
    });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('rejects a past-work entry with no url', () => {
    const { valid, errors } = validatePastWorkEntry({ caption: 'hi' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('URL')));
});

test('accepts a valid past-work entry', () => {
    const { valid, errors } = validatePastWorkEntry({ url: 'https://example.com/a.jpg', caption: 'hi' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('validatePastWorkEdit rejects a request with no url', () => {
    const { valid, errors } = validatePastWorkEdit({ caption: 'hi' });
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('URL')));
});

test('validatePastWorkEdit accepts a request with a url', () => {
    const { valid, errors } = validatePastWorkEdit({ url: 'https://example.com/a.jpg', caption: 'hi' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('validatePastWorkDelete rejects a request with no url', () => {
    const { valid, errors } = validatePastWorkDelete({});
    assert.equal(valid, false);
    assert.ok(errors.some((e) => e.includes('URL')));
});

test('validatePastWorkDelete accepts a request with a url', () => {
    const { valid, errors } = validatePastWorkDelete({ url: 'https://example.com/a.jpg' });
    assert.equal(valid, true);
    assert.deepEqual(errors, []);
});

test('editPastWork throws a notFound error when the url does not exist', async () => {
    await withMockedFetch(
        async () =>
            new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({ pastWork: [{ url: 'https://example.com/a.jpg', caption: 'hi' }] })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            ),
        async () => {
            await assert.rejects(
                editPastWork('https://example.com/missing.jpg', 'new caption', githubConfig),
                (error) => error.notFound === true
            );
        }
    );
});

test('deletePastWork throws a notFound error when the url does not exist', async () => {
    await withMockedFetch(
        async () =>
            new Response(
                JSON.stringify({
                    content: Buffer.from(
                        JSON.stringify({ pastWork: [{ url: 'https://example.com/a.jpg', caption: 'hi' }] })
                    ).toString('base64'),
                    sha: 'abc123',
                }),
                { status: 200 }
            ),
        async () => {
            await assert.rejects(
                deletePastWork('https://example.com/missing.jpg', githubConfig),
                (error) => error.notFound === true
            );
        }
    );
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test tests/publish-commissions.test.js`
Expected: the 5 pre-existing tests PASS; `validatePastWorkEdit`, `validatePastWorkDelete`, `editPastWork`, `deletePastWork` tests FAIL with `does not provide an export named` errors.

- [ ] **Step 3: Implement**

Replace the entire contents of `functions/api/publish-commissions.js` with:

```javascript
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

export function validatePastWorkEdit(meta) {
    const errors = [];
    if (!meta || !meta.url || typeof meta.url !== 'string') {
        errors.push('URL is required to identify the past-work entry');
    }
    if (meta && meta.caption !== undefined && typeof meta.caption !== 'string') {
        errors.push('Caption must be a string');
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

export async function editPastWork(url, caption, githubConfig) {
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
        data.pastWork[index] = { ...data.pastWork[index], caption: caption || '' };
        await putFile(path, JSON.stringify(data, null, 2), sha, 'content: edit past commission work', githubConfig);
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
                await editPastWork(meta.url, meta.caption, githubConfig);
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
            const entry = { url, caption: meta.caption || '' };
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/publish-commissions.test.js`
Expected: PASS (14 tests)

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all suites PASS, 39 tests total (6 slugify + 4 generate-characters + 5 github + 10 publish-character + 14 publish-commissions).

- [ ] **Step 6: Commit**

```bash
git add functions/api/publish-commissions.js tests/publish-commissions.test.js
git commit -m "feat: support editing and deleting commission past-work entries"
```

---

### Task 3: Admin UI — Manage Characters (edit + delete)

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`

**Interfaces:**
- Consumes: `POST /api/publish-character` from Task 1 — request is `FormData` with a `meta` JSON string (now including optional `slug`, `action: 'delete'`, `existingImages: [{url, nsfw}]`, `nsfwFlags` for newly selected files only) plus `images` files; response `{ok, slug, character}` on save, `{ok, slug}` on delete, `{error}` on failure (as established in Task 1).
- Produces: final admin page markup/behavior for character management. Establishes CSS classes `.hidden`, `.character-list-row`, `.character-list-thumb`, `.character-list-name`, `.danger-button`, `.existing-image-row`, `.existing-image-thumb`, `.existing-image-keep`, `.existing-image-nsfw`, `.past-work-list-row`, `.past-work-list-thumb`, `.past-work-list-caption` — the last three are defined here (grouped with the near-identical character-list styles) but not used until Task 5.

No automated tests for this task — it's UI wiring with no pure logic to isolate, consistent with how the original admin UI (add-only forms) was verified: manual/local review, not `node:test`. Full end-to-end behavior (an actual request reaching the live Cloudflare Function) can only be verified by you against the real deployment, same as every other admin-facing task in this project.

- [ ] **Step 1: Update `admin/index.html`**

Find this block (the character-adding section):

```html
    <section class="admin-panel">
        <h2>Add Character</h2>
        <form id="character-form">
            <label for="char-name">Name</label>
            <input type="text" id="char-name" required>

            <label for="char-species">Species / Type</label>
            <input type="text" id="char-species">

            <label for="char-bio">Bio</label>
            <textarea id="char-bio" rows="4"></textarea>

            <label for="char-images">Images (select multiple)</label>
            <input type="file" id="char-images" accept="image/png,image/jpeg,image/webp" multiple required>
            <div id="char-nsfw-rows"></div>

            <button type="submit">Publish Character</button>
            <p class="admin-status" id="character-status"></p>
        </form>
    </section>
```

Replace it with:

```html
    <section class="admin-panel">
        <h2>Manage Characters</h2>
        <div id="character-list"></div>
    </section>

    <section class="admin-panel">
        <h2 id="character-form-heading">Add Character</h2>
        <form id="character-form">
            <label for="char-name">Name</label>
            <input type="text" id="char-name" required>

            <label for="char-species">Species / Type</label>
            <input type="text" id="char-species">

            <label for="char-bio">Bio</label>
            <textarea id="char-bio" rows="4"></textarea>

            <div id="char-existing-images"></div>

            <label for="char-images">Add images (select multiple)</label>
            <input type="file" id="char-images" accept="image/png,image/jpeg,image/webp" multiple>
            <div id="char-nsfw-rows"></div>

            <button type="submit" id="character-submit-button">Publish Character</button>
            <button type="button" id="character-cancel-edit" class="hidden">Cancel Edit</button>
            <p class="admin-status" id="character-status"></p>
        </form>
    </section>
```

Note: `required` was removed from `#char-images` — a new character with zero images is still rejected (server-side, by `validateCharacterPayload`'s "at least one image" rule), but an *edit* that keeps only existing images and adds none must be allowed to submit with the file input empty.

- [ ] **Step 2: Append new styles to `admin/admin.css`**

Append to the end of `admin/admin.css`:

```css

.hidden {
    display: none;
}

.character-list-row,
.past-work-list-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.character-list-thumb,
.past-work-list-thumb,
.existing-image-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
}

.character-list-name,
.past-work-list-caption {
    flex: 1;
}

.admin-panel button.danger-button {
    background: var(--red, #ff4d4d);
    color: #ffffff;
}
```

- [ ] **Step 3: Update `admin/admin.js`**

Replace the entire contents of `admin/admin.js` with:

```javascript
function setStatus(elementId, message, isError) {
    const el = document.getElementById(elementId);
    el.textContent = message;
    el.className = `admin-status ${isError ? 'error' : 'success'}`;
}

function renderNsfwCheckboxes(files) {
    const container = document.getElementById('char-nsfw-rows');
    container.innerHTML = '';
    Array.from(files).forEach((file, i) => {
        const row = document.createElement('div');
        row.className = 'image-row';

        const label = document.createElement('label');
        label.textContent = file.name;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.nsfwIndex = String(i);

        row.append(checkbox, label);
        container.appendChild(row);
    });
}

document.getElementById('char-images').addEventListener('change', (event) => {
    renderNsfwCheckboxes(event.target.files);
});

let currentCharacters = [];
let editingSlug = null;

function renderExistingImages(images) {
    const container = document.getElementById('char-existing-images');
    container.innerHTML = '';
    (images || []).forEach((img) => {
        const row = document.createElement('div');
        row.className = 'image-row existing-image-row';
        row.dataset.url = img.url;

        const thumb = document.createElement('img');
        thumb.src = img.url;
        thumb.alt = '';
        thumb.className = 'existing-image-thumb';

        const keepLabel = document.createElement('label');
        const keepCheckbox = document.createElement('input');
        keepCheckbox.type = 'checkbox';
        keepCheckbox.className = 'existing-image-keep';
        keepCheckbox.checked = true;
        keepLabel.append(keepCheckbox, document.createTextNode(' Keep'));

        const nsfwLabel = document.createElement('label');
        const nsfwCheckbox = document.createElement('input');
        nsfwCheckbox.type = 'checkbox';
        nsfwCheckbox.className = 'existing-image-nsfw';
        nsfwCheckbox.checked = Boolean(img.nsfw);
        nsfwLabel.append(nsfwCheckbox, document.createTextNode(' NSFW'));

        row.append(thumb, keepLabel, nsfwLabel);
        container.appendChild(row);
    });
}

function startEditingCharacter(character) {
    editingSlug = character.slug;
    document.getElementById('char-name').value = character.name || '';
    document.getElementById('char-species').value = character.species || '';
    document.getElementById('char-bio').value = character.bio || '';
    document.getElementById('char-images').value = '';
    document.getElementById('char-nsfw-rows').innerHTML = '';
    renderExistingImages(character.images);
    document.getElementById('character-form-heading').textContent = `Edit ${character.name}`;
    document.getElementById('character-submit-button').textContent = 'Save Changes';
    document.getElementById('character-cancel-edit').classList.remove('hidden');
}

function resetCharacterForm() {
    editingSlug = null;
    document.getElementById('character-form').reset();
    document.getElementById('char-nsfw-rows').innerHTML = '';
    document.getElementById('char-existing-images').innerHTML = '';
    document.getElementById('character-form-heading').textContent = 'Add Character';
    document.getElementById('character-submit-button').textContent = 'Publish Character';
    document.getElementById('character-cancel-edit').classList.add('hidden');
}

document.getElementById('character-cancel-edit').addEventListener('click', resetCharacterForm);

async function deleteCharacterFlow(character) {
    const typed = window.prompt(`Type "${character.name}" to permanently delete this character:`);
    if (typed !== character.name) return;

    try {
        const formData = new FormData();
        formData.append('meta', JSON.stringify({ action: 'delete', slug: character.slug }));
        const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        currentCharacters = currentCharacters.filter((c) => c.slug !== character.slug);
        renderCharacterList();
        if (editingSlug === character.slug) resetCharacterForm();
        setStatus('character-status', 'Deleted — live shortly', false);
    } catch (error) {
        setStatus('character-status', `Delete failed: ${error.message}`, true);
    }
}

function renderCharacterList() {
    const container = document.getElementById('character-list');
    container.innerHTML = '';
    currentCharacters.forEach((character) => {
        const row = document.createElement('div');
        row.className = 'character-list-row';

        const firstImage = (character.images || [])[0];
        const thumb = document.createElement('img');
        thumb.className = 'character-list-thumb';
        thumb.alt = '';
        if (firstImage) thumb.src = firstImage.url;

        const name = document.createElement('span');
        name.className = 'character-list-name';
        name.textContent = character.name;

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => startEditingCharacter(character));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'danger-button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteCharacterFlow(character));

        row.append(thumb, name, editButton, deleteButton);
        container.appendChild(row);
    });
}

fetch('/data/characters.json')
    .then((r) => r.json())
    .then((d) => {
        currentCharacters = d.characters || [];
        renderCharacterList();
    })
    .catch((error) => console.error('Failed to load current characters:', error));

let currentCommissions = { tiers: [] };
fetch('/data/commissions.json')
    .then((r) => r.json())
    .then((d) => {
        currentCommissions = d;
        document.getElementById('comm-status').checked = Boolean(d.status);
        document.getElementById('comm-intro').value = d.intro || '';
        document.getElementById('comm-special-offer').value = d.specialOffer || '';
    })
    .catch((error) => console.error('Failed to load current commissions data:', error));

document.getElementById('character-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const files = document.getElementById('char-images').files;
    const nsfwFlags = Array.from(document.querySelectorAll('#char-nsfw-rows [data-nsfw-index]')).map((cb) => cb.checked);
    const existingImages = Array.from(document.querySelectorAll('#char-existing-images .existing-image-row'))
        .filter((row) => row.querySelector('.existing-image-keep').checked)
        .map((row) => ({
            url: row.dataset.url,
            nsfw: row.querySelector('.existing-image-nsfw').checked,
        }));

    const meta = {
        name: document.getElementById('char-name').value,
        species: document.getElementById('char-species').value,
        bio: document.getElementById('char-bio').value,
        nsfwFlags,
        existingImages,
    };
    if (editingSlug) meta.slug = editingSlug;

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    Array.from(files).forEach((file) => formData.append('images', file));

    setStatus('character-status', editingSlug ? 'Saving...' : 'Publishing...', false);
    try {
        const response = await fetch('/api/publish-character', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('character-status', `Published — live shortly at /gallery/${result.slug}/`, false);

        const index = currentCharacters.findIndex((c) => c.slug === result.slug);
        if (index === -1) {
            currentCharacters.push(result.character);
        } else {
            currentCharacters[index] = result.character;
        }
        renderCharacterList();
        resetCharacterForm();
    } catch (error) {
        setStatus('character-status', error.message, true);
    }
});

document.getElementById('commissions-info-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const meta = {
        type: 'info',
        status: document.getElementById('comm-status').checked,
        intro: document.getElementById('comm-intro').value,
        specialOffer: document.getElementById('comm-special-offer').value,
        tiers: currentCommissions.tiers || [],
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));

    setStatus('commissions-info-status', 'Saving...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('commissions-info-status', 'Saved — live shortly', false);
    } catch (error) {
        setStatus('commissions-info-status', error.message, true);
    }
});

document.getElementById('past-work-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const file = document.getElementById('past-work-image').files[0];
    const meta = {
        type: 'past-work',
        caption: document.getElementById('past-work-caption').value,
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    formData.append('image', file);

    setStatus('past-work-status', 'Publishing...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('past-work-status', 'Published — live shortly', false);
        event.target.reset();
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
});
```

Note: `commissions-info-form` and `past-work-form` handlers are untouched in this task (still using the pre-existing `currentCommissions.tiers` pattern) — Task 4 replaces the tiers line, Task 5 replaces the past-work-form handler. Don't "improve" them early; keep this task's diff scoped to characters only.

- [ ] **Step 4: Manual verification**

```bash
npm run build
python3 -m http.server 8080
```

Open `http://localhost:8080/admin/`. Confirm:
- A "Manage Characters" section appears above "Add Character", listing all 5 seeded characters with a thumbnail, name, Edit, and Delete button each (reads from the locally-served `data/characters.json`).
- Clicking "Edit" on a character populates the name/species/bio fields, shows that character's images as a checklist (each with a checked "Keep" box and an "NSFW" box matching its current flag), changes the heading to "Edit `<name>`", changes the submit button to "Save Changes", and reveals a "Cancel Edit" button.
- Clicking "Cancel Edit" restores the form to "Add Character" / empty fields / hidden cancel button.
- No console errors on page load or when clicking Edit/Cancel (submitting will fail locally since there's no live Cloudflare Function to POST to at this stage — that's expected; full submit verification happens against the real deployment).

- [ ] **Step 5: Commit**

```bash
git add admin/index.html admin/admin.js admin/admin.css
git commit -m "feat: add Manage Characters list with edit and delete to admin UI"
```

---

### Task 4: Admin UI — Commission tiers repeater

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`

**Interfaces:**
- Consumes: `POST /api/publish-commissions` info-save path from Task 2 (accepts arbitrary `tiers` array with per-tier optional image aligned by `tierImages` form-field index; response includes `{ok, tiers}`).
- Produces: `.tier-row`, `.tier-name`, `.tier-price`, `.tier-description`, `.tier-image` DOM structure and `renderTierRow(tier)` function. No other task depends on this directly, but Task 5 edits the same commissions-fetch callback this task modifies — Task 5's diff assumes this task's version of that callback exists first.

No automated tests (same reasoning as Task 3 — UI wiring, no isolable pure logic beyond what Task 2 already tests).

- [ ] **Step 1: Update `admin/index.html`**

Find this block:

```html
    <section class="admin-panel">
        <h2>Commission Info</h2>
        <form id="commissions-info-form">
            <label><input type="checkbox" id="comm-status" checked> Commissions open</label>

            <label for="comm-intro">Intro text</label>
            <textarea id="comm-intro" rows="3"></textarea>

            <label for="comm-special-offer">Special offer (e.g. PWYW) — leave blank if none</label>
            <input type="text" id="comm-special-offer">

            <button type="submit">Save Commission Info</button>
            <p class="admin-status" id="commissions-info-status"></p>
        </form>
    </section>
```

Replace it with:

```html
    <section class="admin-panel">
        <h2>Commission Info</h2>
        <form id="commissions-info-form">
            <label><input type="checkbox" id="comm-status" checked> Commissions open</label>

            <label for="comm-intro">Intro text</label>
            <textarea id="comm-intro" rows="3"></textarea>

            <label for="comm-special-offer">Special offer (e.g. PWYW) — leave blank if none</label>
            <input type="text" id="comm-special-offer">

            <label>Tiers</label>
            <div id="comm-tiers-rows"></div>
            <button type="button" id="comm-add-tier">Add tier</button>

            <button type="submit">Save Commission Info</button>
            <p class="admin-status" id="commissions-info-status"></p>
        </form>
    </section>
```

- [ ] **Step 2: Append tier-row styles to `admin/admin.css`**

Append to the end of `admin/admin.css`:

```css

.tier-row {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px;
    margin-top: 10px;
}

.tier-row input[type="text"],
.tier-row textarea {
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: inherit;
    margin-top: 6px;
}
```

- [ ] **Step 3: Update `admin/admin.js`**

Find this block (from Task 3):

```javascript
let currentCommissions = { tiers: [] };
fetch('/data/commissions.json')
    .then((r) => r.json())
    .then((d) => {
        currentCommissions = d;
        document.getElementById('comm-status').checked = Boolean(d.status);
        document.getElementById('comm-intro').value = d.intro || '';
        document.getElementById('comm-special-offer').value = d.specialOffer || '';
    })
    .catch((error) => console.error('Failed to load current commissions data:', error));
```

Replace it with:

```javascript
function renderTierRow(tier) {
    const container = document.getElementById('comm-tiers-rows');
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.dataset.existingExample = (tier && tier.example) || '';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'tier-name';
    nameInput.placeholder = 'Tier name';
    nameInput.value = (tier && tier.name) || '';

    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.className = 'tier-price';
    priceInput.placeholder = 'Price (e.g. $20)';
    priceInput.value = (tier && tier.price) || '';

    const descriptionInput = document.createElement('textarea');
    descriptionInput.className = 'tier-description';
    descriptionInput.rows = 2;
    descriptionInput.placeholder = 'Description';
    descriptionInput.value = (tier && tier.description) || '';

    const imageLabel = document.createElement('label');
    imageLabel.textContent = tier && tier.example ? 'Replace example image (optional)' : 'Example image (optional)';

    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.className = 'tier-image';
    imageInput.accept = 'image/png,image/jpeg,image/webp';

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove tier';
    removeButton.addEventListener('click', () => row.remove());

    row.append(nameInput, priceInput, descriptionInput, imageLabel, imageInput, removeButton);
    container.appendChild(row);
}

document.getElementById('comm-add-tier').addEventListener('click', () => renderTierRow(null));

fetch('/data/commissions.json')
    .then((r) => r.json())
    .then((d) => {
        document.getElementById('comm-status').checked = Boolean(d.status);
        document.getElementById('comm-intro').value = d.intro || '';
        document.getElementById('comm-special-offer').value = d.specialOffer || '';
        (d.tiers || []).forEach((tier) => renderTierRow(tier));
    })
    .catch((error) => console.error('Failed to load current commissions data:', error));
```

Note this removes the `currentCommissions` variable entirely — after this change nothing needs the raw fetched object anymore (status/intro/specialOffer are read straight into fields, tiers become rows immediately).

Next, find the `commissions-info-form` submit handler:

```javascript
document.getElementById('commissions-info-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const meta = {
        type: 'info',
        status: document.getElementById('comm-status').checked,
        intro: document.getElementById('comm-intro').value,
        specialOffer: document.getElementById('comm-special-offer').value,
        tiers: currentCommissions.tiers || [],
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));

    setStatus('commissions-info-status', 'Saving...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('commissions-info-status', 'Saved — live shortly', false);
    } catch (error) {
        setStatus('commissions-info-status', error.message, true);
    }
});
```

Replace it with:

```javascript
document.getElementById('commissions-info-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const tierRows = Array.from(document.querySelectorAll('#comm-tiers-rows .tier-row'));
    const tiers = [];
    const tierFiles = [];
    tierRows.forEach((row) => {
        const name = row.querySelector('.tier-name').value.trim();
        const price = row.querySelector('.tier-price').value.trim();
        const description = row.querySelector('.tier-description').value.trim();
        const existingExample = row.dataset.existingExample || '';
        const newFile = row.querySelector('.tier-image').files[0];

        if (!name && !price && !description && !existingExample && !newFile) return;

        tiers.push({ name, price, description, example: existingExample });
        tierFiles.push(newFile || new File([], ''));
    });

    const meta = {
        type: 'info',
        status: document.getElementById('comm-status').checked,
        intro: document.getElementById('comm-intro').value,
        specialOffer: document.getElementById('comm-special-offer').value,
        tiers,
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    tierFiles.forEach((file) => formData.append('tierImages', file));

    setStatus('commissions-info-status', 'Saving...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('commissions-info-status', 'Saved — live shortly', false);
        document.getElementById('comm-tiers-rows').innerHTML = '';
        (result.tiers || []).forEach((tier) => renderTierRow(tier));
    } catch (error) {
        setStatus('commissions-info-status', error.message, true);
    }
});
```

The `tierFiles.push(newFile || new File([], ''))` line is the key to keeping `tiers[i]` and the `tierImages` form field aligned by index even for rows that aren't getting a new image — `publish-commissions.js`'s Function already treats a zero-size file as "keep the existing `tier.example`" (see Task 2), so a placeholder empty `File` is enough; no Function change was needed for this.

- [ ] **Step 4: Manual verification**

```bash
npm run build
python3 -m http.server 8080
```

Open `http://localhost:8080/admin/`. Confirm:
- "Commission Info" now shows a "Tiers" label, an (initially empty, since seed data has no tiers) rows container, and an "Add tier" button.
- Clicking "Add tier" appends a row with Name/Price/Description fields, an "Example image (optional)" file input, and a "Remove tier" button.
- Clicking "Remove tier" on a row removes just that row.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add admin/index.html admin/admin.js admin/admin.css
git commit -m "feat: add commission tiers repeater to admin UI"
```

---

### Task 5: Admin UI — Manage Past Work (edit + delete)

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`

No `admin/admin.css` changes — `.past-work-list-row`, `.past-work-list-thumb`, `.past-work-list-caption`, and `.danger-button` were all already added in Task 3.

**Interfaces:**
- Consumes: `POST /api/publish-commissions` past-work edit/delete from Task 2 (`{type: 'past-work', action: 'edit', url, caption}` → `{ok}`; `{type: 'past-work', action: 'delete', url}` → `{ok}`; existing add path now returns `{ok, entry}`).
- Produces: final `admin/admin.js` / `admin/index.html` state for this plan.

No automated tests (same reasoning as Tasks 3 and 4).

- [ ] **Step 1: Update `admin/index.html`**

Find this block:

```html
    <section class="admin-panel">
        <h2>Add Past Work</h2>
        <form id="past-work-form">
```

Insert a new section immediately before it:

```html
    <section class="admin-panel">
        <h2>Manage Past Work</h2>
        <div id="past-work-list"></div>
    </section>

    <section class="admin-panel">
        <h2>Add Past Work</h2>
        <form id="past-work-form">
```

(Everything else in that section — the form fields, submit button, status paragraph, closing tags — is unchanged.)

- [ ] **Step 2: Update `admin/admin.js`**

Find this block (as left by Task 4):

```javascript
fetch('/data/commissions.json')
    .then((r) => r.json())
    .then((d) => {
        document.getElementById('comm-status').checked = Boolean(d.status);
        document.getElementById('comm-intro').value = d.intro || '';
        document.getElementById('comm-special-offer').value = d.specialOffer || '';
        (d.tiers || []).forEach((tier) => renderTierRow(tier));
    })
    .catch((error) => console.error('Failed to load current commissions data:', error));
```

Replace it with:

```javascript
let currentPastWork = [];

function renderPastWorkList() {
    const container = document.getElementById('past-work-list');
    container.innerHTML = '';
    currentPastWork.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'past-work-list-row';

        const thumb = document.createElement('img');
        thumb.className = 'past-work-list-thumb';
        thumb.src = entry.url;
        thumb.alt = '';

        const caption = document.createElement('span');
        caption.className = 'past-work-list-caption';
        caption.textContent = entry.caption || '';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = 'Edit caption';
        editButton.addEventListener('click', () => editPastWorkFlow(entry));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'danger-button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deletePastWorkFlow(entry));

        row.append(thumb, caption, editButton, deleteButton);
        container.appendChild(row);
    });
}

async function editPastWorkFlow(entry) {
    const newCaption = window.prompt('Edit caption:', entry.caption || '');
    if (newCaption === null) return;
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append(
            'meta',
            JSON.stringify({ type: 'past-work', action: 'edit', url: entry.url, caption: newCaption })
        );
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        entry.caption = newCaption;
        renderPastWorkList();
        setStatus('past-work-status', 'Caption updated — live shortly', false);
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
}

async function deletePastWorkFlow(entry) {
    if (
        !window.confirm(
            'Delete this past-work entry? This will be published live and permanently recorded in git history.'
        )
    ) {
        return;
    }

    try {
        const formData = new FormData();
        formData.append('meta', JSON.stringify({ type: 'past-work', action: 'delete', url: entry.url }));
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        currentPastWork = currentPastWork.filter((e) => e.url !== entry.url);
        renderPastWorkList();
        setStatus('past-work-status', 'Deleted — live shortly', false);
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
}

fetch('/data/commissions.json')
    .then((r) => r.json())
    .then((d) => {
        document.getElementById('comm-status').checked = Boolean(d.status);
        document.getElementById('comm-intro').value = d.intro || '';
        document.getElementById('comm-special-offer').value = d.specialOffer || '';
        (d.tiers || []).forEach((tier) => renderTierRow(tier));
        currentPastWork = d.pastWork || [];
        renderPastWorkList();
    })
    .catch((error) => console.error('Failed to load current commissions data:', error));
```

Next, find the `past-work-form` submit handler:

```javascript
document.getElementById('past-work-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const file = document.getElementById('past-work-image').files[0];
    const meta = {
        type: 'past-work',
        caption: document.getElementById('past-work-caption').value,
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    formData.append('image', file);

    setStatus('past-work-status', 'Publishing...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('past-work-status', 'Published — live shortly', false);
        event.target.reset();
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
});
```

Replace it with:

```javascript
document.getElementById('past-work-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.confirm('This will be published live and permanently recorded in git history. Continue?')) {
        return;
    }

    const file = document.getElementById('past-work-image').files[0];
    const meta = {
        type: 'past-work',
        action: 'add',
        caption: document.getElementById('past-work-caption').value,
    };

    const formData = new FormData();
    formData.append('meta', JSON.stringify(meta));
    formData.append('image', file);

    setStatus('past-work-status', 'Publishing...', false);
    try {
        const response = await fetch('/api/publish-commissions', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unknown error');
        setStatus('past-work-status', 'Published — live shortly', false);
        event.target.reset();
        currentPastWork.push(result.entry);
        renderPastWorkList();
    } catch (error) {
        setStatus('past-work-status', error.message, true);
    }
});
```

- [ ] **Step 3: Manual verification**

```bash
npm run build
python3 -m http.server 8080
```

Open `http://localhost:8080/admin/`. Confirm:
- A "Manage Past Work" section appears above "Add Past Work" (empty list, since seed data has no past-work entries).
- No console errors anywhere on the page.
- Re-check the whole page end to end: Manage Characters, Add/Edit Character, Commission Info with Tiers, Manage Past Work, Add Past Work all render without errors and all element IDs referenced in `admin.js` exist in `admin/index.html` (cross-check by reading both files side by side one more time).

- [ ] **Step 4: Run the full test suite one more time**

Run: `npm test`
Expected: all 39 tests still PASS (this task touched no test files or Function code, so this just confirms nothing else in the repo regressed).

- [ ] **Step 5: Commit**

```bash
git add admin/index.html admin/admin.js
git commit -m "feat: add Manage Past Work list with edit and delete to admin UI"
```

---

## Post-implementation note (not a task — for you, not an agent)

Every new admin action in this plan still flows through the same two Cloudflare Pages Functions, behind the same Cloudflare Access application already protecting `/admin/*` and `/api/*` — no new manual dashboard setup is needed. After this plan merges and deploys, verify live: edit a character (add and remove an image, toggle an NSFW flag), delete a test character, add/edit/delete a past-work entry, and add/remove a tier — the same way you verified the original admin flows in Step 8 of `MANUAL_SETUP.md`.
