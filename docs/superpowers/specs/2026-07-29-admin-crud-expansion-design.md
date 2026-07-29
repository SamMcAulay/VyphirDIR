# Admin CRUD Expansion — Design Spec

**Status:** Approved, implementation pending

**Goal:** The admin UI shipped in the original dynamic-content-cms plan only supports *adding* a character, editing top-level commission info (status/intro/special offer), and *adding* past-work entries. This expansion adds the missing management operations: edit and delete a character (including adding/removing individual images), a tiers repeater for commission pricing tiers, and edit/delete for past-work entries.

**Architecture:** No new Cloudflare Pages Functions. The project deliberately keeps to exactly two Functions (`publish-character`, `publish-commissions`); this expansion extends both with an `action`/`type` discriminator field, following the branching pattern `publish-commissions.js` already uses for `meta.type` (`'info'` vs `'past-work'`). All new operations stay behind the same Cloudflare Access protection on `/api/*` — no auth changes.

---

## Data model changes

None. `data/characters.json`'s character shape (`slug, name, species, bio, images: [{url, nsfw}]`) and `data/commissions.json`'s shape (`status, intro, specialOffer, tiers, pastWork`) are unchanged. Past-work entries are addressed by their existing `url` field (already unique per Cloudinary upload, no new ID field needed — avoids a migration for entries created before this expansion).

---

## `functions/api/publish-character.js` changes

**New `meta.action` field:** `'save'` (default, covers both create and update) or `'delete'`.

**Delete branch:** requires `meta.slug`. Reads `data/characters.json`, removes the matching entry (404-equivalent 400 error if the slug isn't found), commits. No Cloudinary cleanup — orphaned images in Cloudinary on delete are an accepted, already-established trade-off in this codebase (same as the existing orphaned-upload-on-invalid-submit gap noted in the original final review).

**Save branch — image merge:** Currently `onRequestPost` always builds the `images` array solely from newly uploaded files, which makes editing without re-uploading every image impossible. This changes to:
- `meta.existingImages`: array of `{url, nsfw}` for images the admin chose to keep from the character's current set (with NSFW flags editable at save time).
- Newly uploaded files (the existing `images` formData field) are uploaded to Cloudinary and appended, using `meta.nsfwFlags` exactly as today — but that array now only corresponds to the *new* files, not a combined list.
- Final `images = [...meta.existingImages, ...newlyUploadedWithFlags]`, validated by the existing "at least one image" rule (so removing everything and adding nothing still fails cleanly).

**Slug is immutable once created.** The admin form for editing a character does not offer a name-driven re-slugging; `meta.slug` is always the character's original slug, sent explicitly by the admin UI, and `updateCharactersFile`'s existing update-by-slug path already relies on this (it does not regenerate a slug on update, only on create).

---

## `functions/api/publish-commissions.js` changes

**Past-work `meta.action`:** `'add'` (default, existing behavior), `'edit'`, `'delete'`. Both new actions take `meta.url` to identify the target entry (matched via `Array.find`/`Array.findIndex` against `pastWork[].url`); a missing match returns a 400, not a silent no-op.

- `edit`: takes `meta.caption`, updates that entry's caption in place. No image re-upload for edit (changing the image is a delete + re-add).
- `delete`: removes the matching entry from the `pastWork` array.

**Tiers:** no Function change. `updateInfo` already accepts and stores an arbitrary `tiers` array with per-tier optional image upload aligned by index (`tierImages` formData field vs. `meta.tiers`). The admin UI's tiers repeater must preserve index alignment even for rows with no new image — it does this by always appending a placeholder (`new File([], '')`, size 0) for tier rows that aren't changing their image, since the Function already treats a zero-size file as "keep the existing `tier.example`".

---

## Admin UI changes (`admin/index.html`, `admin/admin.js`, `admin/admin.css`)

**Manage Characters section:** fetches `/data/characters.json` on load (same-origin, already permitted by the existing CSP `connect-src 'self'`), renders a thumbnail + name row per character with **Edit** and **Delete** buttons.

- **Edit** populates the existing character form (name/species/bio) and renders the character's current images as a checklist (checked = keep, with a per-image NSFW toggle), clears the file input for new uploads, and switches the form into "edit mode" (tracked via an in-memory `editingSlug` variable, `null` when adding a new character). The submit button label reflects the mode ("Publish Character" vs "Save Changes").
- **Delete** requires a *stronger* confirmation than the existing generic "this is live and permanent" dialog, given it's the only fully destructive action in the admin: the admin must type the character's exact name into a prompt before the delete request fires.
- On success, the in-memory character list updates optimistically (add/replace/remove the edited entry locally) rather than re-fetching `/data/characters.json` immediately — that file is a static build artifact that won't reflect the change until Cloudflare's next deploy (~30-60s later per the original design spec), so an immediate re-fetch would show stale data if the admin wants to make a second edit right away.

**Tiers repeater:** inside the existing commission-info form. An "Add tier" button appends a row (name, price, description, optional image file input) with its own "Remove" button. On submit, rows are read into the `tiers` array in DOM order, and each row's file input (or a zero-size placeholder if unchanged) is appended to `tierImages` in the same order, preserving the index alignment the Function expects. Fully-empty trailing rows are skipped.

**Manage Past Work section:** lists existing `pastWork` entries (thumbnail + caption) with **Edit caption** (inline text input, confirms via the standard dialog) and **Delete** (standard dialog — not the stronger name-typed one, since these are lower-stakes than a whole character) buttons. Same optimistic-update pattern as characters.

---

## Error handling

- Delete character / delete or edit past-work: "not found" is a clean 400 with a specific message, never a 500 or silent success.
- Save-character validation is unchanged in shape (still "at least one image required," "name required," etc.) but now evaluated against the merged existing+new image set.
- All new admin-side actions reuse the existing `setStatus`/error-display pattern — no new UI error-handling mechanism.

## Security

No changes to the auth model — every new action still flows through the same two Functions behind the same Cloudflare Access application. No new Cloudinary or GitHub permissions are needed (delete/edit only touch the GitHub Contents API, which the existing fine-grained PAT already has read/write access to).

## Testing

New `node:test` cases, no new test framework/dependency:
- `publish-character.js`: delete branch with a missing slug (400), and the existing-plus-new image merge logic (including the "all images removed, none added" failure case).
- `publish-commissions.js`: past-work edit/delete matched by URL, including the "URL not found" case for both.

## Out of scope

- Reordering images within a character, or reordering tiers/past-work entries.
- Bulk operations (deleting multiple characters at once, etc.).
- Any UI for viewing git/deploy history of past edits — the existing "live shortly" messaging is sufficient.
- Changing a character's slug after creation.
